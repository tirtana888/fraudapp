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

const VALID_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[\\/]/g, "_");
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-128) || "cv.pdf";
}

router.post("/cv-public", async (req: Request, res: Response) => {
  try {
    const { applicationId, fileName, fileType, fileBase64 } = req.body as {
      applicationId?: string;
      fileName?: string;
      fileType?: string;
      fileBase64?: string;
    };

    if (!applicationId || !fileName || !fileType || !fileBase64) {
      res.status(400).json({
        success: false,
        error: "applicationId, fileName, fileType, and fileBase64 are required",
      });
      return;
    }

    if (!VALID_MIME_TYPES.has(fileType)) {
      res.status(400).json({
        success: false,
        error: "Format file tidak valid. Gunakan PDF, DOC, DOCX, TXT, atau gambar.",
      });
      return;
    }

    const cleanBase64 = fileBase64.includes(",")
      ? fileBase64.split(",")[1]
      : fileBase64;
    const buffer = Buffer.from(cleanBase64, "base64");

    if (buffer.length === 0) {
      res.status(400).json({ success: false, error: "Empty file payload" });
      return;
    }
    if (buffer.length > MAX_FILE_BYTES) {
      res.status(413).json({
        success: false,
        error: "Ukuran file terlalu besar. Maksimal 5MB.",
      });
      return;
    }

    const safeAppId = applicationId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
    const safeName = sanitizeFileName(fileName);
    const storagePath = `cvs/${safeAppId}/${safeName}`;

    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from("candidate-documents")
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: fileType,
      });

    if (uploadError) {
      logger.error({ err: uploadError, storagePath }, "CV upload failed");
      res.status(500).json({
        success: false,
        error: `Gagal upload dokumen: ${uploadError.message}`,
      });
      return;
    }

    // The candidate-documents bucket is private, so getPublicUrl() would
    // produce a URL that returns 403.  Use a signed URL instead (valid 1 year).
    const { data: signedData, error: signErr } = await supabase.storage
      .from("candidate-documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signErr || !signedData?.signedUrl) {
      // Fallback: return the storage path so downstream code can still
      // download the file via the service key.
      logger.warn({ err: signErr, storagePath }, "Failed to create signed URL, returning path");
      const fallbackUrl = `${SUPABASE_URL}/storage/v1/object/candidate-documents/${storagePath}`;
      res.json({ success: true, url: fallbackUrl, path: storagePath });
      return;
    }

    res.json({ success: true, url: signedData.signedUrl, path: storagePath });
  } catch (err) {
    logger.error({ err }, "Unexpected error in /upload/cv-public");
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
