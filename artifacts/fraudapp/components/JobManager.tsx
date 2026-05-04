import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, ExternalLink, Edit2, Copy, Check, Share2, Globe,
  Workflow as WorkflowIcon, LayoutGrid, List, MoreHorizontal,
  Users, Eye, MousePointerClick, TrendingUp, X, ChevronRight, ChevronLeft,
  Sparkles, MapPin, Clock, Search, ShieldCheck
} from 'lucide-react';
import { Job, CompanyProfile, Workflow } from '../types';
import { getJobsByCompany, createJob, updateJob, generateSlug, supabase, COLLECTIONS } from '../services/supabase';
import { useToast } from './Toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface JobManagerProps {
  currentCompany: CompanyProfile;
}

const JobManager: React.FC<JobManagerProps> = ({ currentCompany }) => {
  const toast = useToast();

  // -- DATA STATE --
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // -- UI STATE --
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedCareerPage, setCopiedCareerPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // -- FORM STATE --
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    jobType: 'Full-time' as Job['jobType'],
    description: '',
    enableInstantAssessment: true,
    workflowId: '',
    status: 'Active' as Job['status']
  });

  // -- LOAD DATA --
  useEffect(() => {
    loadJobs();
    loadWorkflows();
  }, [currentCompany.id]);

  const loadWorkflows = async () => {
    try {
      setIsLoadingWorkflows(true);
      const { data } = await supabase.from(COLLECTIONS.WORKFLOWS).select('*').eq('companyId', currentCompany.id);
      setWorkflows((data || []) as Workflow[]);
    } catch (error) {
      console.error('[JOBS] Error loading workflows:', error);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const fetchedJobs = await getJobsByCompany(currentCompany.id);
      setJobs(fetchedJobs);
    } catch (error: any) {
      console.error('[JOBS] Error loading jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // -- ACTIONS --
  const handleOpenWizard = (job?: Job) => {
    if (!job && workflows.length === 0) {
      toast.error('❌ Harap buat Workflow terlebih dahulu di menu Workflow.');
      return;
    }

    if (job) {
      setEditingJob(job);
      setFormData({
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        description: job.description,
        enableInstantAssessment: job.enableInstantAssessment,
        workflowId: job.workflowId || '',
        status: job.status
      });
    } else {
      setEditingJob(null);
      setFormData({
        title: '',
        location: '',
        jobType: 'Full-time',
        description: '',
        enableInstantAssessment: true,
        workflowId: '',
        status: 'Active'
      });
    }
    setWizardStep(1);
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setEditingJob(null);
    setWizardStep(1);
  };

  const handleSave = async () => {
    if (isSaving) return;

    try {
      // Validation
      if (!formData.title || !formData.location || !formData.description || !formData.workflowId) {
        toast.warning('Mohon lengkapi semua data wajib (Workflow, Judul, Lokasi, Deskripsi)');
        return;
      }

      setIsSaving(true);
      const slug = generateSlug(formData.title);

      if (editingJob) {
        await updateJob(editingJob.id!, { ...formData, slug });
        toast.success('Lowongan berhasil diupdate!');
      } else {
        await createJob({
          companyId: currentCompany.id,
          slug,
          ...formData
        });
        toast.success('Lowongan berhasil dibuat!');
      }

      handleCloseWizard();
      await loadJobs();
    } catch (error: any) {
      toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    const companySlug = currentCompany.companySlug || generateSlug(currentCompany.name);
    const link = `${window.location.origin}/jobs/${companySlug}/${job.slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(job.id!);
    toast.success('Link lowongan disalin!');
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getJobLink = (job: Job) => {
    const companySlug = currentCompany.companySlug || generateSlug(currentCompany.name);
    return `${window.location.origin}/jobs/${companySlug}/${job.slug}`;
  };

  const filteredJobs = jobs.filter(job => {
    const q = (searchQuery || '').toLowerCase();
    const title = (job?.title || '').toLowerCase();
    const location = (job?.location || '').toLowerCase();
    return title.includes(q) || location.includes(q);
  });

  // -- RENDER WIZARD STEPS --
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1: // Essentials
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-orange-100 text-[#D95D00] rounded-full flex items-center justify-center mx-auto mb-2">
                <Briefcase size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Job Essentials</h3>
              <p className="text-sm text-slate-500">Informasi dasar posisi yang dibuka</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Judul Posisi</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Senior Marketing Manager"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D95D00] outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Lokasi</label>
                  <input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Jakarta / Remote"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D95D00] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tipe</label>
                  <select
                    value={formData.jobType}
                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#D95D00] outline-none bg-white"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              {/* Templates */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Templates</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setFormData({ ...formData, title: 'Sales Executive', location: 'Jakarta', jobType: 'Full-time' })}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600 transition-colors"
                  >
                    Sales
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, title: 'Software Engineer', location: 'Remote', jobType: 'Full-time' })}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600 transition-colors"
                  >
                    Developer
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, title: 'Admin Staff', location: 'Bandung', jobType: 'Contract' })}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium text-slate-600 transition-colors"
                  >
                    Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Description
        return (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 flex flex-col h-[500px]">
            <div className="text-center mb-2">
              <h3 className="text-lg font-bold text-slate-800">Job Description</h3>
              <p className="text-sm text-slate-500">Jelaskan tanggung jawab dan kualifikasi</p>
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-300 overflow-hidden flex flex-col">
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={(val) => setFormData({ ...formData, description: val })}
                className="h-full flex flex-col"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                  ],
                }}
              />
            </div>
          </div>
        );

      case 3: { // Intelligence (Workflow)
        const safeWorkflows = (workflows || []).map(w => ({
          ...w,
          steps: Array.isArray(w?.steps) ? w.steps : [],
        }));
        const selectedWorkflow = safeWorkflows.find(w => w.id === formData.workflowId);
        const computeCredits = (wf: any) =>
          (wf?.totalCredits ?? (wf?.steps || []).reduce(
            (s: number, st: any) => s + (Number(st?.credits) || 0),
            0
          ));

        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <WorkflowIcon size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Intelligence & Workflow</h3>
              <p className="text-sm text-slate-500">Atur alur seleksi otomatis</p>
            </div>

            <div className="space-y-6">
              {/* Workflow Selector */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Workflow Seleksi <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 gap-3">
                  {safeWorkflows.length === 0 && (
                    <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 text-center">
                      Belum ada workflow. Silakan buat workflow terlebih dahulu di menu Workflow.
                    </div>
                  )}
                  {safeWorkflows.map(wf => (
                    <div
                      key={wf.id}
                      onClick={() => setFormData({ ...formData, workflowId: wf.id ?? '' })}
                      className={cn(
                        "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between group",
                        formData.workflowId === wf.id
                          ? "border-[#D95D00] bg-orange-50"
                          : "border-slate-200 hover:border-orange-200 bg-white"
                      )}
                    >
                      <div>
                        <div className="font-bold text-slate-800">{wf.name || 'Untitled'}</div>
                        <div className="text-xs text-slate-500 mt-1 flex gap-2">
                          <span className="flex items-center gap-1"><List size={12} /> {wf.steps.length} Steps</span>
                          <span className="flex items-center gap-1"><TrendingUp size={12} /> {computeCredits(wf)} Credits</span>
                        </div>
                      </div>
                      {formData.workflowId === wf.id && <Check className="text-[#D95D00]" />}
                    </div>
                  ))}
                </div>
                {selectedWorkflow && (
                  <div className="mt-4 p-3 bg-slate-100 rounded-lg">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-2">Preview Steps:</div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {selectedWorkflow.steps.map((step, idx) => (
                        <div key={idx} className="flex items-center shrink-0">
                          <div className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 whitespace-nowrap">
                            {idx + 1}. {step.name}
                          </div>
                          {idx < selectedWorkflow.steps.length - 1 && (
                            <div className="w-4 h-px bg-slate-300 mx-1"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Instant Assessment Toggle */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#FFF4EC] to-[#FFE8D6] p-6 rounded-2xl border border-orange-100 flex items-center justify-between group cursor-pointer hover:border-orange-300 transition-all"
                onClick={() => setFormData({ ...formData, enableInstantAssessment: !formData.enableInstantAssessment })}
              >
                {/* "Gamlor" / Illustration Background */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldCheck size={120} className="text-[#D95D00]" />
                </div>

                <div className="relative z-10 max-w-md">
                  <div className="font-bold text-[#D95D00] flex items-center gap-2 mb-1 text-lg">
                    <div className="p-1.5 bg-[#D95D00] rounded-lg text-white">
                      <Sparkles size={16} />
                    </div>
                    Instant Integrity Assessment
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Kandidat otomatis dites integritas (Fraud Triangle) sesaat setelah melamar.
                    <span className="block mt-1 text-xs font-bold text-slate-400">Recommended for High-Risk Roles</span>
                  </p>
                </div>

                <div className="relative z-10 pl-6">
                  <div className={cn(
                    "relative inline-flex h-8 w-14 items-center rounded-full transition-colors shadow-inner",
                    formData.enableInstantAssessment ? 'bg-[#D95D00]' : 'bg-slate-300'
                  )}>
                    <span className={cn(
                      "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md",
                      formData.enableInstantAssessment ? 'translate-x-7' : 'translate-x-1'
                    )} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 4: // Review
        return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm ring-4 ring-green-50">
                <Check size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Siap Publikasi?</h3>
              <p className="text-sm text-slate-500">Pastikan semua data sudah benar sebelum live.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <span className="text-sm text-slate-500">Posisi</span>
                <span className="text-sm font-bold text-slate-800">{formData.title}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <span className="text-sm text-slate-500">Lokasi & Tipe</span>
                <span className="text-sm font-medium text-slate-800">{formData.location} • {formData.jobType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <span className="text-sm text-slate-500">Workflow</span>
                <span className="text-sm font-medium text-slate-800">{workflows.find(w => w.id === formData.workflowId)?.name || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Auto Assessment</span>
                <span className={cn("text-xs font-bold px-2 py-1 rounded-full", formData.enableInstantAssessment ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>
                  {formData.enableInstantAssessment ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-20 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Job Command Center
          </h2>
          <p className="text-slate-500 mt-1">Kelola lowongan dan pantau performa rekrutmen.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari lowongan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D00] shadow-sm"
            />
          </div>
          <button
            onClick={() => handleOpenWizard()}
            className="bg-[#D95D00] hover:bg-[#b14d00] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} /> Buat Lowongan
          </button>
        </div>
      </div>

      {/* CAREER PAGE PROMO */}
      <div className="bg-gradient-to-r from-[#D95D00] to-[#FF8C00] rounded-2xl p-6 text-white shadow-xl shadow-orange-500/20 mb-10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 group-hover:bg-white/20 transition-colors"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/5 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>

        <div className="relative z-10 pt-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white/20 p-1 rounded-md backdrop-blur-sm">
              <Globe className="text-white" size={16} />
            </div>
            <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Public Career Page</span>
          </div>
          <h3 className="text-2xl font-bold mb-2">Bagikan Portal Karir Anda</h3>
          <p className="text-white/90 text-sm max-w-lg leading-relaxed">
            Satu link untuk semua lowongan aktif. Pasang di Bio Instagram atau LinkedIn Company Page untuk menjangkau lebih banyak talenta.
          </p>
        </div>

        <div className="flex flex-col gap-2 relative z-10 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 shadow-lg">
            <div className="px-3 py-1.5 font-mono text-xs text-white truncate max-w-[200px] select-all">
              {window.location.origin}/jobs/{currentCompany.companySlug}
            </div>
            <button
              onClick={() => {
                const link = `${window.location.origin}/jobs/${currentCompany.companySlug || generateSlug(currentCompany.name)}`;
                navigator.clipboard.writeText(link);
                setCopiedCareerPage(true);
                setTimeout(() => setCopiedCareerPage(false), 2000);
                toast.success('Link karir disalin!');
              }}
              className="px-4 py-2 bg-white text-[#D95D00] rounded-lg text-xs font-bold hover:bg-orange-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              {copiedCareerPage ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {copiedCareerPage ? 'Copied' : 'Copy Link'}
            </button>
          </div>
          <a
            href={`${window.location.origin}/jobs/${currentCompany.companySlug || generateSlug(currentCompany.name)}`}
            target="_blank"
            className="text-xs text-white/80 hover:text-white flex items-center justify-end gap-1 px-2"
          >
            Preview Page <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* JOB CARDS GRID */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#D95D00] border-t-transparent"></div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="text-slate-400" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-700">Belum ada lowongan aktif</h3>
          <p className="text-slate-500 mb-6">Mulai rekrut talenta terbaik sekarang.</p>
          <button
            onClick={() => handleOpenWizard()}
            className="text-[#D95D00] font-bold hover:underline"
          >
            + Buat Lowongan Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map(job => (
            <div
              key={job.id}
              className={cn(
                "bg-white rounded-2xl p-5 border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden",
                job.status === 'Active' ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-75"
              )}
              onClick={() => handleOpenWizard(job)}
            >
              {/* Status Stripe */}
              <div className={cn(
                "absolute top-0 left-0 w-1 h-full",
                job.status === 'Active' ? "bg-[#D95D00]" : "bg-slate-300"
              )}></div>

              <div className="flex justify-between items-start mb-4 pl-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg group-hover:text-[#D95D00] transition-colors line-clamp-1" title={job.title}>
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <MapPin size={12} /> {job.location} • {job.jobType}
                  </div>
                </div>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  job.status === 'Active' ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-300"
                )}></div>
              </div>

              {/* Metrics / Funnel */}
              <div className="grid grid-cols-2 gap-3 mb-6 pl-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">Applied</div>
                  <div className="text-2xl font-bold text-slate-900">{job.applicantsCount || 0}</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <div className="text-xs text-blue-400 font-bold uppercase mb-1">Screened</div>
                  <div className="text-2xl font-bold text-blue-600">{job.applicantsCount || 0}</div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pl-3 pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    onClick={(e) => handleCopyLink(job, e)}
                    className="p-2 hover:bg-orange-50 text-slate-400 hover:text-[#D95D00] rounded-lg transition-colors"
                    title="Copy Link"
                  >
                    {copiedLink === job.id ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <a
                    href={getJobLink(job)}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                    title="View Public Page"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                <span className="text-xs font-bold text-slate-300 group-hover:text-[#D95D00] transition-colors flex items-center gap-1 cursor-pointer">
                  Edit Details <ChevronRight size={14} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WIZARD MODAL */}
      <AnimatePresence>
        {showWizard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={handleCloseWizard}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden relative z-10 flex flex-col"
            >
              {/* Wizard Header */}
              <div className="bg-white px-8 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map(step => (
                      <div
                        key={step}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-all duration-500",
                          wizardStep >= step ? "bg-[#D95D00]" : "bg-slate-200"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-slate-400">Step {wizardStep} of 4</span>
                </div>
                <button onClick={handleCloseWizard} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>

              {/* Wizard Body */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {renderWizardStep()}
              </div>

              {/* Wizard Footer */}
              <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex justify-between items-center">
                {wizardStep > 1 ? (
                  <button
                    onClick={() => setWizardStep(prev => prev - 1)}
                    className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                  >
                    Back
                  </button>
                ) : (
                  <div></div>
                )}

                {wizardStep < 4 ? (
                  <button
                    onClick={() => {
                      if (wizardStep === 1 && (!formData.title || !formData.location)) {
                        toast.warning('Isi judul dan lokasi dulu!');
                        return;
                      }
                      if (wizardStep === 3 && !formData.workflowId) {
                        toast.warning('Pilih workflow dulu!');
                        return;
                      }
                      setWizardStep(prev => prev + 1);
                    }}
                    className="px-8 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                  >
                    Next Step <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-2.5 rounded-xl bg-[#D95D00] text-white font-bold hover:bg-[#b14d00] shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
                  >
                    {isSaving ? 'Publishing...' : (editingJob ? 'Update Job' : 'Publish Job')}
                    {!isSaving && <RocketIcon />}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RocketIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>
)

export default JobManager;
