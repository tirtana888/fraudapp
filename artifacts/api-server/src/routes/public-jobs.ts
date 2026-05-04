import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// GET /api/public-jobs/company/:slug
router.get("/company/:slug", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug ?? "");
    const supabase = getSupabase();

    // 1. Try by companySlug field
    const { data: bySlug } = await supabase
      .from("companies")
      .select("*")
      .eq("companySlug", slug)
      .single();
    if (bySlug) {
      res.json({ success: true, company: bySlug });
      return;
    }

    // 2. Try by ID
    const { data: byId } = await supabase
      .from("companies")
      .select("*")
      .eq("id", slug)
      .single();
    if (byId) {
      res.json({ success: true, company: byId });
      return;
    }

    // 3. Try by name slug
    const { data: allCompanies } = await supabase
      .from("companies")
      .select("*");
    const match = (allCompanies || []).find((c: Record<string, unknown>) => {
      const nameSlug = (String(c.name || ""))
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      return nameSlug === slug.toLowerCase();
    });

    if (match) {
      res.json({ success: true, company: match });
      return;
    }

    res.status(404).json({ success: false, error: "Company not found" });
  } catch (err) {
    logger.error({ err }, "public-jobs: company lookup failed");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /api/public-jobs/company/:companyId/jobs
router.get(
  "/company/:companyId/jobs",
  async (req: Request, res: Response) => {
    try {
      const companyId = String(req.params.companyId ?? "");
      const supabase = getSupabase();

      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("companyId", companyId)
        .eq("status", "Active");

      if (error) {
        logger.error({ err: error }, "public-jobs: jobs listing failed");
        res.status(500).json({ success: false, error: "Failed to load jobs" });
        return;
      }

      res.json({ success: true, jobs: jobs || [] });
    } catch (err) {
      logger.error({ err }, "public-jobs: jobs listing failed");
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
);

// GET /api/public-jobs/company/:companyId/job/:jobSlug
router.get(
  "/company/:companyId/job/:jobSlug",
  async (req: Request, res: Response) => {
    try {
      const companyId = String(req.params.companyId ?? "");
      const jobSlug = String(req.params.jobSlug ?? "");
      const supabase = getSupabase();

      // Try by slug field
      const { data: bySlug } = await supabase
        .from("jobs")
        .select("*")
        .eq("companyId", companyId)
        .eq("slug", jobSlug)
        .single();

      if (bySlug) {
        res.json({ success: true, job: bySlug });
        return;
      }

      // Fallback: match by generated slug from title
      const { data: allJobs } = await supabase
        .from("jobs")
        .select("*")
        .eq("companyId", companyId);

      const match = (allJobs || []).find((j: Record<string, unknown>) => {
        const titleSlug = (String(j.title || ""))
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        return titleSlug === jobSlug.toLowerCase();
      });

      if (match) {
        res.json({ success: true, job: match });
        return;
      }

      res.status(404).json({ success: false, error: "Job not found" });
    } catch (err) {
      logger.error({ err }, "public-jobs: job lookup failed");
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },
);

// POST /api/public-jobs/apply
// Creates application + interview session using the service key (bypasses RLS).
router.post("/apply", async (req: Request, res: Response) => {
  try {
    const {
      jobId,
      companyId,
      fullName,
      email,
      whatsapp,
      cvUrl,
      accessCode,
      enableInstantAssessment,
      origin: clientOrigin,
    } = req.body;

    if (!jobId || !companyId || !fullName || !email) {
      res
        .status(400)
        .json({ success: false, error: "jobId, companyId, fullName, and email are required" });
      return;
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    // --- 1. Insert application ---------------------------------------------------
    // Column names match toSnakeCaseApplicationRow in frontend:
    //   fullName → candidate_name, email → candidate_email,
    //   whatsapp → candidate_whatsapp, accessCode is NOT stored in _applications
    const appPayload: Record<string, unknown> = {
      job_id: jobId,
      company_id: companyId,
      candidate_name: fullName,
      candidate_email: email,
      candidate_whatsapp: whatsapp || null,
      cv_url: cvUrl || null,
      status: "Pending",
      applied_at: now,
    };

    const { data: appRow, error: appErr } = await supabase
      .from("_applications")
      .insert(appPayload)
      .select("id")
      .single();

    if (appErr) {
      logger.error({ err: appErr }, "public-jobs/apply: insert application failed");
      res.status(500).json({ success: false, error: appErr.message });
      return;
    }

    const applicationId: string = appRow.id;

    // --- 2. Read job metadata for workflow / instant assessment --------------------
    const { data: jobData } = await supabase
      .from("jobs")
      .select("workflowId, enableInstantAssessment, title")
      .eq("id", jobId)
      .single();

    const shouldInstantAssess =
      enableInstantAssessment ?? jobData?.enableInstantAssessment ?? false;
    const sessionStatus = shouldInstantAssess ? "active" : "pending_review";

    // --- 3. Build timeline --------------------------------------------------------
    type TimelineEntry = {
      stage: string;
      status: "completed" | "current" | "pending";
      date: string;
      note: string;
      credits?: number;
      isMandatory?: boolean;
    };

    const timeline: TimelineEntry[] = [
      { stage: "applied", status: "completed", date: now, note: "Kandidat melamar via Job Portal" },
      { stage: "cv_uploaded", status: "completed", date: now, note: "CV berhasil diunggah" },
    ];

    let workflowId: string | null = null;

    if (jobData?.workflowId) {
      workflowId = jobData.workflowId;
      const { data: wfDoc } = await supabase
        .from("workflows")
        .select("steps")
        .eq("id", workflowId)
        .single();

      if (wfDoc?.steps && Array.isArray(wfDoc.steps)) {
        const sorted = [...wfDoc.steps].sort(
          (a: Record<string, number>, b: Record<string, number>) => a.order - b.order,
        );
        sorted.forEach((step: Record<string, unknown>, idx: number) => {
          timeline.push({
            stage: step.id as string,
            status: idx === 0 ? "current" : "pending",
            date: now,
            note: (step.description as string) || "",
            credits: step.credits as number | undefined,
            isMandatory: step.isMandatory as boolean | undefined,
          });
        });
      }
    }

    if (timeline.length === 2) {
      timeline.push({
        stage: "screening",
        status: "current",
        date: now,
        note: shouldInstantAssess
          ? "Kandidat akan langsung mengikuti instant assessment"
          : "Menunggu review HR",
      });
    }

    // --- 4. Create interview session -----------------------------------------------
    const sessionPayload: Record<string, unknown> = {
      candidate: {
        id: applicationId,
        name: fullName,
        email,
        role: "Applicant",
      },
      date: now,
      status: sessionStatus,
      recruitment_stage: "applied",
      transcript: [
        {
          speaker: "ai",
          text: `Aplikasi diterima dari ${fullName} via Job Portal. CV: ${cvUrl || "tidak ada"}`,
        },
      ],
      timeline,
      company_id: companyId,
      source: "job_application",
      job_id: jobId,
      application_id: applicationId,
      cv_url: cvUrl || null,
      whatsapp: whatsapp || null,
      workflow_id: workflowId,
    };

    const { data: sessionRow, error: sessErr } = await supabase
      .from("_interview_sessions")
      .insert(sessionPayload)
      .select("id")
      .single();

    if (sessErr) {
      logger.error({ err: sessErr }, "public-jobs/apply: create interview session failed");
      // Application was already created — don't fail entirely
    }

    // --- 5. Create assessment invite (if instant assessment) ----------------------
    if (shouldInstantAssess && accessCode) {
      const invitePayload: Record<string, unknown> = {
        access_code: accessCode,
        name: fullName,
        email,
        role: jobData?.title || "Applicant",
        company_id: companyId,
        status: "PENDING",
        created_at: now,
        job_id: jobId,
        application_id: applicationId,
      };

      const { error: invErr } = await supabase
        .from("_assessment_invites")
        .insert(invitePayload);

      if (invErr) {
        logger.warn({ err: invErr }, "public-jobs/apply: insert invite failed");
      }
    }

    // --- 6. Auto-trigger CV parsing (best-effort) ---------------------------------
    // The PublicJobPage flow uploads the CV via /api/upload/cv-public and then
    // calls this /apply endpoint to create the application + interview session.
    // Without an explicit auto-parse trigger here, candidate CVs would never be
    // OCR'd until a recruiter manually re-runs parsing from the dashboard. Fire
    // the internal /api/ai/parse-cv route now so the recruiter sees structured
    // CV data the moment they open the candidate.
    if (sessionRow?.id && cvUrl) {
      const internalPort = process.env.PORT || 3001;
      fetch(`http://localhost:${internalPort}/api/ai/parse-cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionRow.id, cvUrl }),
      }).catch((err) => {
        logger.warn(
          { err, sessionId: sessionRow.id },
          "public-jobs/apply: auto parse-cv trigger failed (non-fatal)",
        );
      });
    }

    // --- 7. Send welcome email (best-effort) via internal route -------------------
    if (clientOrigin) {
      const { data: companyDoc } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();

      const assessmentLink = `${clientOrigin}?mode=assess&cid=${companyId}`;
      // Fire-and-forget email
      fetch(`http://localhost:${process.env.PORT || 3001}/api/send-email-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailType: "candidate_welcome",
          to_email: email,
          emailData: {
            candidateName: fullName,
            companyName: companyDoc?.name || "Perusahaan",
            assessmentLink,
          },
          sessionId: sessionRow?.id || applicationId,
        }),
      }).catch(() => {});
    }

    res.json({
      success: true,
      applicationId,
      sessionId: sessionRow?.id || null,
    });
  } catch (err) {
    logger.error({ err }, "public-jobs/apply: unexpected error");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
