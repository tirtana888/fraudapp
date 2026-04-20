-- Migration: reference check tables for "Cek Referensi Kerja via WhatsApp"
-- Run this in Supabase Dashboard → SQL Editor.

create table if not exists _reference_check_requests (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null,
  candidate_id    text,
  company_id      uuid,
  request_token   text not null unique,
  status          text not null default 'pending',  -- pending | submitted | expired | cancelled
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_refcheck_requests_session on _reference_check_requests(session_id);
create index if not exists idx_refcheck_requests_token on _reference_check_requests(request_token);

create table if not exists _reference_check_responses (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references _reference_check_requests(id) on delete cascade,
  prev_company_name   text not null,
  prev_role           text,
  prev_period         text,
  prev_hr_name        text,
  prev_hr_phone       text not null,             -- E.164 (e.g. +6281234567890)
  twilio_message_sid  text,
  sent_at             timestamptz,
  status              text not null default 'pending',  -- pending | confirmed | denied | no_response
  response_text       text,
  responded_at        timestamptz,
  resend_count        int not null default 0,
  last_resend_at      timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists idx_refcheck_responses_request on _reference_check_responses(request_id);
create index if not exists idx_refcheck_responses_phone on _reference_check_responses(prev_hr_phone);
create index if not exists idx_refcheck_responses_msgsid on _reference_check_responses(twilio_message_sid);

-- Enable RLS; service-role key in API server bypasses these.
alter table _reference_check_requests enable row level security;
alter table _reference_check_responses enable row level security;

-- Company-scoped read policies. Users can only see requests/responses for the
-- company they belong to. The API server's service-role key bypasses RLS for
-- privileged operations (insert/update via Twilio webhook, etc).

drop policy if exists rc_requests_company_read on _reference_check_requests;
create policy rc_requests_company_read on _reference_check_requests
  for select using (
    company_id = (select company_id from _users where id = auth.uid())
  );

drop policy if exists rc_responses_company_read on _reference_check_responses;
create policy rc_responses_company_read on _reference_check_responses
  for select using (
    request_id in (
      select id from _reference_check_requests
      where company_id = (select company_id from _users where id = auth.uid())
    )
  );

-- Camel-case view that joins requests with their responses for frontend use.
create or replace view reference_check_requests as
  select
    r.id::text                                  as id,
    r.session_id::text                          as "sessionId",
    r.candidate_id                              as "candidateId",
    r.company_id::text                          as "companyId",
    r.request_token                             as "requestToken",
    r.status                                    as status,
    r.expires_at::text                          as "expiresAt",
    r.created_at::text                          as "createdAt",
    r.updated_at::text                          as "updatedAt",
    coalesce((
      select json_agg(json_build_object(
        'id',                resp.id::text,
        'prevCompanyName',   resp.prev_company_name,
        'prevRole',          resp.prev_role,
        'prevPeriod',        resp.prev_period,
        'prevHrName',        resp.prev_hr_name,
        'prevHrPhone',       resp.prev_hr_phone,
        'twilioMessageSid',  resp.twilio_message_sid,
        'sentAt',            resp.sent_at,
        'status',            resp.status,
        'responseText',      resp.response_text,
        'respondedAt',       resp.responded_at,
        'resendCount',       resp.resend_count,
        'lastResendAt',      resp.last_resend_at,
        'createdAt',         resp.created_at
      ) order by resp.created_at)
      from _reference_check_responses resp
      where resp.request_id = r.id
    ), '[]'::json) as responses
  from _reference_check_requests r;

notify pgrst, 'reload schema';
