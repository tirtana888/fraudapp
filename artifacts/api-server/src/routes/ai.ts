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

async function verifyJwtOrSession(req: Request, sessionId?: string): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ") && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const token = authHeader.slice(7);
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      });
      if (userRes.ok) return { ok: true };
    } catch {
      /* fall through */
    }
  }
  if (sessionId && (await verifySession(sessionId))) return { ok: true };
  return { ok: false, reason: "Unauthorized" };
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
  const supabase = getSupabase();
  const path = extractStoragePath(cvUrl);

  if (path) {
    const { data, error } = await supabase.storage.from("candidate-documents").download(path);
    if (error || !data) {
      logger.warn({ error, path }, "Failed to download CV via service key, falling back to direct fetch");
    } else {
      const buf = Buffer.from(await data.arrayBuffer());
      return { base64: buf.toString("base64"), mime: data.type || "application/pdf" };
    }
  }

  // Fallback: try fetching the URL directly
  try {
    const resp = await fetch(cvUrl);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const mime = resp.headers.get("content-type") || "application/pdf";
    return { base64: buf.toString("base64"), mime };
  } catch (err) {
    logger.error({ err }, "Direct CV fetch failed");
    return null;
  }
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

  const auth = await verifyJwtOrSession(req, sessionId);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    // Verify the cvUrl actually belongs to this session
    const supabase = getSupabase();
    const { data: sess } = await supabase
      .from("interview_sessions")
      .select("id, cvUrl")
      .eq("id", sessionId)
      .maybeSingle();
    if (!sess) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }
    if (sess.cvUrl && sess.cvUrl !== cvUrl) {
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
