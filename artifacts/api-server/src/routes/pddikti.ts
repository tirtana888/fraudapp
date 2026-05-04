import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const PDDIKTI_BASE = "https://api-pddikti.kemdiktisaintek.go.id";
const PDDIKTI_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Origin: "https://pddikti.kemdiktisaintek.go.id",
  Referer: "https://pddikti.kemdiktisaintek.go.id/",
};

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ── PDDikti API helpers ─────────────────────────────────────────────────────

interface PddiktiSearchResult {
  id: string;
  nama: string;
  nim: string;
  nama_pt: string;
  sinkatan_pt: string;
  nama_prodi: string;
}

interface PddiktiDetail {
  nama: string;
  nim: string;
  nama_pt: string;
  prodi: string;
  jenis_kelamin: string;
  jenjang: string;
  status_saat_ini: string;
  tanggal_masuk?: string;
  id_pt?: string;
  id_sms?: string;
  kode_pt?: string;
  kode_prodi?: string;
  jenis_daftar?: string;
}

async function searchMahasiswa(keyword: string): Promise<PddiktiSearchResult[]> {
  const url = `${PDDIKTI_BASE}/pencarian/mhs/${encodeURIComponent(keyword)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const resp = await fetch(url, {
      headers: PDDIKTI_HEADERS,
      signal: controller.signal,
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "PDDikti search failed");
      return [];
    }
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.error({ err }, "PDDikti search error");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function getDetailMahasiswa(
  studentId: string,
): Promise<PddiktiDetail | null> {
  const url = `${PDDIKTI_BASE}/detail/mhs/${encodeURIComponent(studentId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const resp = await fetch(url, {
      headers: PDDIKTI_HEADERS,
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    return (await resp.json()) as PddiktiDetail;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── AI matching via Gemini / DeepSeek ───────────────────────────────────────

interface AIMatchResult {
  bestMatchIndex: number;
  confidence: number;
  reasoning: string;
}

async function aiMatchStudent(
  candidateName: string,
  institution: string,
  degree: string,
  graduationYear: string,
  searchResults: PddiktiSearchResult[],
): Promise<AIMatchResult | null> {
  const providers: Array<{
    name: string;
    url: string;
    key: string | undefined;
    model: string;
  }> = [
    {
      name: "gemini",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: GEMINI_API_KEY,
      model: "gemini-3-flash-preview",
    },
    {
      name: "deepseek",
      url: "https://api.deepseek.com/chat/completions",
      key: DEEPSEEK_API_KEY,
      model: "deepseek-chat",
    },
  ];

  const candidatesList = searchResults
    .map(
      (r, i) =>
        `[${i}] Nama: "${r.nama}", NIM: "${r.nim}", PT: "${r.nama_pt}", Prodi: "${r.nama_prodi}"`,
    )
    .join("\n");

  const prompt = `Kamu adalah sistem verifikasi pendidikan. Analisa data berikut dan tentukan mahasiswa mana yang paling cocok.

DATA KANDIDAT DARI CV:
- Nama: "${candidateName}"
- Institusi/Universitas: "${institution}"
- Gelar/Jenjang: "${degree}"
- Tahun Lulus: "${graduationYear}"

HASIL PENCARIAN PDDIKTI:
${candidatesList}

TUGAS:
1. Cocokkan berdasarkan: nama terdekat (bisa singkatan, nama lengkap, gelar berbeda), institusi/PT terdekat, jurusan/prodi yang sesuai.
2. Jika ada kecocokan yang masuk akal, berikan index-nya.
3. Jika tidak ada yang cocok sama sekali, bestMatchIndex = -1.

RESPOND dalam JSON saja (tanpa markdown):
{"bestMatchIndex": <number>, "confidence": <0-100>, "reasoning": "<penjelasan singkat>"}`;

  for (const p of providers) {
    if (!p.key) continue;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetch(p.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 300,
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) continue;

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) continue;

      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as AIMatchResult;
      if (typeof parsed.bestMatchIndex === "number") {
        logger.info({ provider: p.name, confidence: parsed.confidence }, "AI match result");
        return parsed;
      }
    } catch (err) {
      logger.warn({ provider: p.name, err }, "AI match attempt failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

// ── JWT verification ────────────────────────────────────────────────────────

async function verifyJwt(
  req: Request,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return { ok: false };
  const token = authHeader.slice(7);
  try {
    const supabase = createClient(
      SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY!,
    );
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) return { ok: false };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false };
  }
}

// ── Exported helper: run verification without HTTP context ──────────────────
// Called from ai.ts after CV parsing to auto-verify in background.

export async function runPddiktiVerificationBackground(sessionId: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: sess } = await supabase
      .from("_interview_sessions")
      .select("id, company_id, candidate, cv_parsed_data")
      .eq("id", sessionId)
      .maybeSingle();

    if (!sess) return;

    const cvData = sess.cv_parsed_data as {
      fullName?: string;
      education?: Array<{ degree: string; institution: string; year: string }>;
    } | null;

    if (!cvData?.education?.length) return;

    const lastEdu = cvData.education[cvData.education.length - 1];
    const candidateName =
      cvData.fullName ||
      (sess.candidate as { name?: string } | null)?.name ||
      "";
    const institution = lastEdu.institution || "";
    const degree = lastEdu.degree || "";
    const gradYear = lastEdu.year || "";

    if (!candidateName) return;

    logger.info({ sessionId, candidateName, institution }, "Auto PDDikti verification after CV parse");

    const searchResults = await searchMahasiswa(candidateName);

    if (searchResults.length === 0) {
      await supabase
        .from("_interview_sessions")
        .update({
          pddikti_verification: {
            status: "not_found",
            verifiedAt: new Date().toISOString(),
            searchKeyword: candidateName,
            institution,
            degree,
            graduationYear: gradYear,
            matchedStudent: null,
            allMatches: [],
            aiAnalysis: null,
            error: null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      return;
    }

    const aiResult = await aiMatchStudent(candidateName, institution, degree, gradYear, searchResults);

    let status: string;
    let matchedStudent: PddiktiDetail | null = null;
    let bestMatch: PddiktiSearchResult | null = null;

    if (
      aiResult &&
      aiResult.bestMatchIndex >= 0 &&
      aiResult.bestMatchIndex < searchResults.length &&
      aiResult.confidence >= 60
    ) {
      bestMatch = searchResults[aiResult.bestMatchIndex];
      matchedStudent = await getDetailMahasiswa(bestMatch.id);
      status = "verified";
    } else if (aiResult && aiResult.bestMatchIndex === -1) {
      status = "not_found";
    } else {
      status = "multiple_matches";
    }

    await supabase
      .from("_interview_sessions")
      .update({
        pddikti_verification: {
          status,
          verifiedAt: new Date().toISOString(),
          searchKeyword: candidateName,
          institution,
          degree,
          graduationYear: gradYear,
          matchedStudent: matchedStudent && bestMatch
            ? {
                id: bestMatch.id,
                nama: matchedStudent.nama?.trim(),
                nim: matchedStudent.nim?.trim(),
                nama_pt: matchedStudent.nama_pt?.trim(),
                prodi: matchedStudent.prodi?.trim(),
                jenjang: matchedStudent.jenjang?.trim(),
                status_saat_ini: matchedStudent.status_saat_ini?.trim(),
                tanggal_masuk: matchedStudent.tanggal_masuk || null,
              }
            : null,
          allMatches: searchResults.slice(0, 20).map((r) => ({
            id: r.id,
            nama: r.nama,
            nim: r.nim,
            nama_pt: r.nama_pt,
            nama_prodi: r.nama_prodi,
          })),
          aiAnalysis: aiResult
            ? {
                confidence: aiResult.confidence,
                reasoning: aiResult.reasoning,
                bestMatchIndex: aiResult.bestMatchIndex,
              }
            : null,
          error: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    logger.info({ sessionId, status }, "Auto PDDikti verification complete");
  } catch (err) {
    logger.error({ err, sessionId }, "Auto PDDikti verification failed (non-fatal)");
  }
}

// ── POST /api/pddikti/verify-nim ────────────────────────────────────────────

router.post("/verify-nim", async (req: Request, res: Response) => {
  const { sessionId } = req.body as { sessionId?: string };

  if (!sessionId) {
    res.status(400).json({ success: false, error: "sessionId required" });
    return;
  }

  // Auth: require JWT
  const auth = await verifyJwt(req);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const supabase = getSupabase();

    // Load session + parsed CV data
    const { data: sess } = await supabase
      .from("_interview_sessions")
      .select("id, company_id, candidate, cv_parsed_data, pddikti_verification")
      .eq("id", sessionId)
      .maybeSingle();

    if (!sess) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    const cvData = sess.cv_parsed_data as {
      fullName?: string;
      education?: Array<{ degree: string; institution: string; year: string }>;
    } | null;

    if (!cvData?.education?.length) {
      res.status(400).json({
        success: false,
        error: "CV belum di-parse atau tidak memiliki data pendidikan",
      });
      return;
    }

    // Take last education entry (pendidikan terakhir)
    const lastEdu = cvData.education[cvData.education.length - 1];
    const candidateName =
      cvData.fullName ||
      (sess.candidate as { name?: string } | null)?.name ||
      "";
    const institution = lastEdu.institution || "";
    const degree = lastEdu.degree || "";
    const gradYear = lastEdu.year || "";

    if (!candidateName) {
      res.status(400).json({
        success: false,
        error: "Nama kandidat tidak tersedia",
      });
      return;
    }

    logger.info(
      { sessionId, candidateName, institution },
      "Starting PDDikti NIM verification",
    );

    // 1. Search PDDikti by candidate name
    const searchResults = await searchMahasiswa(candidateName);

    if (searchResults.length === 0) {
      const verification = {
        status: "not_found" as const,
        verifiedAt: new Date().toISOString(),
        searchKeyword: candidateName,
        institution,
        degree,
        graduationYear: gradYear,
        matchedStudent: null,
        allMatches: [],
        aiAnalysis: null,
        error: null,
      };

      await supabase
        .from("_interview_sessions")
        .update({
          pddikti_verification: verification,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      res.json({ success: true, verification });
      return;
    }

    // 2. Use AI to find best match
    const aiResult = await aiMatchStudent(
      candidateName,
      institution,
      degree,
      gradYear,
      searchResults,
    );

    let status: string;
    let matchedStudent: PddiktiDetail | null = null;
    let bestMatch: PddiktiSearchResult | null = null;

    if (
      aiResult &&
      aiResult.bestMatchIndex >= 0 &&
      aiResult.bestMatchIndex < searchResults.length &&
      aiResult.confidence >= 60
    ) {
      bestMatch = searchResults[aiResult.bestMatchIndex];
      // 3. Get full detail
      matchedStudent = await getDetailMahasiswa(bestMatch.id);
      status = "verified";
    } else if (aiResult && aiResult.bestMatchIndex === -1) {
      status = "not_found";
    } else {
      status = "multiple_matches";
    }

    const verification = {
      status,
      verifiedAt: new Date().toISOString(),
      searchKeyword: candidateName,
      institution,
      degree,
      graduationYear: gradYear,
      matchedStudent: matchedStudent
        ? {
            id: bestMatch!.id,
            nama: matchedStudent.nama?.trim(),
            nim: matchedStudent.nim?.trim(),
            nama_pt: matchedStudent.nama_pt?.trim(),
            prodi: matchedStudent.prodi?.trim(),
            jenjang: matchedStudent.jenjang?.trim(),
            status_saat_ini: matchedStudent.status_saat_ini?.trim(),
            tanggal_masuk: matchedStudent.tanggal_masuk || null,
          }
        : null,
      allMatches: searchResults.slice(0, 20).map((r) => ({
        id: r.id,
        nama: r.nama,
        nim: r.nim,
        nama_pt: r.nama_pt,
        nama_prodi: r.nama_prodi,
      })),
      aiAnalysis: aiResult
        ? {
            confidence: aiResult.confidence,
            reasoning: aiResult.reasoning,
            bestMatchIndex: aiResult.bestMatchIndex,
          }
        : null,
      error: null,
    };

    await supabase
      .from("_interview_sessions")
      .update({
        pddikti_verification: verification,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    logger.info({ sessionId, status, confidence: aiResult?.confidence }, "PDDikti verification complete");
    res.json({ success: true, verification });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "verify-nim error");
    res.status(500).json({ success: false, error: message });
  }
});

// ── POST /api/pddikti/select-match ──────────────────────────────────────────
// HR manually selects the correct match from multiple results

router.post("/select-match", async (req: Request, res: Response) => {
  const { sessionId, matchId } = req.body as {
    sessionId?: string;
    matchId?: string;
  };

  if (!sessionId || !matchId) {
    res
      .status(400)
      .json({ success: false, error: "sessionId and matchId required" });
    return;
  }

  const auth = await verifyJwt(req);
  if (!auth.ok) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: sess } = await supabase
      .from("_interview_sessions")
      .select("id, pddikti_verification")
      .eq("id", sessionId)
      .maybeSingle();

    if (!sess) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    const detail = await getDetailMahasiswa(matchId);
    if (!detail) {
      res
        .status(404)
        .json({ success: false, error: "Data mahasiswa tidak ditemukan di PDDikti" });
      return;
    }

    const prev = (sess.pddikti_verification || {}) as Record<string, unknown>;
    const verification = {
      ...prev,
      status: "verified",
      verifiedAt: new Date().toISOString(),
      matchedStudent: {
        id: matchId,
        nama: detail.nama?.trim(),
        nim: detail.nim?.trim(),
        nama_pt: detail.nama_pt?.trim(),
        prodi: detail.prodi?.trim(),
        jenjang: detail.jenjang?.trim(),
        status_saat_ini: detail.status_saat_ini?.trim(),
        tanggal_masuk: detail.tanggal_masuk || null,
      },
    };

    await supabase
      .from("_interview_sessions")
      .update({
        pddikti_verification: verification,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    res.json({ success: true, verification });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "select-match error");
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
