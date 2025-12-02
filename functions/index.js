/**
 * BACKEND FRAUDGUARD SAAS
 * Lokasi: functions/index.js
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = getFirestore();

// ==========================================
// KONFIGURASI (WAJIB DIGANTI SEBELUM DEPLOY)
// ==========================================
const SMTP_CONFIG = {
  user: "email.anda@gmail.com",      // GANTI DENGAN EMAIL GMAIL ASLI ANDA
  pass: "xxxx xxxx xxxx xxxx"        // GANTI DENGAN APP PASSWORD (16 digit)
};

const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // GANTI dengan API Key Gemini yang aman
// ==========================================

// Initialize Gemini AI
let genAI = null;
if (GEMINI_API_KEY && !GEMINI_API_KEY.includes("YOUR_")) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

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

// ==========================================
// GEMINI AI ENDPOINTS
// ==========================================

/**
 * Fungsi: generateNextQuestion
 * Deskripsi: Generate pertanyaan interview berikutnya menggunakan Gemini AI
 */
exports.generateNextQuestion = onCall({ region: "europe-west1", maxInstances: 10 }, async (request) => {
  if (!genAI) {
    throw new HttpsError('failed-precondition', 'Gemini API belum dikonfigurasi di server');
  }

  const { candidateRole, chatHistory, tier, assessmentData } = request.data;

  if (!candidateRole || !chatHistory) {
    throw new HttpsError('invalid-argument', 'candidateRole dan chatHistory wajib diisi');
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const questionCount = chatHistory.filter(m => m.speaker === 'ai').length;
    const MAX_QUESTIONS = tier === 'Enterprise' ? 8 : tier === 'Premium' ? 5 : 3;

    if (questionCount >= MAX_QUESTIONS) {
      return {
        question: "Terima kasih atas partisipasi Anda. Sesi wawancara telah selesai. Kami akan menghubungi Anda segera.",
        isEnd: true
      };
    }

    const conversationContext = chatHistory.map(msg =>
      `${msg.speaker === 'ai' ? 'Interviewer' : 'Kandidat'}: ${msg.text}`
    ).join('\n');

    const prompt = `Anda adalah AI Interviewer profesional untuk posisi "${candidateRole}".

Konteks percakapan sejauh ini:
${conversationContext}

Data survei kandidat:
- Fraud Triangle: ${JSON.stringify(assessmentData?.structuredAssessment?.slice(0, 3) || [])}
- SJT: ${JSON.stringify(assessmentData?.sjtResults?.slice(0, 2) || [])}

Tugas Anda: Buat 1 pertanyaan follow-up yang:
1. Menggali lebih dalam red flag dari jawaban kandidat
2. Natural dan tidak menghakimi
3. Maksimal 2 kalimat
4. Spesifik ke konteks posisi dan jawaban sebelumnya

PENTING: Jawab HANYA dengan pertanyaan, tanpa penjelasan tambahan.`;

    const result = await model.generateContent(prompt);
    const nextQuestion = result.response.text().trim();

    return { question: nextQuestion, isEnd: false };

  } catch (error) {
    console.error("[ERROR] Generate Question Failed:", error);
    throw new HttpsError('internal', `Gagal generate pertanyaan: ${error.message}`);
  }
});

/**
 * Fungsi: analyzeFraudRisk
 * Deskripsi: Analisis risiko fraud kandidat menggunakan Gemini AI
 */
exports.analyzeFraudRisk = onCall({ region: "europe-west1", maxInstances: 5 }, async (request) => {
  if (!genAI) {
    throw new HttpsError('failed-precondition', 'Gemini API belum dikonfigurasi di server');
  }

  const { candidateRole, chatHistory, ftAnswers, sjtAnswers, tier } = request.data;

  if (!candidateRole || !chatHistory) {
    throw new HttpsError('invalid-argument', 'Data tidak lengkap');
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const conversationText = chatHistory.map(msg =>
      `${msg.speaker === 'ai' ? 'Interviewer' : 'Kandidat'}: ${msg.text}`
    ).join('\n');

    const prompt = `Anda adalah Fraud Risk Analyst profesional. Analisis kandidat untuk posisi "${candidateRole}".

DATA KANDIDAT:
1. Transkrip Wawancara:
${conversationText}

2. Fraud Triangle Survey (skala 1-5):
${JSON.stringify(ftAnswers || [])}

3. Situational Judgment Test:
${JSON.stringify(sjtAnswers || [])}

TUGAS: Buat analisis JSON dengan format PERSIS seperti ini:
{
  "scores": {
    "pressure": <angka 0-100>,
    "opportunity": <angka 0-100>,
    "rationalization": <angka 0-100>
  },
  "riskLevel": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "summary": "<ringkasan 2-3 kalimat>",
  "redFlags": ["<red flag 1>", "<red flag 2>", ...],
  "recommendation": "<rekomendasi aksi>"
}

PENTING:
- Jawab HANYA JSON, tanpa markdown atau penjelasan
- redFlags maksimal 5 item
- Basis analisis pada inkonsistensi, eufemisme, defensive behavior`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Clean markdown if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const analysis = JSON.parse(responseText);

    // Validate structure
    if (!analysis.scores || !analysis.riskLevel || !analysis.summary) {
      throw new Error('Invalid analysis structure');
    }

    return analysis;

  } catch (error) {
    console.error("[ERROR] Analyze Risk Failed:", error);

    // Fallback: manual scoring
    const manualScores = calculateManualScores(ftAnswers, sjtAnswers);
    return {
      scores: manualScores,
      riskLevel: determineRiskLevel(manualScores),
      summary: "Analisis manual berdasarkan skor survei (AI gagal).",
      redFlags: ["ANALISIS AI GAGAL"],
      recommendation: "Review manual diperlukan.",
      isManualFallback: true
    };
  }
});

// Helper functions
function calculateManualScores(ftAnswers, sjtAnswers) {
  const ftScores = { pressure: 0, opportunity: 0, rationalization: 0 };

  if (ftAnswers && ftAnswers.length > 0) {
    ftAnswers.forEach(item => {
      if (item.response && item.category) {
        const score = (item.response / 5) * 100;
        if (ftScores[item.category] !== undefined) {
          ftScores[item.category] = score;
        }
      }
    });
  }

  return ftScores;
}

function determineRiskLevel(scores) {
  const avg = (scores.pressure + scores.opportunity + scores.rationalization) / 3;
  if (avg > 75) return 'CRITICAL';
  if (avg > 50) return 'HIGH';
  if (avg > 30) return 'MEDIUM';
  return 'LOW';
}

// NOTE: Email blast menggunakan EmailJS di client-side (untuk paid tier)