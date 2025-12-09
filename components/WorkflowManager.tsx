import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, ShieldCheck, Brain, Video, Users, Search, FileCheck, Share2, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';
import { Workflow, WorkflowStep, WORKFLOW_TEMPLATES } from '../types';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../services/firebase';
import { useToast } from './Toast';

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
  XCircle
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
    hire_decision: true, // Mandatory
    reject_decision: true // Mandatory
  });

  useEffect(() => {
    loadWorkflows();
  }, [companyId]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, COLLECTIONS.WORKFLOWS),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      const workflowsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Workflow[];
      setWorkflows(workflowsData);
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
      hire_decision: true,
      reject_decision: true
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
      alert('Nama workflow wajib diisi!');
      return;
    }

    try {
      const steps: WorkflowStep[] = WORKFLOW_TEMPLATES
        .filter(template => selectedSteps[template.id])
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
        // Update existing workflow
        const workflowRef = doc(db, COLLECTIONS.WORKFLOWS, editingWorkflow.id!);
        await updateDoc(workflowRef, workflowData);
        console.log('[WORKFLOW] Updated workflow:', editingWorkflow.id);
      } else {
        // Create new workflow
        await addDoc(collection(db, COLLECTIONS.WORKFLOWS), {
          ...workflowData,
          createdAt: new Date().toISOString()
        });
        console.log('[WORKFLOW] Created new workflow');
      }

      setIsCreating(false);
      setEditingWorkflow(null);
      loadWorkflows();
    } catch (error) {
      console.error('[WORKFLOW] Error saving workflow:', error);
      alert('Gagal menyimpan workflow. Silakan coba lagi.');
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus workflow ini?')) return;

    try {
      await deleteDoc(doc(db, COLLECTIONS.WORKFLOWS, workflowId));
      console.log('[WORKFLOW] Deleted workflow:', workflowId);
      loadWorkflows();
    } catch (error) {
      console.error('[WORKFLOW] Error deleting workflow:', error);
      alert('Gagal menghapus workflow. Silakan coba lagi.');
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'assessment': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'interview': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'verification': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'decision': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Rekrutmen</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Buat dan kelola workflow rekrutmen untuk lowongan kerja Anda
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={handleCreateWorkflow}
            className="flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-colors shadow-md"
          >
            <Plus size={20} />
            <span>Buat Workflow Baru</span>
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingWorkflow ? 'Edit Workflow' : 'Buat Workflow Baru'}
            </h3>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingWorkflow(null);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama Workflow *
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g. Standard Hiring Process"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Deskripsi
              </label>
              <textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Deskripsi workflow ini..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-orange dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          {/* Workflow Steps Selection */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pilih Tahapan Workflow
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WORKFLOW_TEMPLATES.map((template) => {
                const Icon = iconMap[template.icon];
                const isSelected = selectedSteps[template.id];
                const isDisabled = template.isMandatory;
                const isComingSoon = template.isAvailable === false;

                return (
                  <div
                    key={template.id}
                    onClick={() => !isComingSoon && handleToggleStep(template.id, template.isMandatory)}
                    className={`
                      relative p-4 border-2 rounded-xl transition-all
                      ${isComingSoon 
                        ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-slate-900 border-gray-300 dark:border-slate-700' 
                        : isSelected 
                          ? 'border-brand-orange bg-brand-orange/5 dark:bg-brand-orange/10 cursor-pointer' 
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 cursor-pointer'
                      }
                      ${isDisabled && !isComingSoon ? 'opacity-75 cursor-not-allowed' : ''}
                    `}
                  >
                    {/* Top Right Badges */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {isComingSoon && (
                        <span className="px-2 py-1 bg-gray-600 text-white dark:bg-gray-700 dark:text-gray-200 text-xs font-bold rounded">
                          COMING SOON
                        </span>
                      )}
                      {template.isMandatory && !isComingSoon && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs font-bold rounded">
                          WAJIB
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        ${getCategoryColor(template.category)}
                      `}>
                        <Icon size={20} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-semibold text-gray-900 dark:text-white">
                            {template.name}
                          </h5>
                          {template.credits === 0 ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-bold rounded">
                              FREE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-bold rounded">
                              {template.credits} credits
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {template.description}
                        </p>
                      </div>

                      {!isComingSoon && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {}}
                          className="w-5 h-5 text-brand-orange rounded focus:ring-brand-orange"
                        />
                      )}
                      {isComingSoon && (
                        <div className="w-5 h-5 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">🔒</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Credits */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Total Credits Per Kandidat
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  Biaya yang akan dideduct saat workflow selesai
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold bg-gradient-to-r from-brand-orange to-purple-600 bg-clip-text text-transparent">
                  {calculateTotalCredits()}
                </div>
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  credits
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveWorkflow}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-colors font-medium"
            >
              <Save size={20} />
              <span>{editingWorkflow ? 'Update Workflow' : 'Simpan Workflow'}</span>
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingWorkflow(null);
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Workflows List */}
      {!isCreating && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {workflows.length === 0 ? (
            <div className="col-span-2 text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
              <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Belum Ada Workflow
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Buat workflow pertama Anda untuk mengatur proses rekrutmen
              </p>
              <button
                onClick={handleCreateWorkflow}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-colors"
              >
                <Plus size={20} />
                <span>Buat Workflow</span>
              </button>
            </div>
          ) : (
            workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {workflow.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {workflow.description || 'Tidak ada deskripsi'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditWorkflow(workflow)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit workflow"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(workflow.id!)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Hapus workflow"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Tahapan ({workflow.steps.length})
                  </p>
                  <div className="space-y-1">
                    {workflow.steps.map((step, index) => {
                      const template = WORKFLOW_TEMPLATES.find(t => t.id === step.id);
                      const Icon = template ? iconMap[template.icon] : CheckCircle;
                      
                      return (
                        <div
                          key={step.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                        >
                          <span className="text-xs font-bold text-gray-400 w-6">
                            {index + 1}.
                          </span>
                          <Icon size={16} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            {step.name}
                          </span>
                          {step.credits === 0 ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-bold rounded">
                              FREE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-bold rounded">
                              {step.credits} credits
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Credits */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Credits
                  </span>
                  <div className="text-right">
                    <span className="text-xl font-bold text-brand-orange">
                      {workflow.totalCredits}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">
                      credits
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkflowManager;
