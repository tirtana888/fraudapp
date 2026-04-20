import { supabase, COLLECTIONS } from './supabase';
import { createReferenceRequest } from './referenceService';

export type RecruitmentStage =
    | 'applied'
    | 'integrity_assessment'
    | 'assessment_completed'
    | 'interview'
    | 'background_check'
    | 'bc_completed'
    | 'hired'
    | 'rejected';

export const getStageLabel = (stage: RecruitmentStage): string => {
    const labelMap: Record<RecruitmentStage, string> = {
        'applied': 'Kandidat Apply',
        'integrity_assessment': 'Integrity Assessment',
        'assessment_completed': 'Need Review',
        'interview': 'Wawancara Scheduled',
        'background_check': 'Background Check Process',
        'bc_completed': 'Background Check Selesai',
        'hired': 'Hire',
        'rejected': 'Tolak'
    };
    return labelMap[stage] || stage;
};

export const updateCandidateStage = async (
    sessionId: string,
    newStage: RecruitmentStage,
    note?: string
): Promise<void> => {
    try {
        console.log(`[STAGE-TRACKER] Updating stage for ${sessionId} to ${newStage}`);

        // Fetch current timeline
        const { data: session, error: fetchErr } = await supabase
            .from(COLLECTIONS.SESSIONS)
            .select('timeline')
            .eq('id', sessionId)
            .single();

        if (fetchErr) throw fetchErr;

        const existingTimeline = session?.timeline || [];
        const newEntry = {
            stage: newStage,
            status: 'completed',
            date: new Date().toISOString(),
            note: note || getStageLabel(newStage)
        };

        const { error } = await supabase
            .from('_interview_sessions')
            .update({
                recruitment_stage: newStage,
                timeline: [...existingTimeline, newEntry],
                updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);

        if (error) throw error;
        console.log(`[STAGE-TRACKER] ✅ Stage updated successfully to ${newStage}`);

        // Auto-trigger: when stage moves to background_check, kick off
        // reference-check request to candidate (best-effort, non-fatal).
        if (newStage === 'background_check') {
            try {
                const { data: full } = await supabase
                    .from(COLLECTIONS.SESSIONS)
                    .select('candidate, whatsapp, "companyId"')
                    .eq('id', sessionId)
                    .single();
                const candidate = (full?.candidate || {}) as { name?: string; email?: string };
                if (candidate?.name) {
                    let companyName = '';
                    if (full?.companyId) {
                        const { data: company } = await supabase
                            .from(COLLECTIONS.COMPANIES)
                            .select('name')
                            .eq('id', full.companyId)
                            .maybeSingle();
                        companyName = company?.name || '';
                    }
                    await createReferenceRequest({
                        sessionId,
                        candidateName: candidate.name,
                        candidateEmail: candidate.email,
                        candidatePhone: full?.whatsapp,
                        companyName,
                    });
                    console.log('[STAGE-TRACKER] ✅ Reference check request auto-created');
                }
            } catch (refErr) {
                console.warn('[STAGE-TRACKER] Auto reference-check failed (non-fatal):', refErr);
            }
        }
    } catch (error) {
        console.error(`[STAGE-TRACKER] ❌ Error updating stage:`, error);
        throw error;
    }
};

export const getStageColor = (stage: RecruitmentStage): string => {
    const colorMap: Record<RecruitmentStage, string> = {
        'applied': 'blue',
        'integrity_assessment': 'orange',
        'assessment_completed': 'yellow',
        'interview': 'purple',
        'background_check': 'blue',
        'bc_completed': 'green',
        'hired': 'green',
        'rejected': 'red'
    };
    return colorMap[stage] || 'gray';
};

export const getStageIcon = (stage: RecruitmentStage): string => {
    const iconMap: Record<RecruitmentStage, string> = {
        'applied': 'Mail',
        'integrity_assessment': 'Shield',
        'assessment_completed': 'FileCheck',
        'interview': 'MessageSquare',
        'background_check': 'Search',
        'bc_completed': 'CheckCircle2',
        'hired': 'UserCheck',
        'rejected': 'XCircle'
    };
    return iconMap[stage] || 'Circle';
};
