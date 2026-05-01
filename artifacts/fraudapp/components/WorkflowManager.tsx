import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, ShieldCheck, Brain, Video, Users, Search,
  FileCheck, Share2, CheckCircle, XCircle, AlertCircle, ArrowRight,
  GripVertical, Layout, Box, Coins, Clock, Globe, PhoneCall
} from 'lucide-react';
import { Workflow, WorkflowStep, WORKFLOW_TEMPLATES, WorkflowTemplate } from '../types';
import { supabase, COLLECTIONS, createWorkflow, updateWorkflow, deleteWorkflow } from '../services/supabase';
import { useToast } from './Toast';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WorkflowManagerProps {
  companyId: string;
  isDarkMode: boolean;
}

const iconMap: { [key: string]: any } = {
  ShieldCheck,
  Brain,
  Video,
  Users,
  Search,
  FileCheck,
  Share2,
  CheckCircle,
  XCircle,
  Globe,
  PhoneCall
};

const WorkflowManager: React.FC<WorkflowManagerProps> = ({ companyId, isDarkMode }) => {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [selectedSteps, setSelectedSteps] = useState<{ [key: string]: boolean }>({
    integrity_assessment: true, // Mandatory
    hire_decision: true, // Mandatory
    reject_decision: true // Mandatory
  });

  useEffect(() => {
    loadWorkflows();
  }, [companyId]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(COLLECTIONS.WORKFLOWS)
        .select('*')
        .eq('companyId', companyId);
      if (error) throw error;
      setWorkflows((data || []) as Workflow[]);
    } catch (error) {
      console.error('[WORKFLOW] Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = () => {
    setIsCreating(true);
    setEditingWorkflow(null);
    setWorkflowName('');
    setWorkflowDescription('');
    setSelectedSteps({
      integrity_assessment: true, // Mandatory
      hire_decision: true, // Mandatory
      reject_decision: true // Mandatory
    });
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setIsCreating(true);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description);

    const steps: { [key: string]: boolean } = {};
    workflow.steps.forEach(step => {
      steps[step.id] = step.isEnabled;
    });
    setSelectedSteps(steps);
  };

  const handleToggleStep = (stepId: string, isMandatory: boolean) => {
    if (isMandatory) return; // Cannot toggle mandatory steps

    // Check if step is coming soon
    const template = WORKFLOW_TEMPLATES.find(t => t.id === stepId);
    if (template && template.isAvailable === false) return; // Cannot toggle coming soon steps

    setSelectedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const calculateTotalCredits = () => {
    return WORKFLOW_TEMPLATES.reduce((total, template) => {
      if (selectedSteps[template.id]) {
        return total + template.credits;
      }
      return total;
    }, 0);
  };

  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      toast.error('Nama workflow wajib diisi!');
      return;
    }

    if (isSaving) return; // Prevent double-click

    try {
      setIsSaving(true);

      // Enforce ordering: integrity_assessment first, then optional steps, decisions last
      const ORDER_PRIORITY: Record<string, number> = {
        integrity_assessment: 0,
        live_proctoring: 5,      // During assessment
        skill_interview: 8,      // AI skill interview
        gambling_screening: 10,  // After integrity_assessment
        face_to_face_interview: 15,
        background_check: 20,
        document_forgery: 25,    // After background_check
        social_media_screening: 28,
        reference_check: 30,     // After background_check
        hire_decision: 900,
        reject_decision: 901,
      };

      const steps: WorkflowStep[] = WORKFLOW_TEMPLATES
        .filter(template => selectedSteps[template.id])
        .sort((a, b) => {
          const pa = ORDER_PRIORITY[a.id] ?? 50;
          const pb = ORDER_PRIORITY[b.id] ?? 50;
          return pa - pb;
        })
        .map((template, index) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          credits: template.credits,
          isMandatory: template.isMandatory,
          isEnabled: true,
          order: index + 1,
          status: 'pending'
        }));

      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        companyId,
        steps,
        totalCredits: calculateTotalCredits(),
        isActive: true,
        updatedAt: new Date().toISOString()
      };

      if (editingWorkflow) {
        await updateWorkflow(editingWorkflow.id!, workflowData);
        console.log('[WORKFLOW] Updated workflow:', editingWorkflow.id);
        toast.success('Workflow berhasil diupdate!');
      } else {
        await createWorkflow(workflowData as Parameters<typeof createWorkflow>[0]);
        console.log('[WORKFLOW] Created new workflow');
        toast.success('Workflow berhasil dibuat!');
      }

      setIsCreating(false);
      setEditingWorkflow(null);
      await loadWorkflows();
    } catch (error: any) {
      console.error('[WORKFLOW] Error saving workflow:', error);
      const detail =
        error?.message ||
        error?.error_description ||
        error?.hint ||
        error?.details ||
        (typeof error === 'string' ? error : 'Unknown error');
      toast.error(`Gagal menyimpan workflow: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus workflow ini?')) return;

    try {
      await deleteWorkflow(workflowId);
      console.log('[WORKFLOW] Deleted workflow:', workflowId);
      loadWorkflows();
      toast.success('Workflow berhasil dihapus');
    } catch (error) {
      console.error('[WORKFLOW] Error deleting workflow:', error);
      toast.error('Gagal menghapus workflow. Silakan coba lagi.');
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'assessment': return 'from-blue-500 to-cyan-400 border-blue-200 text-blue-900';
      case 'interview': return 'from-purple-500 to-pink-400 border-purple-200 text-purple-900';
      case 'verification': return 'from-amber-400 to-orange-500 border-orange-200 text-orange-900';
      case 'decision': return 'from-emerald-500 to-green-400 border-green-200 text-green-900';
      default: return 'from-slate-500 to-gray-400 border-gray-200 text-gray-900';
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'assessment': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
      case 'interview': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200';
      case 'verification': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200';
      case 'decision': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Layout className="w-5 h-5 text-[#D95D00] opacity-50" />
          </div>
        </div>
      </div>
    );
  }

  // --- EDITOR VIEW ---
  if (isCreating) {
    const activeSteps = WORKFLOW_TEMPLATES.filter(t => selectedSteps[t.id]);

    return (
      <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)] bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">

        {/* Editor Toolbar */}
        <div className="px-4 md:px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 shrink-0 z-20 shadow-sm relative">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setIsCreating(false)}
              className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Nama Workflow (mis: Standard Hiring)"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full bg-transparent text-base md:text-lg font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none truncate"
              />
              <input
                type="text"
                placeholder="Deskripsi singkat..."
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-500 dark:text-slate-400 focus:outline-none truncate"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <Coins className="w-4 h-4 text-orange-500" />
              <div className="flex flex-col items-end leading-none">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{calculateTotalCredits()}</span>
                <span className="text-[10px] text-slate-500">CREDITS</span>
              </div>
            </div>
            <button
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B14d00] transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:grayscale text-sm"
            >
              {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">Simpan Workflow</span>
              <span className="sm:hidden">Simpan</span>
            </button>
          </div>
        </div>

        {/* Split View */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

          {/* LEFT: TIMELINE CANVAS */}
          <div className="flex-1 bg-slate-50/50 dark:bg-[#0B1120] relative overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-xl mx-auto">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 text-center">Visual Timeline</h4>

              <div className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-800 space-y-8 pb-32">
                <AnimatePresence mode='popLayout'>
                  {activeSteps.map((template, index) => {
                    const Icon = iconMap[template.icon];
                    return (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        layout
                        className="relative"
                      >
                        {/* Connector Dot */}
                        <div className="absolute -left-[41px] top-6 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 bg-slate-300 dark:bg-slate-700 z-10 box-content" />

                        {/* Card */}
                        <div className={cn(
                          "bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 group md:hover:scale-[1.02] transition-transform duration-300",
                          template.isMandatory ? "border-l-4 border-l-slate-400 dark:border-l-slate-600" : "border-l-4 border-l-[#D95D00]"
                        )}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-inner text-white",
                                getCategoryColor(template.category).split(' border')[0] // Extract gradient only
                              )}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{template.name}</h3>
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", getCategoryBadge(template.category))}>
                                    {template.category}
                                  </span>
                                  {template.credits > 0 && (
                                    <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                      <Coins className="w-3 h-3" /> {template.credits}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {!template.isMandatory && (
                              <button
                                onClick={() => handleToggleStep(template.id, false)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {template.isMandatory && (
                              <span className="text-xs text-slate-400 italic">Required</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 pl-[52px]">
                            {template.description}
                          </p>
                        </div>

                        {/* Arrow Connector (except last) */}
                        {index < activeSteps.length - 1 && (
                          <div className="absolute left-6 -bottom-6 w-px h-6 bg-slate-200 dark:bg-slate-700" />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-500">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  End of Workflow
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: LIBRARY */}
          <div className="w-full md:w-72 lg:w-80 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-xl shrink-0 max-h-[40vh] md:max-h-none">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Box className="w-4 h-4 text-[#D95D00]" /> Step Library
              </h3>
              <p className="text-xs text-slate-500 mt-1">Click to add steps to timeline</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {WORKFLOW_TEMPLATES.filter(t => !t.isMandatory).map(template => {
                const Icon = iconMap[template.icon];
                const isSelected = selectedSteps[template.id];
                const isComingSoon = template.isAvailable === false;

                return (
                  <button
                    key={template.id}
                    onClick={() => !isComingSoon && handleToggleStep(template.id, false)}
                    disabled={isComingSoon}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all duration-200 group relative active:scale-[0.98]",
                      isSelected
                        ? "bg-slate-50 dark:bg-slate-800 border-[#D95D00] shadow-sm ring-1 ring-[#D95D00]/20"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm",
                      isComingSoon && "opacity-60 cursor-not-allowed grayscale"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors",
                        isSelected && "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {template.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">{template.credits} credits</span>
                        </div>
                      </div>
                      {isSelected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <CheckCircle className="w-4 h-4 text-[#D95D00]" />
                        </motion.div>
                      )}
                      {isComingSoon && (
                        <span className="absolute top-2 right-2 text-[8px] font-bold bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">SOON</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // --- MAIN LIST VIEW ---
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Workflow Manager</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
            Design your automated hiring pipelines with our visual builder.
          </p>
        </div>
        <button
          onClick={handleCreateWorkflow}
          className="flex items-center gap-2 px-6 py-3 bg-[#D95D00] text-white rounded-xl hover:bg-[#B14d00] transition-all shadow-lg shadow-orange-900/20 active:scale-95 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          <span className="font-semibold">New Workflow</span>
        </button>
      </div>

      {/* Grid */}
      {workflows.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center h-96 flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
            <Layout className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Workflows Yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-8">
            Create your first workflow to start automating your candidate screening process.
          </p>
          <button
            onClick={handleCreateWorkflow}
            className="inline-flex items-center gap-2 text-[#D95D00] font-semibold hover:underline"
          >
            Create your first workflow <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="group bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-[#D95D00]/30 transition-all duration-300 relative overflow-hidden flex flex-col h-full"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                <button
                  onClick={() => handleEditWorkflow(workflow)}
                  className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:text-blue-500 transition-colors text-slate-500"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteWorkflow(workflow.id!)}
                  className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm hover:text-red-500 transition-colors text-slate-500"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/10 flex items-center justify-center text-[#D95D00]">
                  <Layout className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white leading-tight truncate pr-16">{workflow.name}</h3>
                  <span className="text-xs text-slate-400">
                    Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 min-h-[3rem] flex-1">
                {workflow.description || "No description provided."}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-auto">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {workflow.steps.length} Steps
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                  <Coins className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{workflow.totalCredits}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowManager;
