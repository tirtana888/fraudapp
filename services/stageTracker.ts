import { doc, updateDoc, Timestamp, arrayUnion } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';

/**
 * Recruitment Stage Type
 */
export type RecruitmentStage =
    | 'applied'                    // Kandidat Apply
    | 'integrity_assessment'       // Integrity Assessment
    | 'assessment_completed'       // Need Review
    | 'interview'                  // Wawancara Scheduled
    | 'background_check'           // Background Check Process
    | 'bc_completed'               // Background Check Selesai
    | 'hired'                      // Hire
    | 'rejected';                  // Tolak

/**
 * Get human-readable label for stage
 */
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

/**
 * Update candidate's recruitment stage and add to timeline
 */
export const updateCandidateStage = async (
    sessionId: string,
    newStage: RecruitmentStage,
    note?: string
): Promise<void> => {
    try {
        console.log(`[STAGE-TRACKER] Updating stage for ${sessionId} to ${newStage}`);

        const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);

        await updateDoc(sessionRef, {
            recruitmentStage: newStage,
            timeline: arrayUnion({
                stage: newStage,
                status: 'completed',
                date: new Date().toISOString(),
                note: note || getStageLabel(newStage)
            }),
            updatedAt: Timestamp.now()
        });

        console.log(`[STAGE-TRACKER] ✅ Stage updated successfully to ${newStage}`);
    } catch (error) {
        console.error(`[STAGE-TRACKER] ❌ Error updating stage:`, error);
        throw error;
    }
};

/**
 * Get stage color for UI display
 */
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

/**
 * Get stage icon name for UI display
 */
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
