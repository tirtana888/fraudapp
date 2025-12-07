import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, ExternalLink, Edit2, Copy, Check, Share2, Globe, Workflow as WorkflowIcon } from 'lucide-react';
import { Job, CompanyProfile, Workflow } from '../types';
import { getJobsByCompany, createJob, updateJob, generateSlug, db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from './Toast';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface JobManagerProps {
  currentCompany: CompanyProfile;
}

const JobManager: React.FC<JobManagerProps> = ({ currentCompany }) => {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedCareerPage, setCopiedCareerPage] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    jobType: 'Full-time' as Job['jobType'],
    description: '',
    enableInstantAssessment: true,
    workflowId: '',
    status: 'Active' as Job['status']
  });

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  useEffect(() => {
    loadJobs();
    loadWorkflows();
  }, [currentCompany.id]);

  const loadWorkflows = async () => {
    try {
      setIsLoadingWorkflows(true);
      const q = query(
        collection(db, COLLECTIONS.WORKFLOWS),
        where('companyId', '==', currentCompany.id)
      );
      const snapshot = await getDocs(q);
      const workflowsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Workflow[];
      setWorkflows(workflowsData);
      console.log('[JOBS] Loaded workflows:', workflowsData.length);
    } catch (error) {
      console.error('[JOBS] Error loading workflows:', error);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const loadJobs = async () => {
    try {
      console.log('[JOBS] Loading jobs for company:', currentCompany.id);
      setIsLoading(true);
      const fetchedJobs = await getJobsByCompany(currentCompany.id);
      console.log('[JOBS] Fetched jobs:', fetchedJobs);
      console.log('[JOBS] Number of jobs:', fetchedJobs.length);
      setJobs(fetchedJobs);
    } catch (error: any) {
      console.error('[JOBS] Error loading jobs:', error);
      console.error('[JOBS] Error details:', {
        message: error.message,
        code: error.code
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (job?: Job) => {
    if (job) {
      setEditingJob(job);
      setFormData({
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        description: job.description,
        enableInstantAssessment: job.enableInstantAssessment,
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
        status: 'Active'
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingJob(null);
  };

  const handleSave = async () => {
    try {
      console.log('[JOBS] Starting save process...');
      console.log('[JOBS] Form data:', formData);
      console.log('[JOBS] Company ID:', currentCompany.id);

      if (!formData.title || !formData.location || !formData.description) {
        toast.warning('Mohon lengkapi semua field yang wajib diisi');
        return;
      }

      const slug = generateSlug(formData.title);
      console.log('[JOBS] Generated slug:', slug);

      if (editingJob) {
        console.log('[JOBS] Updating existing job:', editingJob.id);
        await updateJob(editingJob.id!, {
          ...formData,
          slug
        });
        toast.success('Lowongan berhasil diupdate!');
      } else {
        console.log('[JOBS] Creating new job...');
        const jobData = {
          companyId: currentCompany.id,
          slug,
          ...formData
        };
        console.log('[JOBS] Job data to create:', jobData);

        const jobId = await createJob(jobData);
        console.log('[JOBS] Job created with ID:', jobId);
        toast.success('Lowongan berhasil dibuat!');
      }

      handleCloseModal();
      console.log('[JOBS] Reloading jobs list...');
      await loadJobs();
      console.log('[JOBS] Jobs list reloaded');
    } catch (error: any) {
      console.error('[JOBS] Error saving job:', error);
      console.error('[JOBS] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      toast.error(`Gagal menyimpan lowongan: ${error.message}`);
    }
  };

  const handleCopyLink = (job: Job) => {
    const companySlug = currentCompany.companySlug || generateSlug(currentCompany.name);
    const link = `${window.location.origin}/jobs/${companySlug}/${job.slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(job.id!);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getJobLink = (job: Job) => {
    const companySlug = currentCompany.companySlug || generateSlug(currentCompany.name);
    return `${window.location.origin}/jobs/${companySlug}/${job.slug}`;
  };

  const getCareerPageLink = () => {
    return `${window.location.origin}/careers/${currentCompany.id}`;
  };

  const handleCopyCareerPageLink = () => {
    const link = getCareerPageLink();
    navigator.clipboard.writeText(link);
    setCopiedCareerPage(true);
    toast.success('Link Laman Karir disalin ke clipboard!');
    setTimeout(() => setCopiedCareerPage(false), 2000);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#0F172A] flex items-center gap-3">
            <Briefcase className="w-8 h-8" style={{ color: '#D95D00' }} />
            Kelola Lowongan
          </h2>
          <p className="text-gray-600 mt-2">
            Buat lowongan dan aktifkan "Zero-Touch Recruitment" untuk screening otomatis
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium shadow-lg hover:shadow-xl transition-all"
          style={{ backgroundColor: '#D95D00' }}
        >
          <Plus className="w-5 h-5" />
          Buat Lowongan Baru
        </button>
      </div>

      {/* Career Page Card */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-xl p-4 mb-8 border border-orange-200 dark:border-orange-900/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              Laman Karir Perusahaan
              <span className="px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded">
                BARU
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Halaman yang menampilkan semua lowongan aktif perusahaan Anda. Bagikan link ini di Bio Instagram, LinkedIn, atau media sosial lainnya.
            </p>
            <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-orange-300 dark:border-orange-700">
              <code className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                {getCareerPageLink()}
              </code>
              <button
                onClick={handleCopyCareerPageLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm rounded-lg font-medium transition-all whitespace-nowrap"
              >
                {copiedCareerPage ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Disalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Link
                  </>
                )}
              </button>
              <a
                href={getCareerPageLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                title="Preview"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              <Share2 className="w-3 h-3 inline mr-1" />
              Tips: Tambahkan logo di <strong>Pengaturan → Profil Perusahaan</strong>
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#D95D00' }}></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Belum ada lowongan</h3>
          <p className="text-gray-500 mb-6">Mulai buat lowongan pertama Anda dengan klik tombol di atas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Judul Lowongan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Lokasi
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Pelamar
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Auto-Screen
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#0F172A]">{job.title}</span>
                        <span className="text-sm text-gray-500">{job.jobType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{job.location}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold" style={{ backgroundColor: '#D95D00', color: 'white' }}>
                        {job.applicantsCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          job.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {job.enableInstantAssessment ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          <Check className="w-4 h-4" />
                          Aktif
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Manual</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(job)}
                          className="p-2 text-gray-600 hover:text-[#D95D00] hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(job)}
                          className="p-2 text-gray-600 hover:text-[#D95D00] hover:bg-orange-50 rounded-lg transition-colors"
                          title="Copy Link"
                        >
                          {copiedLink === job.id ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                        <a
                          href={getJobLink(job)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-600 hover:text-[#D95D00] hover:bg-orange-50 rounded-lg transition-colors"
                          title="Lihat Halaman Publik"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#0F172A]">
                {editingJob ? 'Edit Lowongan' : 'Buat Lowongan Baru'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-8 py-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Judul Lowongan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Senior Software Engineer"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                />
                {formData.title && (
                  <p className="text-xs text-gray-500 mt-1">
                    Slug: <code className="bg-gray-100 px-2 py-0.5 rounded">{generateSlug(formData.title)}</code>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Lokasi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Jakarta, Indonesia"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipe Pekerjaan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.jobType}
                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value as Job['jobType'] })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Deskripsi Lowongan <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#D95D00] focus-within:border-transparent transition-all">
                  <ReactQuill
                    theme="snow"
                    value={formData.description}
                    onChange={(value) => setFormData({ ...formData, description: value })}
                    placeholder="Tulis deskripsi lengkap lowongan... Gunakan toolbar untuk formatting (Bold, List, dll)"
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['clean']
                      ]
                    }}
                    style={{ minHeight: '300px' }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 <strong>Tip:</strong> Gunakan toolbar di atas untuk <strong>Bold</strong> kata penting seperti "Underwriter", "Requirements", dll. Tekan <strong>Ctrl+B</strong> untuk bold cepat.
                </p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-blue-50 border-2 border-[#D95D00] rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-[#0F172A] mb-2">
                      Enable Instant Integrity Assessment
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Jika diaktifkan, kandidat yang melamar akan <strong>langsung diarahkan</strong> ke AI Integrity Test setelah submit aplikasi. Jika dimatikan, mereka hanya mengirim CV tanpa assessment otomatis.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, enableInstantAssessment: !formData.enableInstantAssessment })}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        formData.enableInstantAssessment ? 'bg-[#D95D00]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          formData.enableInstantAssessment ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status Lowongan
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Job['status'] })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                >
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-8 py-6 flex justify-end gap-4 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 rounded-lg text-white font-medium shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: '#D95D00' }}
              >
                {editingJob ? 'Update Lowongan' : 'Buat Lowongan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobManager;
