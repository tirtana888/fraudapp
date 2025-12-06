import React, { useState, useEffect } from 'react';
import { MapPin, Briefcase, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { Job, CompanyProfile, AssessmentInvite } from '../types';
import { getJobBySlug, createApplication, uploadCV, db, sendEmailViaCloudFunction, COLLECTIONS, getCompanyBySlug } from '../services/firebase';
import { collection, getDocs, query, addDoc } from 'firebase/firestore';
import { useToast } from './Toast';

interface PublicJobPageProps {
  companySlug: string;
  jobSlug?: string;
}

const PublicJobPage: React.FC<PublicJobPageProps> = ({ companySlug, jobSlug }) => {
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
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

      const companyData = await getCompanyBySlug(companySlug);

      if (!companyData) {
        console.error('[PUBLIC-JOB] Company not found for slug:', companySlug);
        return;
      }

      setCompany(companyData);

      if (jobSlug) {
        const jobData = await getJobBySlug(companyData.id, jobSlug);
        if (!jobData) {
          console.error('[PUBLIC-JOB] Job not found');
          return;
        }
        setJob(jobData);
      } else {
        const jobsQuery = query(collection(db, COLLECTIONS.JOBS));
        const jobsSnapshot = await getDocs(jobsQuery);
        const allJobs = jobsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Job))
          .filter(j => j.companyId === companyData.id && j.status === 'Active');
        setJobs(allJobs);
      }
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
        toast.warning('Hanya file PDF yang diperbolehkan');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('Ukuran file maksimal 5MB');
        return;
      }
      setFormData({ ...formData, cvFile: file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[PUBLIC-JOB] ========== FORM SUBMIT START ==========');

    console.log('[PUBLIC-JOB] Form data:', {
      fullName: formData.fullName,
      email: formData.email,
      whatsapp: formData.whatsapp,
      cvFile: formData.cvFile ? {
        name: formData.cvFile.name,
        size: formData.cvFile.size,
        type: formData.cvFile.type
      } : null
    });

    if (!formData.fullName || !formData.email || !formData.whatsapp || !formData.cvFile) {
      console.error('[PUBLIC-JOB] Validation failed: missing required fields');
      toast.warning('Mohon lengkapi semua field');
      return;
    }
    console.log('[PUBLIC-JOB] Validation passed');

    if (!job || !company) {
      console.error('[PUBLIC-JOB] Job or Company data missing!');
      return;
    }
    console.log('[PUBLIC-JOB] Job and Company data OK:', {
      jobId: job.id,
      companyId: company.id,
      enableInstantAssessment: job.enableInstantAssessment
    });

    try {
      setIsSubmitting(true);
      console.log('[PUBLIC-JOB] Submit button disabled, showing spinner');

      const tempApplicationId = crypto.randomUUID();
      console.log('[PUBLIC-JOB] Generated temp application ID:', tempApplicationId);

      console.log('[PUBLIC-JOB] ===== STEP 1: UPLOADING CV =====');
      console.log('[PUBLIC-JOB] Calling uploadCV function...');
      const cvUrl = await uploadCV(tempApplicationId, formData.cvFile);
      console.log('[PUBLIC-JOB] ✅ CV uploaded successfully!');
      console.log('[PUBLIC-JOB] CV URL:', cvUrl);

      // Generate 5-character access code (same as manual invite)
      const accessCode = job.enableInstantAssessment
        ? Math.random().toString(36).slice(2, 7).toUpperCase()
        : null;

      if (accessCode) {
        console.log('[PUBLIC-JOB] Generated access code:', accessCode);
      }

      const applicationData: any = {
        jobId: job.id!,
        companyId: company.id,
        fullName: formData.fullName,
        email: formData.email,
        whatsapp: formData.whatsapp,
        cvUrl,
        status: 'Pending' as const,
        appliedAt: new Date().toISOString()
      };

      if (accessCode) {
        applicationData.accessCode = accessCode;
      }

      console.log('[PUBLIC-JOB] ===== STEP 2: CREATING APPLICATION =====');
      console.log('[PUBLIC-JOB] Application data:', applicationData);
      const applicationId = await createApplication(applicationData);
      console.log('[PUBLIC-JOB] ✅ Application created with ID:', applicationId);

      if (job.enableInstantAssessment && accessCode) {
        console.log('[PUBLIC-JOB] ===== STEP 3: CREATE INVITE & SEND EMAIL =====');
        try {
          // Save to invites collection (same as manual invite)
          const inviteData: any = {
            access_code: accessCode,
            name: formData.fullName,
            email: formData.email,
            role: job.title,
            companyId: company.id,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            jobId: job.id,
            applicationId: applicationId
          };

          await addDoc(collection(db, COLLECTIONS.INVITES), inviteData);
          console.log('[PUBLIC-JOB] ✅ Invite saved to database');

          // Send email (same format as manual invite)
          const assessmentLink = `${window.location.origin}?mode=assess`;

          const emailSent = await sendEmailViaCloudFunction(
            "candidate_invitation",
            formData.email,
            {
              candidateName: formData.fullName,
              candidateEmail: formData.email,
              companyName: company.name,
              accessCode: accessCode,
              assessmentLink: assessmentLink,
              role: job.title
            }
          );

          if (emailSent) {
            console.log('[PUBLIC-JOB] ✅ Assessment invitation email sent successfully');
          } else {
            console.warn('[PUBLIC-JOB] ⚠️ Assessment invitation email failed to send');
          }
        } catch (emailError) {
          console.error('[PUBLIC-JOB] ❌ Error in invite/email process:', emailError);
        }
      }

      console.log('[PUBLIC-JOB] ===== STEP 4: SHOWING SUCCESS MESSAGE =====');
      setShowSuccess(true);
      setFormData({
        fullName: '',
        email: '',
        whatsapp: '',
        cvFile: null
      });
      console.log('[PUBLIC-JOB] Form cleared, success modal shown');

      console.log('[PUBLIC-JOB] ========== FORM SUBMIT SUCCESS ==========');
    } catch (error: any) {
      console.error('[PUBLIC-JOB] ========== FORM SUBMIT FAILED ==========');
      console.error('[PUBLIC-JOB] Error:', error);
      console.error('[PUBLIC-JOB] Error name:', error.name);
      console.error('[PUBLIC-JOB] Error message:', error.message);
      console.error('[PUBLIC-JOB] Error stack:', error.stack);

      toast.error(`Gagal mengirim aplikasi: ${error.message}`);
    } finally {
      console.log('[PUBLIC-JOB] Cleanup: Re-enabling submit button');
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

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Perusahaan Tidak Ditemukan</h1>
          <p className="text-gray-600">Perusahaan yang Anda cari tidak tersedia</p>
        </div>
      </div>
    );
  }

  if (!jobSlug) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-6">
              {company.logoUrl && (
                <img src={company.logoUrl} alt={company.name} className="h-16 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-3xl font-bold text-[#0F172A]">{company.name}</h1>
                <p className="text-gray-600 mt-1">Temukan karir impian Anda bersama kami</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-8">Lowongan Tersedia</h2>

          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Belum Ada Lowongan</h3>
              <p className="text-gray-600">Saat ini belum ada lowongan yang tersedia. Silakan cek kembali nanti.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((j) => (
                <a
                  key={j.id}
                  href={`/jobs/${companySlug}/${j.slug}`}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-[#D95D00] transition-all group"
                >
                  <h3 className="text-xl font-bold text-[#0F172A] mb-3 group-hover:text-[#D95D00] transition-colors">
                    {j.title}
                  </h3>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <MapPin className="w-4 h-4" style={{ color: '#D95D00' }} />
                      <span>{j.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                      <Briefcase className="w-4 h-4" style={{ color: '#D95D00' }} />
                      <span>{j.jobType}</span>
                    </div>
                  </div>
                  {j.enableInstantAssessment && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-orange-100 to-blue-100 text-[#D95D00] rounded-full text-xs font-semibold">
                      <CheckCircle className="w-3 h-3" />
                      Zero-Touch Screening
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm font-semibold text-[#D95D00] group-hover:underline">
                      Lihat Detail →
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <footer className="bg-white border-t border-gray-200 mt-16 py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm text-gray-600">Powered by</p>
              <a
                href="https://hiregood.one"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 group"
              >
                <img
                  src="/untitled_design_(43).png"
                  alt="HireGood Logo"
                  className="h-6 w-6 object-contain"
                />
                <span className="font-semibold text-[#D95D00] group-hover:text-[#B14D00] transition-colors">
                  HireGood.one
                </span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (!job) {
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

              <div
                className="prose prose-slate max-w-none ql-editor"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />

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
                <div className="py-8">
                  <div className="text-center mb-6">
                    <CheckCircle className="w-20 h-20 mx-auto mb-4 text-green-600" />
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Aplikasi Terkirim!</h3>
                    <p className="text-gray-600 mb-4">
                      Terima kasih telah melamar ke posisi <strong>{job.title}</strong>
                    </p>
                  </div>

                  {job.enableInstantAssessment ? (
                    <div className="bg-gradient-to-br from-orange-50 to-blue-50 border-2 border-[#D95D00] rounded-xl p-6">
                      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-[#D95D00]" />
                        Langkah Selanjutnya: AI Integrity Assessment
                      </h4>
                      <div className="space-y-3 text-sm text-gray-700">
                        <p>
                          <strong>Cek Email Anda</strong> untuk mendapatkan link dan kode akses ke assessment.
                        </p>
                        <p>
                          Assessment ini akan membantu kami memahami integritas dan kesesuaian Anda dengan posisi yang dilamar.
                        </p>
                        <div className="bg-white rounded-lg p-4 mt-4">
                          <p className="font-semibold text-gray-800 mb-2">Durasi: 10-15 menit</p>
                          <ul className="list-disc list-inside space-y-1 text-gray-600">
                            <li>Pertanyaan self-assessment</li>
                            <li>Scenario-based questions</li>
                            <li>AI interview chat</li>
                          </ul>
                        </div>
                        <p className="text-xs text-gray-500 italic mt-3">
                          📧 Email akan dikirim dalam beberapa menit. Periksa folder spam jika tidak ditemukan di inbox.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Tim kami akan meninjau aplikasi Anda dan menghubungi Anda melalui email atau WhatsApp untuk langkah selanjutnya.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => window.location.href = '/'}
                    className="w-full mt-6 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
                  >
                    Kembali ke Beranda
                  </button>
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

      {/* Footer - Powered by HireGood */}
      <footer className="bg-white border-t border-gray-200 mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-gray-600">Powered by</p>
            <a
              href="https://hiregood.one"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 group"
            >
              <img
                src="/untitled_design_(43).png"
                alt="HireGood Logo"
                className="h-6 w-6 object-contain"
              />
              <span className="font-semibold text-[#D95D00] group-hover:text-[#B14D00] transition-colors">
                HireGood.one
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicJobPage;
