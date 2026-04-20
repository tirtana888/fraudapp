-- Migration: Extension-as-Proctor (Task #15)
-- Adds tables for live proctoring events + camera snapshots, plus a consent column.
-- Run this in Supabase Dashboard → SQL Editor AFTER running 2026-04-20-add-gambling-proctoring-columns.sql.
--
-- Also: in Supabase Dashboard → Storage, create a PRIVATE bucket named "proctoring-snapshots".

alter table _interview_sessions
  add column if not exists proctoring_consent_at timestamptz,
  add column if not exists proctoring_started_at timestamptz,
  add column if not exists proctoring_finished_at timestamptz;

-- Per-event log (tab switch, blur, paste, etc.)
create table if not exists _proctoring_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references _interview_sessions(id) on delete cascade,
  token        text not null,
  event_type   text not null,
  severity     text not null default 'info',
  details      text,
  metadata     jsonb,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_proctoring_events_session on _proctoring_events(session_id);
create index if not exists idx_proctoring_events_occurred on _proctoring_events(occurred_at desc);

-- Camera snapshot metadata (the JPEG itself lives in Supabase Storage)
create table if not exists _proctoring_snapshots (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references _interview_sessions(id) on delete cascade,
  token        text not null,
  storage_path text not null,
  taken_at     timestamptz not null default now(),
  width        integer,
  height       integer,
  bytes        integer,
  created_at   timestamptz not null default now()
);

create index if not exists idx_proctoring_snapshots_session on _proctoring_snapshots(session_id);
create index if not exists idx_proctoring_snapshots_taken on _proctoring_snapshots(taken_at desc);

-- Refresh the interview_sessions view to expose the new consent/timestamp columns
create or replace view interview_sessions as
  select
    id::text                                    as id,
    company_id::text                            as "companyId",
    candidate,
    analysis,
    status,
    source,
    date::text                                  as date,
    completed_at::text                          as "completedAt",
    unlocked_at::text                           as "unlockedAt",
    unlocked_by_company_id::text                as "unlockedByCompanyId",
    job_id::text                                as "jobId",
    application_id::text                        as "applicationId",
    recruitment_stage                           as "recruitmentStage",
    invite_source                               as "inviteSource",
    workflow_id::text                           as "workflowId",
    timeline,
    transcript,
    structured_assessment                       as "structuredAssessment",
    sjt_results                                 as "sjtResults",
    financial_strain_results                    as "financialStrainResults",
    cv_url                                      as "cvUrl",
    cv_parsed_data                              as "cvParsedData",
    whatsapp,
    risk_score                                  as "riskScore",
    background_check                            as "backgroundCheck",
    background_check_status                     as "backgroundCheckStatus",
    background_check_completed_at::text         as "backgroundCheckCompletedAt",
    gambling_analysis                           as "gamblingAnalysis",
    proctoring_data                             as "proctoringData",
    proctoring_consent_at::text                 as "proctoringConsentAt",
    proctoring_started_at::text                 as "proctoringStartedAt",
    proctoring_finished_at::text                as "proctoringFinishedAt",
    created_at::text                            as "createdAt",
    updated_at::text                            as "updatedAt"
  from _interview_sessions;

notify pgrst, 'reload schema';
