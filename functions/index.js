/**
 * BACKEND FRAUDGUARD SAAS
 * Lokasi: functions/index.js
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const https = require("https");

admin.initializeApp();
const db = getFirestore();

// ==========================================
// KONFIGURASI SMTP (WAJIB DIGANTI SEBELUM DEPLOY)
// ==========================================
const SMTP_CONFIG = {
  user: "email.anda@gmail.com",      // GANTI DENGAN EMAIL GMAIL ASLI ANDA
  pass: "xxxx xxxx xxxx xxxx"        // GANTI DENGAN APP PASSWORD (16 digit)
};

// KONFIGURASI EMAILJS (AMAN DI SERVER-SIDE)
const EMAILJS_CONFIG = {
  publicKey: "bclRHuJQwKQIOljiq",
  serviceId: "service_8o2nl6d",
  templateBusiness: "template_gfg2qr4",
  templateCandidate: "template_dvgrjda"
};
// ==========================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SMTP_CONFIG.user,
    pass: SMTP_CONFIG.pass
  }
});

/**
 * Fungsi: inviteCompany
 * Trigger: Frontend (ActiveInterview / AdminDashboard)
 * Deskripsi: Menyimpan data perusahaan ke Firestore & Mengirim Email Undangan
 * Region: europe-west1 (Sesuai dengan frontend)
 */
exports.inviteCompany = onCall({ region: "europe-west1" }, async (request) => {
  // 1. Ambil data dari Frontend
  const { name, adminEmail, tier } = request.data;

  // Validasi Input
  if (!name || !adminEmail) {
    throw new HttpsError('invalid-argument', 'Nama Perusahaan dan Email Admin wajib diisi.');
  }

  // Cek apakah email/password masih default (Pencegahan error)
  if (SMTP_CONFIG.pass.includes("xxxx")) {
     throw new HttpsError('failed-precondition', 'Server belum dikonfigurasi dengan App Password Gmail yang benar.');
  }

  try {
    console.log(`[START] Processing Invite for: ${name} (${adminEmail})`);

    // 2. Simpan ke Firestore (Server Side)
    const companyRef = db.collection("companies").doc();
    const companyData = {
      name: name,
      adminEmail: adminEmail,
      tier: tier || "Basic",
      status: "Pending", // Default pending sampai diaktivasi
      joinedDate: new Date().toISOString(),
      usersCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth ? request.auth.uid : 'system'
    };
    
    await companyRef.set(companyData);
    console.log(`[DB] Company saved with ID: ${companyRef.id}`);

    // 3. Kirim Email via Nodemailer
    const mailOptions = {
      from: `"FraudGuard Admin" <${SMTP_CONFIG.user}>`,
      to: adminEmail,
      subject: `Undangan Bergabung - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #CC5500; padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">FraudGuard SaaS</h2>
          </div>
          <div style="padding: 30px;">
            <h3 style="color: #333;">Selamat Datang, ${name}!</h3>
            <p style="color: #555; line-height: 1.6;">
              Akun Enterprise Anda telah berhasil didaftarkan di platform FraudGuard.
              Berikut adalah detail langganan Anda:
            </p>
            
            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Paket</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${tier}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; color: orange; font-weight: bold;">Menunggu Aktivasi</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Admin</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${adminEmail}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 30px;">
              <a href="https://fraudguard.id/login" style="background-color: #CC5500; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Masuk ke Dashboard</a>
            </div>
            
            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
              Email ini dikirim otomatis oleh sistem FraudGuard SaaS (Firebase Functions).
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent successfully to ${adminEmail}`);

    return { 
      success: true, 
      companyId: companyRef.id, 
      message: `Perusahaan ${name} berhasil didaftarkan dan email undangan telah dikirim ke ${adminEmail}.` 
    };

  } catch (error) {
    console.error("[ERROR] Invite Failed:", error);
    // Lempar error agar frontend tahu kalau gagal
    throw new HttpsError('internal', `Gagal memproses undangan: ${error.message}`);
  }
});

/**
 * Fungsi: sendEmailViaEmailJS
 * Trigger: Frontend (semua fitur yang butuh email)
 * Deskripsi: Mengirim email via EmailJS API secara aman dari server-side
 * Region: europe-west1 (Sesuai dengan frontend)
 */
exports.sendEmailViaEmailJS = onCall({ region: "europe-west1" }, async (request) => {
  const { type, to_email, to_name, data } = request.data;

  // Validasi Input
  if (!type || !to_email || !to_name) {
    throw new HttpsError('invalid-argument', 'Parameter type, to_email, dan to_name wajib diisi.');
  }

  try {
    console.log(`[EMAIL-START] Type: ${type}, To: ${to_email}, Name: ${to_name}`);
    console.log(`[EMAIL-DATA]`, JSON.stringify(data));

    // Pilih template berdasarkan type
    let templateId = EMAILJS_CONFIG.templateBusiness;
    if (type === "candidate") {
      templateId = EMAILJS_CONFIG.templateCandidate;
    } else if (type === "reset") {
      templateId = EMAILJS_CONFIG.templateBusiness; // Reset uses business template
    }

    console.log(`[EMAIL-TEMPLATE] Using template: ${templateId}`);

    // Prepare EmailJS payload
    const emailPayload = {
      service_id: EMAILJS_CONFIG.serviceId,
      template_id: templateId,
      user_id: EMAILJS_CONFIG.publicKey,
      template_params: {
        to_email: to_email,
        to_name: to_name,
        reply_to: to_email,  // Explicitly set reply_to
        ...data
      }
    };

    console.log(`[EMAIL-PAYLOAD] Service: ${EMAILJS_CONFIG.serviceId}, Template: ${templateId}`);
    console.log(`[EMAIL-PAYLOAD] Recipient: ${to_email}, Name: ${to_name}`);
    console.log(`[EMAIL-PAYLOAD] Full params:`, JSON.stringify(emailPayload.template_params));

    // Kirim via EmailJS REST API
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    console.log(`[EMAIL-RESPONSE] Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EMAIL-ERROR] EmailJS API Error: ${errorText}`);
      throw new Error(`EmailJS API Error (${response.status}): ${errorText}`);
    }

    const responseData = await response.text();
    console.log(`[EMAIL-SUCCESS] Response: ${responseData}`);
    console.log(`[EMAIL-DONE] Successfully sent to ${to_email}`);

    return {
      success: true,
      message: "Email berhasil dikirim",
      recipient: to_email
    };

  } catch (error) {
    console.error("[EMAIL-FAIL] Email sending failed:", error);
    console.error("[EMAIL-FAIL] Stack:", error.stack);

    // Return error dengan detail untuk debugging
    throw new HttpsError('internal', `Gagal mengirim email ke ${to_email}: ${error.message}`);
  }
});

/**
 * Fungsi: generateAIResponse
 * Trigger: Frontend (ActiveInterview)
 * Deskripsi: Generate respons AI untuk interview menggunakan Gemini API
 * Region: europe-west1
 */
exports.generateAIResponse = onCall({ region: "europe-west1" }, async (request) => {
  const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
  const functions = require("firebase-functions");

  // Get API keys from Firebase config
  // Set with: firebase functions:config:set gemini.key="YOUR_KEY" openai.key="YOUR_KEY"
  const GEMINI_API_KEY = functions.config().gemini?.key;
  const OPENAI_API_KEY = functions.config().openai?.key;

  console.log(`[AI-CONFIG] Gemini API Key present: ${!!GEMINI_API_KEY}`);
  console.log(`[AI-CONFIG] OpenAI API Key present: ${!!OPENAI_API_KEY}`);

  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    console.error('[AI-CONFIG] NO API KEYS CONFIGURED! Using static fallback.');
    throw new HttpsError('failed-precondition', 'API keys belum dikonfigurasi. Set dengan: firebase functions:config:set gemini.key="YOUR_KEY" openai.key="YOUR_KEY"');
  }

  const { role, history, lastUserMessage } = request.data;

  if (!role || !history || !lastUserMessage) {
    throw new HttpsError('invalid-argument', 'Parameter role, history, dan lastUserMessage wajib diisi.');
  }

  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');

  const prompt = `Anda adalah AI Interviewer profesional bernama "Alex" yang sedang melakukan wawancara untuk posisi ${role}.

Context percakapan sebelumnya:
${context}

Kandidat baru saja menjawab: "${lastUserMessage}"

TUGAS ANDA:
1. Berikan respons yang natural, ramah, dan conversational dalam Bahasa Indonesia
2. Jika perlu, mulai dengan acknowledgment singkat (misal: "Saya paham", "Menarik sekali", "Baik")
3. Kemudian lanjutkan dengan 1 pertanyaan follow-up yang:
   - Probing dan spesifik berdasarkan jawaban kandidat
   - Menggali integritas, etika kerja, dan pengalaman
   - Fokus pada situasi nyata dan contoh konkret
   - Natural seperti percakapan manusia, bukan robot

CONTOH RESPONS YANG BAIK:
"Saya paham situasinya. Ketika Anda menghadapi tekanan deadline seperti itu, apakah ada momen di mana Anda harus memilih antara kecepatan dan akurasi? Bagaimana Anda memutuskannya?"

PENTING:
- Response maksimal 2-3 kalimat
- Langsung to the point, tidak bertele-tele
- Hindari pertanyaan generic seperti "ceritakan lebih lanjut"
- Setelah 5-6 pertanyaan, akhiri dengan: "Terima kasih atas waktunya. Sesi wawancara telah selesai. Kami akan mengirimkan hasil assessment ke email Anda."`;


  // Try Gemini first
  if (GEMINI_API_KEY) {
    try {
      console.log(`[AI] Trying Gemini for role: ${role}`);

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ];

      // Use Gemini 2.0 Flash Thinking Experimental (Gemini "3" Preview)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-thinking-exp-1219",
        safetySettings
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let aiResponse = response.text();

      // Clean up response
      aiResponse = aiResponse.replace(/^AI:/i, "").replace(/^Interviewer:/i, "").trim();

      console.log(`[AI] Gemini response generated successfully`);

      return {
        success: true,
        response: aiResponse
      };

    } catch (geminiError) {
      console.error("[ERROR] Gemini failed:", {
        message: geminiError.message,
        stack: geminiError.stack,
        name: geminiError.name
      });
      console.log("[AI] Attempting OpenAI fallback...");
    }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      console.log(`[AI] Trying OpenAI fallback`);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "Anda adalah HR Interviewer profesional yang melakukan wawancara dalam Bahasa Indonesia." },
            { role: "user", content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const aiResponse = data.choices[0].message.content.trim();
        console.log(`[AI] OpenAI response generated successfully`);

        return {
          success: true,
          response: aiResponse
        };
      }

    } catch (openaiError) {
      console.error("[ERROR] OpenAI also failed:", {
        message: openaiError.message,
        stack: openaiError.stack
      });
    }
  }

  // Final fallback - static response
  console.error("[AI] ⚠️ ALL AI PROVIDERS FAILED! Using static fallback response.");
  console.error("[AI] This means BOTH Gemini and OpenAI are not working properly.");
  console.error("[AI] Check: 1) API Keys configured? 2) API Keys valid? 3) Quota exceeded?");

  return {
    success: true,
    response: "Terima kasih atas jawabannya. Bisa Anda ceritakan lebih lanjut mengenai bagaimana Anda menangani situasi penuh tekanan di pekerjaan sebelumnya?"
  };
});

/**
 * Fungsi: analyzeFraudRisk
 * Trigger: Frontend (ActiveInterview - saat interview selesai)
 * Deskripsi: Analisis risiko fraud menggunakan Gemini API
 * Region: europe-west1
 */
exports.analyzeFraudRisk = onCall({ region: "europe-west1" }, async (request) => {
  const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
  const functions = require("firebase-functions");

  // Get API keys from Firebase config
  const GEMINI_API_KEY = functions.config().gemini?.key;
  const OPENAI_API_KEY = functions.config().openai?.key;

  console.log(`[ANALYSIS-CONFIG] Gemini API Key present: ${!!GEMINI_API_KEY}`);
  console.log(`[ANALYSIS-CONFIG] OpenAI API Key present: ${!!OPENAI_API_KEY}`);

  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    console.error('[ANALYSIS-CONFIG] NO API KEYS CONFIGURED!');
    throw new HttpsError('failed-precondition', 'API keys belum dikonfigurasi. Set dengan: firebase functions:config:set gemini.key="YOUR_KEY" openai.key="YOUR_KEY"');
  }

  const { role, history, structuredAssessment, sjtResults } = request.data;

  if (!role || !history || !structuredAssessment) {
    throw new HttpsError('invalid-argument', 'Parameter role, history, dan structuredAssessment wajib diisi.');
  }

  const context = history.map(h => `${h.speaker.toUpperCase()}: ${h.text}`).join('\n');
  const assessmentSummary = structuredAssessment.map(item =>
    `[${item.category.toUpperCase()}] "${item.question}" -> Skor: ${item.response}`
  ).join('\n');

  const sjtSummary = (sjtResults || []).map(item =>
    `[SJT] Scen: "${item.scenario.substring(0,30)}..." -> Pilih: "${(item.options[item.selectedOptionIndex || 0] || {}).label}"`
  ).join('\n');

  const prompt = `SYSTEM: You are a Senior Fraud Analyst. Your response must be a valid JSON object only, without any markdown wrappers.
USER: Analyze the following data for candidate: ${role}.
SURVEY DATA:
${assessmentSummary}
${sjtSummary}
CHAT TRANSCRIPT:
${context}

TASK:
Provide a final verdict in Indonesian language. Output a JSON with these keys:
- "scores" (object with pressure, opportunity, rationalization from 0-100)
- "riskLevel" ("Low", "Medium", "High", "Critical")
- "summary" (2 paragraphs in Indonesian explaining the analysis)
- "redFlags" (string array in Indonesian listing concerning behaviors)
- "recommendation" (string in Indonesian with action recommendations)
- "consistencyScore" (0-100, measure consistency between survey and interview)
- "euphemismScore" (0-100, detect euphemistic language patterns)
- "sentimentBreakdown" (object with positive, neutral, negative percentages summing to 100)
- "benchmarkComparison" (object with candidateAvg, companyAvg 45-55, industryAvg 40-50 as baseline scores)`;

  // Try Gemini first
  if (GEMINI_API_KEY) {
    try {
      console.log(`[ANALYSIS] Trying Gemini for fraud analysis`);

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ];

      // Use Gemini 2.0 Flash Thinking Experimental (Gemini "3" Preview) for analysis
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-1219", safetySettings });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean and parse JSON
      text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
      const analysis = JSON.parse(text);

      console.log(`[ANALYSIS] Gemini analysis completed successfully`);

      return {
        success: true,
        analysis: analysis
      };

    } catch (geminiError) {
      console.error("[ERROR] Gemini analysis failed:", {
        message: geminiError.message,
        stack: geminiError.stack,
        name: geminiError.name
      });
      console.log("[ANALYSIS] Attempting OpenAI fallback...");
    }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      console.log(`[ANALYSIS] Trying OpenAI fallback for analysis`);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a Senior Fraud Analyst. Respond with valid JSON only." },
            { role: "user", content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.5
        })
      });

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        let text = data.choices[0].message.content.trim();
        text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
        const analysis = JSON.parse(text);

        console.log(`[ANALYSIS] OpenAI analysis completed successfully`);

        return {
          success: true,
          analysis: analysis
        };
      }

    } catch (openaiError) {
      console.error("[ERROR] OpenAI analysis also failed:", {
        message: openaiError.message,
        stack: openaiError.stack
      });
    }
  }

  // Final fallback - manual calculation
  console.error("[ANALYSIS] ⚠️ ALL AI PROVIDERS FAILED! Using manual fallback calculation.");
  console.error("[ANALYSIS] Check: 1) API Keys configured? 2) API Keys valid? 3) Quota exceeded?");
  const scores = { pressure: 50, opportunity: 50, rationalization: 50 };

  return {
    success: true,
    analysis: {
      scores: scores,
      riskLevel: "Medium",
      summary: "Analisis AI mengalami gangguan. Skor dihitung dari kuesioner. Mohon review manual transkrip.",
      redFlags: ["Analisis AI tidak tersedia - perlu review manual"],
      recommendation: "Lakukan review manual lengkap terhadap transkrip dan jawaban kandidat.",
      consistencyScore: 0,
      euphemismScore: 0,
      sentimentBreakdown: { positive: 33, neutral: 34, negative: 33 },
      benchmarkComparison: { candidateAvg: 50, companyAvg: 48, industryAvg: 45 }
    }
  };
});