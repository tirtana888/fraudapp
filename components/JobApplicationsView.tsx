import React, { useState, useEffect } from 'react';
import { Briefcase, Users, Download, Eye, CheckCircle, XCircle, Clock, FileText, Phone, Mail, MapPin, Calendar, Filter, RefreshCw } from 'lucide-react';
import { InterviewSession, Job, JobApplication } from '../types';
import { db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';

interface JobApplicationsViewProps {
  companyId: string;
  onViewSession: (sessionId: string) => void;
}

interface ApplicationWithDetails extends InterviewSession {
  jobTitle?: string;
  jobLocation?: string;
  applicationStatus?: string;
  appliedAt?: string;
}

const JobApplicationsView: React.FC<JobApplicationsViewProps> = ({ companyId, onViewSession }) => {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      console.log('[JOB-APPLICATIONS] Loading data for company:', companyId);

      const jobsQuery = query(
        collection(db, COLLECTIONS.JOBS),
        where('companyId', '==', companyId)
      );
      const jobsSnapshot = await getDocs(jobsQuery);
      const jobsData = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Job));
      setJobs(jobsData);
      console.log('[JOB-APPLICATIONS] Loaded jobs:', jobsData.length);

      const sessionsQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where('companyId', '==', companyId),
        where('source', '==', 'job_application')
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);
      console.log('[JOB-APPLICATIONS] Found sessions:', sessionsSnapshot.docs.length);

      const applicationsWithDetails: ApplicationWithDetails[] = await Promise.all(
        sessionsSnapshot.docs.map(async (docSnap) => {
          const sessionData = { id: docSnap.id, ...docSnap.data() } as any;
          console.log('[JOB-APPLICATIONS] Processing session:', docSnap.id, sessionData);

          let jobTitle = 'Unknown Position';
          let jobLocation = 'Unknown Location';
          let applicationStatus = 'Pending';
          let appliedAt = sessionData.date;

          if (sessionData.jobId) {
            const jobDoc = await getDoc(doc(db, COLLECTIONS.JOBS, sessionData.jobId));
            if (jobDoc.exists()) {
              const job = jobDoc.data();
              jobTitle = job.title;
              jobLocation = job.location;
            }
          }

          if (sessionData.applicationId) {
            const appDoc = await getDoc(doc(db, COLLECTIONS.APPLICATIONS, sessionData.applicationId));
            if (appDoc.exists()) {
              const app = appDoc.data();
              applicationStatus = app.status;
              appliedAt = app.appliedAt || sessionData.date;
            }
          }

          return {
            ...sessionData,
            jobTitle,
            jobLocation,
            applicationStatus,
            appliedAt
          } as ApplicationWithDetails;
        })
      );

      applicationsWithDetails.sort((a, b) =>
        new Date(b.appliedAt || b.date).getTime() - new Date(a.appliedAt || a.date).getTime()
      );

      setApplications(applicationsWithDetails);
      console.log('[JOB-APPLICATIONS] ✅ Total applications loaded:', applicationsWithDetails.length);
      console.log('[JOB-APPLICATIONS] Applications:', applicationsWithDetails);
    } catch (error) {
      console.error('[JOB-APPLICATIONS] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredApplications = applications.filter(app => {
    if (selectedJob !== 'all' && app.jobId !== selectedJob) return false;
    if (statusFilter !== 'all' && app.applicationStatus !== statusFilter) return false;
    return true;
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Shortlisted': return 'bg-green-100 text-green-700 border-green-200';
      case 'Reviewed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'Shortlisted': return <CheckCircle size={14} />;
      case 'Rejected': return <XCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D95D00]/10 rounded-xl">
              <Briefcase className="text-[#D95D00]" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Aplikasi Lowongan</h2>
              <p className="text-sm text-gray-500">Kelola kandidat dari job portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="bg-[#D95D00]/10 border border-[#D95D00]/20 rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-[#D95D00]" />
                <span className="font-bold text-[#D95D00]">{filteredApplications.length}</span>
                <span className="text-sm text-gray-600">Aplikasi</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Filter:</span>
          </div>

          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">Semua Posisi ({applications.length})</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id}>
                {job.title} ({applications.filter(a => a.jobId === job.id).length})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">Semua Status</option>
            <option value="Pending">Pending</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {filteredApplications.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Briefcase size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Belum Ada Aplikasi</h3>
            <p className="text-gray-500">Aplikasi dari kandidat akan muncul di sini</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <div
                key={app.id}
                className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all bg-white hover:border-[#D95D00]/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-800">{app.candidate.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${getStatusColor(app.applicationStatus)}`}>
                        {getStatusIcon(app.applicationStatus)}
                        {app.applicationStatus}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={16} className="text-[#D95D00]" />
                        <span className="font-medium">{app.jobTitle}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} className="text-gray-400" />
                        <span>{app.jobLocation}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{new Date(app.appliedAt || app.date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail size={16} className="text-gray-400" />
                        <a href={`mailto:${app.candidate.email}`} className="hover:text-[#D95D00] transition-colors">
                          {app.candidate.email}
                        </a>
                      </div>
                      {app.whatsapp && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone size={16} className="text-gray-400" />
                          <a href={`https://wa.me/${app.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#D95D00] transition-colors">
                            {app.whatsapp}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {app.cvUrl && (
                      <a
                        href={app.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <Download size={16} />
                        CV
                      </a>
                    )}
                    <button
                      onClick={() => onViewSession(app.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors text-sm font-medium"
                    >
                      <Eye size={16} />
                      Detail
                    </button>
                  </div>
                </div>

                {app.transcript && app.transcript.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText size={14} />
                      <span>{app.transcript.length - 1} catatan interview</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[#D95D00]/10 to-[#F18F01]/10 border border-[#D95D00]/20 rounded-xl p-6">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Users size={20} className="text-[#D95D00]" />
          Tips: Kelola Aplikasi dengan Efisien
        </h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Klik <strong>Detail</strong> untuk melihat profil lengkap dan melakukan AI interview</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Download CV kandidat untuk review offline</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Gunakan filter untuk fokus pada posisi atau status tertentu</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Kontak kandidat langsung via email atau WhatsApp</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default JobApplicationsView;
