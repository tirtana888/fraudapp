-- Migration: Reference Check Enhancements
-- Adds: email reference, AI voice call, direct WhatsApp support
-- Run in Supabase Dashboard → SQL Editor

-- Email reference fields
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS ref_email text;
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS email_confirm_token text;
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS email_deny_token text;
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- AI Voice Call fields
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS call_status text;          -- pending | in_progress | completed | failed | no_answer
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS call_sid text;             -- Twilio call SID
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS call_transcript jsonb;     -- [{speaker, text, timestamp}]
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS call_analysis jsonb;       -- {confirmed, status, reasoning}
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS call_duration integer;     -- duration in seconds
ALTER TABLE _reference_check_responses ADD COLUMN IF NOT EXISTS call_recording_url text;   -- Twilio recording URL

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refcheck_responses_email ON _reference_check_responses(ref_email) WHERE ref_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refcheck_responses_email_token ON _reference_check_responses(email_confirm_token) WHERE email_confirm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refcheck_responses_call_sid ON _reference_check_responses(call_sid) WHERE call_sid IS NOT NULL;

-- Update the reference_check_requests view to include new fields in responses
CREATE OR REPLACE VIEW reference_check_requests AS
  SELECT
    r.id::text                                  AS id,
    r.session_id::text                          AS "sessionId",
    r.candidate_id                              AS "candidateId",
    r.company_id::text                          AS "companyId",
    r.request_token                             AS "requestToken",
    r.status                                    AS status,
    r.expires_at::text                          AS "expiresAt",
    r.created_at::text                          AS "createdAt",
    r.updated_at::text                          AS "updatedAt",
    COALESCE((
      SELECT json_agg(json_build_object(
        'id',                resp.id::text,
        'prevCompanyName',   resp.prev_company_name,
        'prevRole',          resp.prev_role,
        'prevPeriod',        resp.prev_period,
        'prevHrName',        resp.prev_hr_name,
        'prevHrPhone',       resp.prev_hr_phone,
        'refEmail',          resp.ref_email,
        'twilioMessageSid',  resp.twilio_message_sid,
        'sentAt',            resp.sent_at,
        'status',            resp.status,
        'responseText',      resp.response_text,
        'respondedAt',       resp.responded_at,
        'resendCount',       resp.resend_count,
        'lastResendAt',      resp.last_resend_at,
        'emailSentAt',       resp.email_sent_at,
        'callStatus',        resp.call_status,
        'callSid',           resp.call_sid,
        'callTranscript',    resp.call_transcript,
        'callAnalysis',      resp.call_analysis,
        'callDuration',      resp.call_duration,
        'callRecordingUrl',  resp.call_recording_url,
        'createdAt',         resp.created_at
      ) ORDER BY resp.created_at)
      FROM _reference_check_responses resp
      WHERE resp.request_id = r.id
    ), '[]'::json) AS responses
  FROM _reference_check_requests r;

NOTIFY pgrst, 'reload schema';
