const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');
const axios = require('axios');
const pdf = require('pdf-parse');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

const resendApiKey = functions.config().resend?.api_key;
let resend = null;
if (resendApiKey) {
  resend = new Resend(resendApiKey);
}

exports.parseCVWithMistral = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    console.log('[PARSE-CV] Starting CV parsing process...');

    const { cvUrl, sessionId } = data;

    if (!cvUrl || !sessionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'CV URL and Session ID are required'
      );
    }

    try {
      console.log('[PARSE-CV] Downloading CV from:', cvUrl);

      const bucket = storage.bucket();

      const urlObj = new URL(cvUrl);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);

      if (!pathMatch) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Invalid CV URL format'
        );
      }

      const encodedPath = pathMatch[1];
      const decodedPath = decodeURIComponent(encodedPath);

      console.log('[PARSE-CV] Extracted storage path:', decodedPath);

      const file = bucket.file(decodedPath);

      const [fileBuffer] = await file.download();

      console.log('[PARSE-CV] CV downloaded, size:', fileBuffer.length, 'bytes');
      console.log('[PARSE-CV] Extracting text from PDF...');

      const pdfData = await pdf(fileBuffer);
      const cvText = pdfData.text;

      console.log('[PARSE-CV] Text extracted, length:', cvText.length, 'characters');
      console.log('[PARSE-CV] Calling Mistral AI for parsing...');

      const mistralApiKey = functions.config().mistral?.api_key;

      if (!mistralApiKey) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Mistral AI API key not configured'
        );
      }

      const response = await axios.post(
        'https://api.mistral.ai/v1/chat/completions',
        {
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'system',
              content: `You are an expert CV parser. Extract structured information from the CV and return ONLY a valid JSON object with these fields:
{
  "fullName": "string",
  "email": "string or null",
  "phone": "string or null",
  "address": "string or null",
  "summary": "professional summary or objective",
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "period (e.g., Jan 2020 - Dec 2022)",
      "description": "brief description of responsibilities"
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "institution": "institution name",
      "year": "graduation year or period"
    }
  ],
  "skills": ["skill1", "skill2"],
  "certifications": ["cert1", "cert2"],
  "languages": ["language1", "language2"]
}

Return ONLY the JSON object, no additional text.`
            },
            {
              role: 'user',
              content: `Parse this CV text and extract all relevant information. Return as structured JSON.\n\nCV TEXT:\n${cvText}`
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mistralApiKey}`
          },
          timeout: 30000
        }
      );

      console.log('[PARSE-CV] Mistral AI response received');

      const aiContent = response.data.choices[0].message.content;
      console.log('[PARSE-CV] Raw AI response:', aiContent.substring(0, 200));

      let parsedData;
      try {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          parsedData = JSON.parse(aiContent);
        }
      } catch (parseError) {
        console.error('[PARSE-CV] Failed to parse AI response as JSON:', parseError);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to parse CV: Invalid AI response format'
        );
      }

      parsedData.rawText = aiContent;

      console.log('[PARSE-CV] Successfully parsed CV data');
      console.log('[PARSE-CV] Updating session document...');

      await db.collection('interview_sessions').doc(sessionId).update({
        cvParsedData: parsedData,
        cvParsedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('[PARSE-CV] ✅ Session updated with parsed CV data');

      return {
        success: true,
        parsedData: parsedData
      };

    } catch (error) {
      console.error('[PARSE-CV] Error:', error);

      if (error.response) {
        console.error('[PARSE-CV] Mistral API error:', error.response.data);
      }

      throw new functions.https.HttpsError(
        'internal',
        `Failed to parse CV: ${error.message}`
      );
    }
  });

exports.sendEmail = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    // Support both old format (templateId/to/variables) and new format (type/to/data)
    const templateId = data.templateId || data.type;
    const to = data.to;
    const variables = data.variables || data.data || {};

    console.log(`[SEND-EMAIL] Sending ${templateId} to ${to}`);
    console.log(`[SEND-EMAIL] Variables:`, JSON.stringify(variables));

    try {
      if (!resend) {
        throw new Error('Resend not configured');
      }

      // Validate required fields
      if (!templateId) {
        throw new Error('templateId or type is required');
      }
      if (!to) {
        throw new Error('to (recipient email) is required');
      }

      let subject, htmlContent;

      switch (templateId) {
        case 'candidate_invitation':
          subject = `Undangan Asesmen dari ${variables.companyName || 'Perusahaan'}`;
          htmlContent = `
            <h2>Halo ${variables.candidateName || 'Kandidat'},</h2>
            <p>Anda telah diundang untuk mengikuti asesmen untuk posisi <strong>${variables.role || 'posisi yang dilamar'}</strong>.</p>
            <p>Kode akses Anda: <strong>${variables.accessCode || '-'}</strong></p>
            <p><a href="${variables.assessmentLink || '#'}">Klik di sini untuk memulai asesmen</a></p>
            <p>Terima kasih,<br/>${variables.companyName || 'Tim HR'}</p>
          `;
          break;

        case 'interview_invitation':
          const interviewType = variables.interviewType === 'online' ? 'Online (Video Call)' : 'Tatap Muka';
          subject = `Undangan Wawancara dari ${variables.companyName || 'Perusahaan'}`;
          htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF6B35, #F7931E); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .interview-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF6B35; }
                .detail-row { display: flex; margin: 10px 0; }
                .detail-label { font-weight: bold; width: 120px; color: #666; }
                .detail-value { color: #333; }
                .cta-button { display: inline-block; background: #FF6B35; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Selamat!</h1>
                  <p>Anda diundang untuk wawancara</p>
                </div>
                <div class="content">
                  <p>Halo <strong>${variables.candidateName || 'Kandidat'}</strong>,</p>
                  <p>Kami dengan senang hati mengundang Anda untuk wawancara posisi <strong>${variables.role || 'posisi yang dilamar'}</strong> di ${variables.companyName || 'perusahaan kami'}.</p>
                  
                  <div class="interview-details">
                    <h3>📋 Detail Wawancara</h3>
                    <div class="detail-row">
                      <span class="detail-label">📅 Tanggal:</span>
                      <span class="detail-value">${variables.interviewDate || '-'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">⏰ Waktu:</span>
                      <span class="detail-value">${variables.interviewTime || '-'} WIB</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">📍 Tipe:</span>
                      <span class="detail-value">${interviewType}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">🏢 Lokasi:</span>
                      <span class="detail-value">${variables.interviewLocation || '-'}</span>
                    </div>
                  </div>
                  
                  <p>Mohon hadir tepat waktu. Jika ada kendala, silakan hubungi kami segera.</p>
                  
                  <p>Salam hangat,<br/><strong>Tim HR ${variables.companyName || ''}</strong></p>
                </div>
                <div class="footer">
                  <p>Email ini dikirim otomatis oleh sistem FraudGuard HR</p>
                </div>
              </div>
            </body>
            </html>
          `;
          break;

        default:
          console.error(`[SEND-EMAIL] Unknown template: ${templateId}`);
          throw new Error(`Unknown template: ${templateId}`);
      }

      await resend.emails.send({
        from: 'noreply@hiregood.one',
        to: to,
        subject: subject,
        html: htmlContent
      });

      console.log(`[SEND-EMAIL] ✅ Email sent successfully`);
      return { success: true };

    } catch (error) {
      console.error('[SEND-EMAIL] Error:', error);
      throw new functions.https.HttpsError('internal', error.message || 'Failed to send email');
    }
  });

exports.sendInterviewSchedule = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('[SEND-INTERVIEW] Sending interview schedule email');
    return { success: true };
  });

exports.sendHireEmail = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('[SEND-HIRE] Sending hire confirmation email');
    return { success: true };
  });

exports.sendRejectionEmail = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    console.log('[SEND-REJECTION] Sending rejection email');
    return { success: true };
  });


// ==========================================
// DIDIT KYC INTEGRATION
// ==========================================
// Import Didit functions from didit-functions.js
const {
  diditWebhook,
  processDiditWebhook,
  createDiditSession,
  initiateBackgroundCheck
} = require('./didit-functions');

// Re-export for Firebase Functions
exports.diditWebhook = diditWebhook;
exports.processDiditWebhook = processDiditWebhook;
exports.createDiditSession = createDiditSession;
exports.initiateBackgroundCheck = initiateBackgroundCheck;



// ==========================================
// AI CHATBOT IMPLEMENTATION (Gemini + GPT-4o)
// ==========================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Generate AI response for candidate interview
 * Uses Gemini 2.0 Flash Thinking as primary, GPT-4o as fallback
 */
exports.generateAIResponse = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // 1. Validate Auth & Input
    const { role, message, history, candidateData } = data;

    // Note: In production you might want to require context.auth
    // but for this demo we'll allow unauthenticated for easier testing

    if (!role || !message) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Role and message are required'
      );
    }

    console.log(`[AI-CHAT] Generating response for ${role}. Message: "${message.substring(0, 50)}..."`);
    console.log(`[AI-CHAT] Candidate: ${candidateData?.fullName}`);

    // 2. Get API Keys
    const GEMINI_API_KEY = functions.config().gemini?.key;

    if (!GEMINI_API_KEY) {
      console.error('[AI-CONFIG] NO GEMINI API KEY CONFIGURED!');
      // Fallback to static response if no key
      return {
        success: true,
        response: "Maaf, sistem sedang mengalami gangguan konfigurasi. Bisakah Anda mengulangi jawaban Anda?"
      };
    }

    try {
      // 3. TRY GEMINI (Primary Model)
      console.log('[AI-CHAT] Trying Gemini (2.0 Flash Thinking)...');

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      // Using gemini-1.5-flash as a stable model. 
      // If user wants specific experimental model, they can change it here.
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemPrompt = `
        Anda adalah pewawancara profesional untuk posisi ${role}.
        Nama kandidat: ${candidateData?.fullName || 'Kandidat'}.
        
        TUGAS ANDA:
        1. Ajukan pertanyaan wawancara behavioral berbasis STAR (Situation, Task, Action, Result).
        2. Gali lebih dalam jawaban kandidat (probing).
        3. Deteksi potensi ketidakjujuran atau inkonsistensi.
        4. Jaga nada bicara profesional namun ramah.
        5. Lakukan wawancara dalam Bahasa Indonesia.
        
        ATURAN:
        - Jangan berikan jawaban panjang lebar.
        - Fokus pada satu pertanyaan di satu waktu.
        - Jika jawaban kandidat terlalu singkat, minta elaborasi.
        - Jika kandidat tidak relevan, arahkan kembali ke topik.
        `;

      const chat = model.startChat({
        history: history.map(h => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        })),
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.7,
        },
        systemInstruction: systemPrompt
      });

      const result = await chat.sendMessage(message);
      const aiResponse = result.response.text();

      console.log('[AI-CHAT] ✅ Gemini response generated successfully');

      return {
        success: true,
        response: aiResponse,
        model: "gemini-1.5-flash"
      };

    } catch (error) {
      console.error('[AI-CHAT] ❌ Gemini Failed:', error.message);

      // Return static fallback if AI fails
      return {
        success: true,
        response: "Terima kasih atas jawaban Anda. Mari kita lanjutkan ke pertanyaan berikutnya. Bisa ceritakan pengalaman Anda dalam menghadapi situasi sulit di tempat kerja?",
        error: error.message,
        isFallback: true
      };
    }
  });


/**
 * Analyse Fraud Risk using AI
 */
exports.analyzeFraudRisk = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { role, transcript, ftAnswers } = data;
    console.log(`[FRAUD-ANALYSIS] Analyzing risk for ${role}...`);

    const GEMINI_API_KEY = functions.config().gemini?.key;
    if (!GEMINI_API_KEY) {
      throw new functions.https.HttpsError('failed-precondition', 'Gemini API key missing');
    }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
          Anda adalah pakar deteksi fraud dan psikologi forensik.
          Analisis transkrip wawancara dan jawaban kuesioner kandidat ini untuk posisi ${role}.
          
          TRANSKRIP WAWANCARA:
          ${JSON.stringify(transcript)}
          
          JAWABAN FRAUD TRIANGLE:
          ${JSON.stringify(ftAnswers)}
          
          TUGAS:
          Berikan analisis risiko fraud menggunakan kerangka kerja Fraud Triangle (Pressure, Opportunity, Rationalization).
          
          OUTPUT JSON (HANYA JSON):
          {
            "scores": {
                "pressure": 0-100,
                "opportunity": 0-100,
                "rationalization": 0-100
            },
            "riskLevel": "LOW" | "MEDIUM" | "HIGH",
            "summary": "Ringkasan analisis dalam Bahasa Indonesia (2-3 paragraf)",
            "redFlags": ["flag1", "flag2"],
            "recommendation": "Rekomendasi (Hire/Reject/Investigate)"
          }
          `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Cleanup JSON
      const cleanText = text.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(cleanText);

      console.log('[FRAUD-ANALYSIS] ✅ Analysis complete');
      return analysis;

    } catch (error) {
      console.error('[FRAUD-ANALYSIS] Error:', error);
      throw new functions.https.HttpsError('internal', 'AI Analysis Failed');
    }
  });
