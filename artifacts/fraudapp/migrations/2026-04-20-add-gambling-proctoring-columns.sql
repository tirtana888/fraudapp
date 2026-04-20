-- Migration: add gambling_analysis & proctoring_data to _interview_sessions
-- and expose them on the interview_sessions view.
-- Run this in Supabase Dashboard → SQL Editor.

alter table _interview_sessions
  add column if not exists gambling_analysis jsonb,
  add column if not exists proctoring_data   jsonb;

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
    created_at::text                            as "createdAt",
    updated_at::text                            as "updatedAt"
  from _interview_sessions;

notify pgrst, 'reload schema';
