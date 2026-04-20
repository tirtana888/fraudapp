import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function verifySession(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    return !!(data && !error);
  } catch {
    return false;
  }
}

type AuthResult =
  | { ok: true; kind: "jwt"; userId: string }
  | { ok: true; kind: "session" }
  | { ok: false; reason: string };

async function verifyJwtOrSession(req: Request, sessionId?: string): Promise<AuthResult> {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ") && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const token = authHeader.slice(7);
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (userRes.ok) {
        const u = await userRes.json() as { id?: string };
        if (u?.id) return { ok: true, kind: "jwt", userId: u.id };
      }
    } catch {
      /* fall through */
    }
  }
  if (sessionId && (await verifySession(sessionId))) return { ok: true, kind: "session" };
  return { ok: false, reason: "Unauthorized" };
}

async function getUserCompanyId(userId: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("_users")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    return (data?.company_id as string) ?? null;
  } catch {
    return null;
  }
}

// ─── POST /api/ai/interview-question ─────────────────────────────────────────

router.post("/interview-question", async (req: Request, res: Response) => {
  const { sessionId, role, history, assessmentData } = req.body as {
    sessionId?: string;
    role: string;
    history: Array<{ speaker: string; text: string }>;
    assessmentData?: Record<string, unknown>;
  };

  if (!role || !Array.isArray(history)) {
    res.status(400).json({ success: false, error: "role and history required" });
    return;
  }

  const auth = await verifyJwtOrSession(req, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: auth.reason || "Unauthorized" });
    return;
  }

  if (!OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY not configured");
    res.status(503).json({ success: false, error: "AI service not configured" });
    return;
  }

  const candidateTurnCount = history.filter(h => h.speaker === "candidate" || h.speaker === "user").length;
  if (candidateTurnCount >= 25) {
    res.json({
      success: true,
      question: "Terima kasih atas semua jawaban Anda. Sesi wawancara telah selesai.",
      done: true,
    });
    return;
  }

  const systemPrompt = `Anda adalah AI Forensic Interviewer untuk posisi "${role}".
TUJUAN: Validasi integritas kandidat dan deteksi indikator fraud (tekanan finansial, rasionalisasi, peluang).

ATURAN WAJIB:
1. JAWAB HANYA DENGAN SATU PERTANYAAN DALAM BAHASA INDONESIA. Tidak ada label, prefix, atau penjelasan.
2. Pertanyaan harus relevan dengan jawaban kandidat sebelumnya, bukan pertanyaan generik.
3. Jika kandidat menjawab terlalu singkat ("ya", "tidak", "bisa"), minta penjelasan atau contoh konkret.
4. Jika kandidat bingung ("tentang apa?", "maksudnya?"), klarifikasi konteks dengan bahasa sederhana lalu tanya ulang.
5. Gali perilaku (behavioral) atau situasi spesifik. Hindari pertanyaan abstrak.
6. Jangan tanya hal yang sudah dijawab dengan jelas sebelumnya.
7. Maksimal 1-2 kalimat. Profesional, tidak menghakimi.`;

  const recentHistory = history.slice(-12);
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const turn of recentHistory) {
    const speaker = turn.speaker?.toLowerCase();
    messages.push({
      role: speaker === "ai" ? "assistant" : "user",
      content: turn.text,
    });
  }
  if (assessmentData) {
    messages.push({
      role: "system",
      content: `Konteks hasil assessment kandidat (gunakan untuk menargetkan pertanyaan): ${JSON.stringify(assessmentData).slice(0, 1500)}`,
    });
  }
  messages.push({
    role: "user",
    content: "Berikan satu pertanyaan tindak lanjut berikutnya berdasarkan transkrip di atas.",
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.75,
        max_tokens: 200,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error({ status: response.status, errText }, "OpenAI error");
      const status = response.status === 429 ? 429 : 502;
      res.status(status).json({
        success: false,
        error: response.status === 429 ? "Rate limit terlampaui, coba lagi sebentar." : "AI provider error",
      });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    let question = data.choices?.[0]?.message?.content?.trim() ?? "";
    question = question.replace(/^(AI|Interviewer|Assistant)\s*:\s*/i, "").replace(/^["']|["']$/g, "").trim();

    if (!question) {
      res.status(502).json({ success: false, error: "Empty AI response" });
      return;
    }

    res.json({ success: true, question, done: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ message }, "interview-question error");
    res.status(500).json({ success: false, error: message });
  }
});

// ─── POST /api/ai/fraud-analysis ─────────────────────────────────────────────

router.post("/fraud-analysis", async (req: Request, res: Response) => {
  const { sessionId, role, transcript, ftAnswers, sjtAnswers, finAnswers, tier } = req.body as {
    sessionId?: string;
    role: string;
    transcript: Array<{ speaker: string; text: string }>;
    ftAnswers?: unknown;
    sjtAnswers?: unknown;
    finAnswers?: unknown;
    tier?: string;
  };

  if (!role || !Array.isArray(transcript)) {
    res.status(400).json({ success: false, error: "role and transcript required" });
    return;
  }

  const auth = await verifyJwtOrSession(req, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: auth.reason || "Unauthorized" });
    return;
  }

  if (!OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY not configured");
    res.status(503).json({ success: false, error: "AI service not configured" });
    return;
  }

  const ftArr = Array.isArray(ftAnswers) ? ftAnswers as Array<Record<string, unknown>> : [];
  const sjtArr = Array.isArray(sjtAnswers) ? sjtAnswers as Array<Record<string, unknown>> : [];
  const finArr = Array.isArray(finAnswers) ? finAnswers as Array<Record<string, unknown>> : [];

  const ftSummary = ftArr
    .map(item => `[${String(item.category ?? "").toUpperCase()}] "${String(item.question ?? "").slice(0, 200)}" -> Skor: ${String(item.response ?? "n/a")}`)
    .join("\n");
  const finSummary = finArr
    .map(item => `[FINANCIAL_STRAIN] "${String(item.question ?? "").slice(0, 200)}" -> Skor: ${String(item.response ?? "n/a")}`)
    .join("\n");
  const sjtSummary = sjtArr
    .map(item => {
      const opts = Array.isArray(item.options) ? item.options as Array<Record<string, unknown>> : [];
      const idx = typeof item.selectedOptionIndex === "number" ? item.selectedOptionIndex : -1;
      const chosen = idx >= 0 && opts[idx] ? `${String(opts[idx].label ?? "")} (risk=${String(opts[idx].riskWeight ?? "")})` : "Tidak dijawab";
      return `[SJT] "${String(item.scenario ?? "").slice(0, 200)}" -> Pilih: ${chosen}`;
    })
    .join("\n");

  const transcriptText = transcript
    .slice(-40)
    .map(t => `${(t.speaker || "").toUpperCase()}: ${t.text}`)
    .join("\n");

  const systemPrompt = `Anda adalah Senior Fraud Analyst untuk proses rekrutmen.
Tugas Anda: berikan analisis risiko fraud berbasis Fraud Triangle (Pressure, Opportunity, Rationalization) untuk seorang kandidat.
WAJIB membalas dengan JSON valid (tanpa markdown), dalam Bahasa Indonesia, mengikuti skema yang diminta.`;

  const userPrompt = `Posisi yang dilamar: ${role}
Tier perusahaan: ${tier || "Freemium"}

DATA SURVEY FRAUD TRIANGLE:
${ftSummary || "(tidak ada)"}

DATA FINANCIAL STRAIN:
${finSummary || "(tidak ada)"}

DATA SITUATIONAL JUDGMENT TEST:
${sjtSummary || "(tidak ada)"}

TRANSKRIP WAWANCARA AI (terakhir 40 turn):
${transcriptText || "(tidak ada)"}

Hasilkan JSON dengan struktur PERSIS berikut:
{
  "scores": { "pressure": <0-100>, "opportunity": <0-100>, "rationalization": <0-100> },
  "riskLevel": "Low" | "Medium" | "High" | "Critical",
  "summary": "<2 paragraf analisis terintegrasi dalam Bahasa Indonesia>",
  "redFlags": ["<red flag spesifik dari jawaban kandidat>", ...],
  "recommendation": "<rekomendasi tindakan konkret untuk recruiter>",
  "consistencyScore": <0-100, konsistensi antara survey dan wawancara>,
  "euphemismScore": <0-100, deteksi pola bahasa eufemistis>,
  "sentimentBreakdown": { "positive": <0-100>, "neutral": <0-100>, "negative": <0-100> },
  "benchmarkComparison": { "candidateAvg": <rata-rata skor kandidat>, "companyAvg": 48, "industryAvg": 45 }
}

Skor harus mencerminkan transkrip dan jawaban yang sebenarnya, BUKAN nilai default 50/50/50.
Red flags dan rekomendasi harus spesifik mengacu pada apa yang kandidat katakan.
sentimentBreakdown.positive + neutral + negative harus berjumlah 100.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error({ status: response.status, errText: errText.slice(0, 500) }, "OpenAI fraud-analysis error");
      const status = response.status === 429 ? 429 : 502;
      res.status(status).json({
        success: false,
        error: response.status === 429 ? "Rate limit terlampaui, coba lagi sebentar." : "AI provider error",
      });
      return;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ success: false, error: "Empty AI response" });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (err) {
        logger.error({ err, contentSample: content.slice(0, 300) }, "Failed to parse fraud-analysis JSON");
        res.status(502).json({ success: false, error: "Invalid AI JSON response" });
        return;
      }
    }

    if (!parsed || typeof parsed !== "object" || !parsed.scores) {
      res.status(502).json({ success: false, error: "AI response missing required fields" });
      return;
    }

    const clamp = (n: unknown, lo = 0, hi = 100): number => {
      const v = Number(n);
      if (!Number.isFinite(v)) return lo;
      return Math.max(lo, Math.min(hi, Math.round(v)));
    };
    const validLevels = new Set(["Low", "Medium", "High", "Critical"]);
    const rawLevel = String((parsed as Record<string, unknown>).riskLevel ?? "");
    const normalizedLevel = rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1).toLowerCase();
    const scoresIn = (parsed.scores ?? {}) as Record<string, unknown>;
    const sentiIn = ((parsed as Record<string, unknown>).sentimentBreakdown ?? {}) as Record<string, unknown>;
    let pos = clamp(sentiIn.positive);
    let neu = clamp(sentiIn.neutral);
    let neg = clamp(sentiIn.negative);
    const sentiSum = pos + neu + neg;
    if (sentiSum === 0) { pos = 33; neu = 34; neg = 33; }
    else if (sentiSum !== 100) {
      pos = Math.round((pos / sentiSum) * 100);
      neu = Math.round((neu / sentiSum) * 100);
      neg = 100 - pos - neu;
    }
    const benchIn = ((parsed as Record<string, unknown>).benchmarkComparison ?? {}) as Record<string, unknown>;

    const safeAnalysis = {
      scores: {
        pressure: clamp(scoresIn.pressure),
        opportunity: clamp(scoresIn.opportunity),
        rationalization: clamp(scoresIn.rationalization),
      },
      riskLevel: validLevels.has(normalizedLevel) ? normalizedLevel : "Medium",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.filter(f => typeof f === "string") : [],
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "",
      consistencyScore: clamp((parsed as Record<string, unknown>).consistencyScore),
      euphemismScore: clamp((parsed as Record<string, unknown>).euphemismScore),
      sentimentBreakdown: { positive: pos, neutral: neu, negative: neg },
      benchmarkComparison: {
        candidateAvg: clamp(benchIn.candidateAvg),
        companyAvg: clamp(benchIn.companyAvg ?? 48),
        industryAvg: clamp(benchIn.industryAvg ?? 45),
      },
    };

    res.json({ success: true, analysis: safeAnalysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ message }, "fraud-analysis error");
    res.status(500).json({ success: false, error: message });
  }
});

// ─── POST /api/ai/parse-cv ───────────────────────────────────────────────────
//
// Downloads the CV PDF from Supabase Storage using the service key,
// runs Mistral OCR, then asks Mistral chat to extract structured fields,
// and saves the result to interview_sessions.cv_parsed_data.

function extractStoragePath(cvUrl: string): string | null {
  // Format: https://{project}.supabase.co/storage/v1/object/public/candidate-documents/{path}
  // Or:     https://{project}.supabase.co/storage/v1/object/sign/candidate-documents/{path}?token=...
  const match = cvUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/candidate-documents\/([^?]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

async function downloadCvAsBase64(cvUrl: string): Promise<{ base64: string; mime: string } | null> {
  const path = extractStoragePath(cvUrl);
  if (!path) {
    logger.warn({ cvUrl: cvUrl.slice(0, 120) }, "CV URL is not a candidate-documents storage URL — refusing to fetch");
    return null;
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from("candidate-documents").download(path);
  if (error || !data) {
    logger.error({ error, path }, "Failed to download CV from candidate-documents bucket");
    return null;
  }
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), mime: data.type || "application/pdf" };
}

async function mistralOcr(base64: string, mime: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: `data:${mime};base64,${base64}`,
        },
        include_image_base64: false,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error({ status: response.status, errText: errText.slice(0, 500) }, "Mistral OCR error");
      return null;
    }
    const data = await response.json() as { pages?: Array<{ markdown?: string; text?: string }> };
    const pages = data.pages || [];
    const text = pages.map(p => p.markdown || p.text || "").join("\n\n").trim();
    return text || null;
  } catch (err) {
    logger.error({ err }, "mistralOcr exception");
    return null;
  }
}

async function mistralStructure(rawText: string): Promise<Record<string, unknown> | null> {
  const prompt = `Anda adalah ekstraktor data CV. Dari teks CV berikut, kembalikan JSON valid dengan persis kunci ini (gunakan string kosong/array kosong jika tidak ada): {
  "fullName": string,
  "email": string,
  "phone": string,
  "address": string,
  "summary": string,
  "experience": [{ "title": string, "company": string, "duration": string, "description": string }],
  "education": [{ "degree": string, "institution": string, "year": string }],
  "skills": [string],
  "certifications": [string],
  "languages": [string]
}

JANGAN tambahkan komentar, penjelasan, atau markdown wrapper. KEMBALIKAN HANYA JSON.

TEKS CV:
${rawText.slice(0, 25_000)}`;

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error({ status: response.status, errText: errText.slice(0, 500) }, "Mistral chat error");
      return null;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      return JSON.parse(cleaned);
    }
  } catch (err) {
    logger.error({ err }, "mistralStructure exception");
    return null;
  }
}

router.post("/parse-cv", async (req: Request, res: Response) => {
  const { sessionId, cvUrl } = req.body as { sessionId: string; cvUrl: string };

  if (!sessionId || !cvUrl) {
    res.status(400).json({ success: false, error: "sessionId and cvUrl required" });
    return;
  }

  if (!MISTRAL_API_KEY) {
    res.status(503).json({ success: false, error: "CV parsing service not configured" });
    return;
  }

  // Two callers are permitted:
  //  1. Recruiter dashboard (JWT) — allowed any time, must own the session's company.
  //  2. Public application flow (sessionId only) — allowed exactly once, only if no
  //     parsed data exists yet. This is the auto-parse triggered right after a
  //     candidate uploads a CV through the public job page.
  const auth = await verifyJwtOrSession(req, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    // Load the session from the base table (not the view) and verify tenant ownership.
    const supabase = getSupabase();
    const { data: sess } = await supabase
      .from("_interview_sessions")
      .select("id, company_id, cv_url, cv_parsed_data")
      .eq("id", sessionId)
      .maybeSingle();
    if (!sess) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    if (auth.kind === "jwt") {
      const userCompanyId = await getUserCompanyId(auth.userId);
      if (!userCompanyId || userCompanyId !== sess.company_id) {
        logger.warn({ userId: auth.userId, sessionCompany: sess.company_id }, "Cross-tenant CV parse attempt blocked");
        res.status(403).json({ success: false, error: "You do not have access to this candidate" });
        return;
      }
    } else {
      // Session-only callers (public flow) can only trigger an initial parse.
      if (sess.cv_parsed_data) {
        res.status(403).json({ success: false, error: "CV already parsed for this session" });
        return;
      }
    }

    // The cvUrl in the request must match the one stored on the session
    // (prevents callers from parsing arbitrary URLs).
    if (!sess.cv_url || sess.cv_url !== cvUrl) {
      res.status(403).json({ success: false, error: "cvUrl does not match session" });
      return;
    }

    const downloaded = await downloadCvAsBase64(cvUrl);
    if (!downloaded) {
      res.status(422).json({ success: false, error: "Tidak bisa mengunduh dokumen CV" });
      return;
    }

    const ocrText = await mistralOcr(downloaded.base64, downloaded.mime);
    if (!ocrText || ocrText.length < 30) {
      res.status(422).json({
        success: false,
        error: "Tidak ada teks yang bisa diekstrak dari dokumen. Pastikan CV bukan hasil scan rendah resolusi.",
      });
      return;
    }

    const parsed = await mistralStructure(ocrText);
    if (!parsed) {
      res.status(502).json({ success: false, error: "Gagal menstruktur data CV" });
      return;
    }

    const finalData = { ...parsed, rawText: ocrText.slice(0, 50_000) };

    const { error: updateErr } = await supabase
      .from("_interview_sessions")
      .update({ cv_parsed_data: finalData, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updateErr) {
      logger.error({ updateErr }, "Failed to save cv_parsed_data");
      res.status(500).json({ success: false, error: "Gagal menyimpan hasil parsing" });
      return;
    }

    logger.info({ sessionId }, "CV parsed successfully");
    res.json({ success: true, parsedData: finalData });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "parse-cv error");
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
