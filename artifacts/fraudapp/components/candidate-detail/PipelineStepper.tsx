import React from 'react';
import {
  CheckCircle2, Clock, Bot, ShieldCheck, Users, Shield, UserCheck,
  XCircle, Mail, ArrowRight, Zap, Minus,
} from 'lucide-react';
import { WorkflowStep } from '../../types';

type TimelineItem = {
  stage: string;
  status: 'completed' | 'current' | 'pending' | 'skipped';
  date?: string;
  note?: string;
};

interface StepDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const DEFAULT_STEPS: StepDef[] = [
  { id: 'screening',            label: 'Screening',         icon: <Bot size={15} /> },
  { id: 'integrity_assessment', label: 'Assessment',        icon: <ShieldCheck size={15} /> },
  { id: 'interview',            label: 'Wawancara',         icon: <Users size={15} /> },
  { id: 'bc_check',             label: 'Background Check',  icon: <Shield size={15} /> },
  { id: 'hired',                label: 'Diterima',          icon: <UserCheck size={15} /> },
];

const STAGE_TO_DEFAULT_IDX: Record<string, number> = {
  new: 0, screening: 0, cv_review: 0,
  assessment_sent: 1, in_progress: 1, pending_review: 1, integrity_assessment: 1,
  assessment_completed: 2, review: 2,
  interview: 2, interview_scheduled: 2, face_to_face_interview: 2, skill_interview: 2,
  bc_check: 3, background_check: 3, bc_completed: 3,
  hired: 4, approved: 4,
};

const NEXT_DEFAULT_STAGE: Record<string, { stage: string; label: string }> = {
  assessment_completed: { stage: 'interview', label: 'Jadwalkan Wawancara' },
  review:               { stage: 'interview', label: 'Jadwalkan Wawancara' },
  interview:            { stage: 'bc_check',  label: 'Mulai Background Check' },
  interview_scheduled:  { stage: 'bc_check',  label: 'Mulai Background Check' },
  face_to_face_interview: { stage: 'bc_check', label: 'Mulai Background Check' },
};

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface PipelineStepperProps {
  workflowData?: { steps: WorkflowStep[] } | null;
  timeline?: TimelineItem[];
  currentStage?: string;
  isWorkflowMode: boolean;
  onStepAction: (stageId: string, stepIndex: number) => void;
  onStatusUpdate?: (stage: string) => void;
  onHire: () => void;
  onReject: () => void;
  isUpdating: boolean;
  isAssessmentCompleted: boolean;
  candidateStatus?: string;
}

export default function PipelineStepper({
  workflowData,
  timeline = [],
  currentStage = 'screening',
  isWorkflowMode,
  onStepAction,
  onStatusUpdate,
  onHire,
  onReject,
  isUpdating,
  isAssessmentCompleted,
  candidateStatus,
}: PipelineStepperProps) {
  const isHired    = currentStage === 'hired' || currentStage === 'approved';
  const isRejected = currentStage === 'rejected';

  if (isHired || isRejected) {
    return (
      <div className={`mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
        isHired
          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
          : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
      }`}>
        {isHired
          ? <><CheckCircle2 size={18} className="text-green-600" /><span className="font-semibold text-green-700 dark:text-green-400">Kandidat Diterima</span></>
          : <><XCircle size={18} className="text-red-600" /><span className="font-semibold text-red-700 dark:text-red-400">Kandidat Ditolak</span></>
        }
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">— Proses rekrutmen selesai</span>
      </div>
    );
  }

  if (isWorkflowMode && workflowData) {
    return (
      <WorkflowStepper
        workflowData={workflowData}
        timeline={timeline}
        onStepAction={onStepAction}
        onHire={onHire}
        onReject={onReject}
        isUpdating={isUpdating}
        isAssessmentCompleted={isAssessmentCompleted}
      />
    );
  }

  return (
    <DefaultStepper
      currentStage={currentStage}
      timeline={timeline}
      onStatusUpdate={onStatusUpdate}
      onHire={onHire}
      onReject={onReject}
      isUpdating={isUpdating}
      isAssessmentCompleted={isAssessmentCompleted}
      candidateStatus={candidateStatus}
    />
  );
}

function WorkflowStepper({
  workflowData,
  timeline,
  onStepAction,
  onHire,
  onReject,
  isUpdating,
  isAssessmentCompleted,
}: {
  workflowData: { steps: WorkflowStep[] };
  timeline: TimelineItem[];
  onStepAction: (stageId: string, stepIndex: number) => void;
  onHire: () => void;
  onReject: () => void;
  isUpdating: boolean;
  isAssessmentCompleted: boolean;
}) {
  const workflowTimeline = timeline.filter(t =>
    workflowData.steps.some(s => s.id === t.stage)
  );

  const currentStepIndex = workflowTimeline.findIndex(t => t.status === 'current');
  const currentStep      = workflowTimeline[currentStepIndex];
  const isCurrentAssessment = currentStep?.stage === 'integrity_assessment';

  const getStepDate = (stepId: string) =>
    workflowTimeline.find(t => t.stage === stepId)?.date;

  const getStepStatus = (stepId: string): 'completed' | 'current' | 'pending' | 'skipped' => {
    const found = workflowTimeline.find(t => t.stage === stepId);
    return found?.status ?? 'pending';
  };

  const primaryLabel = currentStep
    ? workflowData.steps.find(s => s.id === currentStep.stage)?.name || 'Lanjut'
    : null;

  let contextMsg = '';
  if (!currentStep) {
    contextMsg = 'Semua tahap workflow selesai — buat keputusan akhir';
  } else if (isCurrentAssessment) {
    contextMsg = isAssessmentCompleted
      ? '✅ Assessment selesai — tandai selesai untuk lanjut'
      : '⏳ Menunggu kandidat menyelesaikan assessment...';
  } else {
    contextMsg = `Tahap aktif: ${primaryLabel}`;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-0">
        {workflowData.steps.map((step, idx) => {
          const status = getStepStatus(step.id);
          const isLast = idx === workflowData.steps.length - 1;
          return (
            <React.Fragment key={step.id}>
              <StepNode
                label={step.name}
                status={status}
                date={getStepDate(step.id)}
              />
              {!isLast && <StepConnector status={status} nextStatus={getStepStatus(workflowData.steps[idx + 1].id)} />}
            </React.Fragment>
          );
        })}
        <StepConnector status="pending" nextStatus="pending" />
        <StepNode label="Rekrut / Tolak" status={!currentStep ? 'current' : 'pending'} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 italic">{contextMsg}</span>

        {currentStep && (
          isCurrentAssessment && !isAssessmentCompleted ? (
            <button
              disabled
              title="Kandidat sudah mendapat email assessment — tunggu hingga selesai"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
            >
              <Mail size={15} />
              {primaryLabel}
              <span className="text-xs opacity-70">(Menunggu kandidat)</span>
            </button>
          ) : (
            <button
              onClick={() => onStepAction(currentStep.stage, currentStepIndex)}
              disabled={isUpdating}
              title={isCurrentAssessment ? 'Tandai assessment selesai dan lanjut ke tahap berikutnya' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] hover:bg-[#c05200] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isUpdating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={15} />}
              {isCurrentAssessment ? 'Selesaikan Assessment' : primaryLabel}
              <ArrowRight size={14} />
            </button>
          )
        )}

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

        <button
          onClick={onHire}
          disabled={isUpdating || !isAssessmentCompleted}
          title={!isAssessmentCompleted ? 'Assessment harus selesai terlebih dahulu' : 'Rekrut kandidat'}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <CheckCircle2 size={15} />
          Rekrut
        </button>

        <button
          onClick={onReject}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-red-400 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 shadow-sm"
        >
          <XCircle size={15} />
          Tolak
        </button>
      </div>
    </div>
  );
}

function DefaultStepper({
  currentStage,
  timeline,
  onStatusUpdate,
  onHire,
  onReject,
  isUpdating,
  isAssessmentCompleted,
  candidateStatus,
}: {
  currentStage: string;
  timeline: TimelineItem[];
  onStatusUpdate?: (stage: string) => void;
  onHire: () => void;
  onReject: () => void;
  isUpdating: boolean;
  isAssessmentCompleted: boolean;
  candidateStatus?: string;
}) {
  const activeIdx = STAGE_TO_DEFAULT_IDX[currentStage] ?? 0;
  const nextAction = NEXT_DEFAULT_STAGE[currentStage];

  const getStatus = (idx: number): 'completed' | 'current' | 'pending' | 'skipped' => {
    if (idx < activeIdx) return 'completed';
    if (idx === activeIdx) return 'current';
    return 'pending';
  };

  const getDate = (step: StepDef) =>
    timeline.find(t => t.stage === step.id)?.date;

  const isWaitingForAssessment =
    ['assessment_sent', 'in_progress', 'pending_review', 'integrity_assessment'].includes(currentStage) &&
    !isAssessmentCompleted;

  let contextMsg = '';
  if (isWaitingForAssessment) {
    contextMsg = '⏳ Menunggu kandidat menyelesaikan assessment...';
  } else if (isAssessmentCompleted && activeIdx <= 1) {
    contextMsg = '✅ Assessment selesai — jadwalkan wawancara untuk lanjut';
  } else if (nextAction) {
    contextMsg = `Siap lanjut ke tahap berikutnya`;
  } else if (candidateStatus === 'completed' || activeIdx >= 3) {
    contextMsg = '✅ Proses selesai — buat keputusan akhir: Rekrut atau Tolak';
  } else {
    contextMsg = 'Lanjutkan proses rekrutmen untuk kandidat ini';
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-0">
        {DEFAULT_STEPS.map((step, idx) => {
          const status = getStatus(idx);
          const isLast = idx === DEFAULT_STEPS.length - 1;
          return (
            <React.Fragment key={step.id}>
              <StepNode
                label={step.label}
                status={status}
                date={getDate(step)}
                icon={step.icon}
              />
              {!isLast && (
                <StepConnector
                  status={status}
                  nextStatus={getStatus(idx + 1)}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 italic">{contextMsg}</span>

        {isWaitingForAssessment && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
            <Mail size={15} />
            Assessment (Email Terkirim)
          </div>
        )}

        {!isWaitingForAssessment && nextAction && onStatusUpdate && (
          <button
            onClick={() => onStatusUpdate(nextAction.stage)}
            disabled={isUpdating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] hover:bg-[#c05200] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isUpdating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={15} />}
            {nextAction.label}
            <ArrowRight size={14} />
          </button>
        )}

        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

        <button
          onClick={onHire}
          disabled={isUpdating || !isAssessmentCompleted}
          title={!isAssessmentCompleted ? 'Assessment harus selesai terlebih dahulu' : 'Rekrut kandidat'}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <CheckCircle2 size={15} />
          Rekrut Kandidat
        </button>

        <button
          onClick={onReject}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border-2 border-red-400 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40 shadow-sm"
        >
          <XCircle size={15} />
          Tolak
        </button>
      </div>
    </div>
  );
}

function StepNode({
  label,
  status,
  date,
  icon,
}: {
  label: string;
  status: 'completed' | 'current' | 'pending' | 'skipped';
  date?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center min-w-0 group relative" style={{ minWidth: 72 }}>
      <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
        status === 'completed'
          ? 'bg-green-500 border-green-500 text-white'
          : status === 'current'
          ? 'bg-white dark:bg-slate-900 border-[#D95D00] text-[#D95D00] shadow-md'
          : status === 'skipped'
          ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 opacity-60'
          : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
      }`}>
        {status === 'completed' && <CheckCircle2 size={16} />}
        {status === 'skipped'   && <Minus size={14} />}
        {status === 'current'   && (
          <>
            {icon ?? <Clock size={14} />}
            <span className="absolute inset-0 rounded-full border-2 border-[#D95D00] animate-ping opacity-40" />
          </>
        )}
        {status === 'pending'   && (icon ?? <Clock size={14} />)}
      </div>

      <span className={`mt-1 text-[10px] font-medium text-center leading-tight max-w-[72px] truncate ${
        status === 'completed'
          ? 'text-green-600 dark:text-green-400'
          : status === 'current'
          ? 'text-[#D95D00] font-bold'
          : status === 'skipped'
          ? 'text-gray-300 dark:text-gray-600 line-through'
          : 'text-gray-400 dark:text-gray-500'
      }`}>
        {label}
      </span>

      {date && status === 'completed' && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
          Selesai: {formatDate(date)}
        </div>
      )}

      {status === 'skipped' && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
          Dilewati
        </div>
      )}
    </div>
  );
}

function StepConnector({
  status,
  nextStatus,
}: {
  status: 'completed' | 'current' | 'pending' | 'skipped';
  nextStatus: 'completed' | 'current' | 'pending' | 'skipped';
}) {
  const isCompleted = status === 'completed' && nextStatus !== 'pending';
  const isSkipped   = status === 'skipped' || nextStatus === 'skipped';
  return (
    <div className={`h-0.5 flex-1 mx-1 rounded transition-colors ${
      isSkipped   ? 'bg-gray-200 dark:bg-gray-700 opacity-40'
      : isCompleted ? 'bg-green-400'
      : 'bg-gray-200 dark:bg-gray-700'
    }`} />
  );
}
