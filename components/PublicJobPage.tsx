import React, { useState, useEffect } from 'react';
import { MapPin, Briefcase, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { Job, CompanyProfile } from '../types';
import { getJobBySlug, createApplication, uploadCV, db } from '../services/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

interface PublicJobPageProps {
  companySlug: string;
  jobSlug: string;
}

const PublicJobPage: React.FC<PublicJobPageProps> = ({ companySlug, jobSlug }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    whatsapp: '',
    cvFile: null as File | null
  });

  useEffect(() => {
    loadJobData();
  }, [companySlug, jobSlug]);

  const loadJobData = async () => {
    try {
      setIsLoading(true);

      const companies = await getDocs(query(collection(db, 'companies')));
      const matchedCompany = companies.docs.find(doc => {
        const name = doc.data().name.toLowerCase().replace(/\s+/g, '-');
        return name === companySlug;
      });

      if (!matchedCompany) {
        console.error('[PUBLIC-JOB] Company not found');
        return;
      }

      const companyData = { id: matchedCompany.id, ...matchedCompany.data() } as CompanyProfile;
      setCompany(companyData);

      const jobData = await getJobBySlug(companyData.id, jobSlug);
      if (!jobData) {
        console.error('[PUBLIC-JOB] Job not found');
        return;
      }

      setJob(jobData);
    } catch (error) {
      console.error('[PUBLIC-JOB] Error loading job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Hanya file PDF yang diperbolehkan');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file maksimal 5MB');
        return;
      }
      setFormData({ ...formData, cvFile: file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email || !formData.whatsapp || !formData.cvFile) {
      alert('Mohon lengkapi semua field');
      return;
    }

    if (!job || !company) return;

    try {
      setIsSubmitting(true);
      console.log('[PUBLIC-JOB] Submitting application...');

      const tempApplicationId = crypto.randomUUID();

      console.log('[PUBLIC-JOB] Uploading CV...');
      const cvUrl = await uploadCV(tempApplicationId, formData.cvFile);
      console.log('[PUBLIC-JOB] CV uploaded:', cvUrl);

      const assessmentToken = job.enableInstantAssessment ? crypto.randomUUID() : undefined;

      const applicationData = {
        jobId: job.id!,
        companyId: company.id,
        fullName: formData.fullName,
        email: formData.email,
        whatsapp: formData.whatsapp,
        cvUrl,
        status: 'Pending' as const,
        assessmentToken,
        appliedAt: new Date().toISOString()
      };

      console.log('[PUBLIC-JOB] Creating application...');
      const applicationId = await createApplication(applicationData);
      console.log('[PUBLIC-JOB] Application created:', applicationId);

      if (job.enableInstantAssessment && assessmentToken) {
        console.log('[PUBLIC-JOB] Instant Assessment enabled, redirecting...');
        const redirectUrl = `${window.location.origin}/assessment/start?token=${assessmentToken}&job_id=${job.id}&app_id=${applicationId}`;
        console.log('[PUBLIC-JOB] Redirect URL:', redirectUrl);

        window.location.href = redirectUrl;
      } else {
        console.log('[PUBLIC-JOB] Manual application, showing success');
        setShowSuccess(true);
        setFormData({
          fullName: '',
          email: '',
          whatsapp: '',
          cvFile: null
        });
      }
    } catch (error: any) {
      console.error('[PUBLIC-JOB] Error submitting application:', error);
      alert(`Gagal mengirim aplikasi: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!job || !company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Lowongan Tidak Ditemukan</h1>
          <p className="text-gray-600">Lowongan yang Anda cari tidak tersedia</p>
        </div>
      </div>
    );
  }

  if (job.status !== 'Active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Lowongan Ditutup</h1>
          <p className="text-gray-600">Maaf, lowongan ini sudah ditutup</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          {company.logoUrl && (
            <img src={company.logoUrl} alt={company.name} className="h-12 w-auto object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{company.name}</h1>
            <p className="text-sm text-gray-600">Career Opportunities</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-[#0F172A] mb-4">{job.title}</h1>
                <div className="flex flex-wrap gap-4 text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" style={{ color: '#D95D00' }} />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" style={{ color: '#D95D00' }} />
                    <span>{job.jobType}</span>
                  </div>
                </div>
              </div>

              <div className="prose prose-slate max-w-none whitespace-pre-wrap">
                {job.description}
              </div>

              {job.enableInstantAssessment && (
                <div className="mt-8 bg-gradient-to-br from-orange-50 to-blue-50 border-2 border-[#D95D00] rounded-xl p-6">
                  <h3 className="text-lg font-bold text-[#0F172A] mb-2 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6" style={{ color: '#D95D00' }} />
                    Zero-Touch Screening Aktif
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Setelah submit aplikasi, Anda akan <strong>langsung diarahkan</strong> ke AI Integrity Assessment untuk proses screening otomatis. Proses ini hanya memakan waktu 10-15 menit.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sticky top-24">
              <h2 className="text-2xl font-bold text-[#0F172A] mb-6">Lamar Sekarang</h2>

              {showSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Aplikasi Terkirim!</h3>
                  <p className="text-gray-600">
                    Terima kasih telah melamar. Tim kami akan menghubungi Anda segera.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                      placeholder="John Doe"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                      placeholder="john@example.com"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
                      placeholder="+62 812 3456 7890"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Upload CV (PDF) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="cv-upload"
                        required
                        disabled={isSubmitting}
                      />
                      <label
                        htmlFor="cv-upload"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#D95D00] hover:bg-orange-50 transition-all"
                      >
                        <Upload className="w-5 h-5 text-gray-500" />
                        <span className="text-gray-700">
                          {formData.cvFile ? formData.cvFile.name : 'Pilih File PDF'}
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Max 5MB</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-lg text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#D95D00' }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      'Kirim Lamaran'
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicJobPage;
