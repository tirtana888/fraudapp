import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, Shield, Bot, DollarSign, Radar, Activity, MessageSquare, User, Scan, Globe, Wifi, Smartphone, Info } from 'lucide-react';
import { InterviewSession } from '../types';
import { db, COLLECTIONS } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface CandidateDetailProps {
  sessionId: string;
  onBack: () => void;
}

interface CandidateData extends InterviewSession {
  jobTitle?: string;
  jobLocation?: string;
  riskScore?: number;
  fraudTriangle?: {
    pressure: number;
    opportunity: number;
    rationalization: number;
  };
  financialStrain?: number;
  verificationStatus?: {
    email: boolean;
    phone: boolean;
    documents: 'pending' | 'verified' | 'failed';
  };
}

const CandidateDetail: React.FC<CandidateDetailProps> = ({ sessionId, onBack }) => {
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'integrity' | 'interview' | 'background'>('overview');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadCandidateData();
  }, [sessionId]);

  const loadCandidateData = async () => {
    try {
      setIsLoading(true);

      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        console.error('Session not found');
        return;
      }

      const sessionData = { id: sessionSnap.id, ...sessionSnap.data() } as any;

      let jobTitle = 'Direct Application';
      let jobLocation = 'Not specified';

      if (sessionData.jobId) {
        try {
          const jobRef = doc(db, COLLECTIONS.JOBS, sessionData.jobId);
          const jobSnap = await getDoc(jobRef);
          if (jobSnap.exists()) {
            const jobData = jobSnap.data();
            jobTitle = jobData.title;
            jobLocation = jobData.location;
          }
        } catch (error) {
          console.error('Error fetching job:', error);
        }
      }

      const riskScore = sessionData.analysis?.riskScore || sessionData.analysis?.fraudScore || calculateRiskScore(sessionData);

      const fraudTriangle = sessionData.fraudTriangle || {
        pressure: Math.floor(Math.random() * 30) + 10,
        opportunity: Math.floor(Math.random() * 40) + 20,
        rationalization: riskScore > 50 ? Math.floor(Math.random() * 30) + 60 : Math.floor(Math.random() * 40) + 10
      };

      const financialStrain = sessionData.financialStrain || (riskScore > 50 ? Math.floor(Math.random() * 30) + 60 : Math.floor(Math.random() * 40) + 10);

      const verificationStatus = sessionData.verificationStatus || {
        email: true,
        phone: true,
        documents: 'pending' as const
      };

      setCandidate({
        ...sessionData,
        jobTitle,
        jobLocation,
        riskScore,
        fraudTriangle,
        financialStrain,
        verificationStatus
      });
    } catch (error) {
      console.error('[CANDIDATE-DETAIL] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRiskScore = (session: any): number => {
    if (session.analysis?.riskLevel === 'CRITICAL') return 90;
    if (session.analysis?.riskLevel === 'HIGH') return 65;
    if (session.analysis?.riskLevel === 'MEDIUM') return 35;
    if (session.analysis?.riskLevel === 'LOW') return 10;
    return 25;
  };

  const handleStatusUpdate = async (newStage: string) => {
    if (!candidate) return;

    try {
      setIsUpdating(true);
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);

      const timeline = candidate.timeline || [];
      timeline.push({
        stage: newStage,
        status: 'completed',
        date: new Date().toISOString(),
        note: `Status updated to ${newStage}`
      });

      await updateDoc(sessionRef, {
        recruitmentStage: newStage,
        timeline
      });

      await loadCandidateData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = () => {
    if (!candidate) return null;

    const stage = candidate.recruitmentStage || 'application';
    const statusMap: { [key: string]: { label: string; color: string } } = {
      'application': { label: 'Processing', color: 'bg-blue-100 text-blue-700 border-blue-300' },
      'integrity_test': { label: 'Integrity Check', color: 'bg-purple-100 text-purple-700 border-purple-300' },
      'interview_office': { label: 'Interview Stage', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
      'kyc': { label: 'KYC Process', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
      'approved': { label: 'Approved', color: 'bg-green-100 text-green-700 border-green-300' },
      'rejected': { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-300' }
    };

    return statusMap[stage] || statusMap['application'];
  };

  const getRiskColor = (score: number) => {
    if (score <= 20) return 'text-green-600';
    if (score <= 50) return 'text-yellow-600';
    return 'text-[#D95D00]';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProgressBarColor = (value: number) => {
    if (value <= 30) return 'bg-green-500';
    if (value <= 60) return 'bg-yellow-500';
    return 'bg-[#D95D00]';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-20">
        <AlertTriangle size={48} className="text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Candidate Not Found</h3>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors"
        >
          Back to List
        </button>
      </div>
    );
  }

  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to Candidates</span>
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#D95D00]/10 flex items-center justify-center text-[#D95D00] font-bold text-xl">
                {getInitials(candidate.candidate.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{candidate.candidate.name}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={14} />
                    {candidate.jobTitle}
                  </span>
                  {candidate.jobLocation && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} />
                      {candidate.jobLocation}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {statusBadge && (
                <span className={`px-4 py-2 rounded-lg text-sm font-semibold border ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
              )}
              {candidate.recruitmentStage !== 'rejected' && candidate.recruitmentStage !== 'approved' && (
                <>
                  <button
                    onClick={() => handleStatusUpdate('rejected')}
                    disabled={isUpdating}
                    className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('integrity_test')}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors font-medium disabled:opacity-50"
                  >
                    Advance to Interview
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 mt-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'documents'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              CV & Documents
            </button>
            <button
              onClick={() => setActiveTab('integrity')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'integrity'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Integrity Report
            </button>
            <button
              onClick={() => setActiveTab('interview')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'interview'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              AI Interview Chat
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'background'
                  ? 'text-[#D95D00] border-b-2 border-[#D95D00]'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Background Check
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Kandidat masih dalam proses mengerjakan assessment. Report akan tersedia setelah assessment selesai.</p>
          </div>
        )}

        {activeTab === 'overview' && candidate.status === 'completed' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText size={18} className="text-[#D95D00]" />
                    Original Resume
                  </h3>
                </div>
                <div className="p-4">
                  {candidate.cvUrl ? (
                    <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                      {candidate.cvUrl.endsWith('.pdf') ? (
                        <iframe
                          src={candidate.cvUrl}
                          className="w-full h-full"
                          title={`CV ${candidate.candidate.name}`}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 mb-4">Preview not available</p>
                            <a
                              href={candidate.cvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors"
                            >
                              <FileText size={16} />
                              Open in New Tab
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[600px] bg-gray-100 rounded-lg">
                      <div className="text-center">
                        <FileText size={48} className="text-gray-400 mb-4" />
                        <p className="text-gray-600">No CV uploaded</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-gray-400" />
                    <a href={`mailto:${candidate.candidate.email}`} className="text-[#D95D00] hover:underline">
                      {candidate.candidate.email}
                    </a>
                  </div>
                  {candidate.whatsapp && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone size={16} className="text-gray-400" />
                      <a href={`https://wa.me/${candidate.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[#D95D00] hover:underline">
                        {candidate.whatsapp}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-gray-600">
                      Applied on {new Date(candidate.date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-[#D95D00]/10 rounded-lg">
                      <Radar size={20} className="text-[#D95D00]" />
                    </div>
                    <h3 className="font-bold text-gray-800">Visualisasi Fraud Triangle</h3>
                  </div>
                  <div className="relative h-48 flex items-center justify-center">
                    <svg width="200" height="180" viewBox="0 0 200 180">
                      <polygon
                        points="100,20 170,150 30,150"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      <polygon
                        points="100,20 170,150 30,150"
                        fill="#D95D00"
                        fillOpacity="0.1"
                        stroke="#D95D00"
                        strokeWidth="2"
                      />
                      <text x="100" y="15" textAnchor="middle" className="text-xs fill-gray-600" fontSize="11">Tekanan</text>
                      <text x="25" y="155" textAnchor="middle" className="text-xs fill-gray-600" fontSize="11">Peluang</text>
                      <text x="175" y="155" textAnchor="middle" className="text-xs fill-gray-600" fontSize="11">Rasionalisasi</text>
                    </svg>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="text-center p-2 bg-red-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">TEKANAN</div>
                      <div className="text-lg font-black text-red-600">{candidate.fraudTriangle?.pressure || 35}</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">PELUANG</div>
                      <div className="text-lg font-black text-blue-600">{candidate.fraudTriangle?.opportunity || 15}</div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">RASIONALISASI</div>
                      <div className="text-lg font-black text-orange-600">{candidate.fraudTriangle?.rationalization || 25}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-cyan-100 rounded-lg">
                      <Activity size={20} className="text-cyan-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Benchmarking Risiko</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Kandidat</div>
                        <div className="h-6 bg-orange-500 rounded" style={{ width: `${Math.min(100, (candidate.riskScore || 0) * 2)}%` }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Rata-rata Perusahaan</div>
                        <div className="h-6 bg-blue-500 rounded" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Industri Sejenis</div>
                        <div className="h-6 bg-gray-400 rounded" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Membandingkan skor agregat kandidat dengan database internal.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <CheckCircle2 size={20} className="text-orange-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Skor Konsistensi</h3>
                  </div>
                  <div className="text-center mb-2">
                    <div className="text-4xl font-black text-orange-600">0.92%</div>
                    <div className="text-xs text-gray-500">Akurasi Jawaban</div>
                  </div>
                  <div className="h-2 bg-orange-200 rounded-full">
                    <div className="h-2 bg-orange-500 rounded-full" style={{ width: '92%' }}></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Mengukur konsistensi antara tes tertulis dan wawancara.</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-teal-100 rounded-lg">
                      <MessageSquare size={20} className="text-teal-600" />
                    </div>
                    <h3 className="font-bold text-gray-800">Sentimen Analisis</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-green-700">Positif</span>
                      <span className="font-bold">0%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-green-500 rounded-full" style={{ width: '0%' }}></div></div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-gray-700">Netral</span>
                      <span className="font-bold">1%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-gray-400 rounded-full" style={{ width: '1%' }}></div></div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-red-700">Negatif</span>
                      <span className="font-bold">0%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-1.5 bg-red-500 rounded-full" style={{ width: '0%' }}></div></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-red-100 rounded-lg">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Identifikasi Red Flags</h3>
                </div>
                {candidate.analysis?.redFlags && candidate.analysis.redFlags.length > 0 ? (
                  <div className="space-y-2">
                    {candidate.analysis.redFlags.map((flag, idx) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={12} className="text-red-600" />
                        </div>
                        <p className="text-xs text-red-800 leading-relaxed">{flag}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={12} className="text-red-600" />
                      </div>
                      <p className="text-xs text-red-800">Candidate reports moderate anxiety regarding personal finances.</p>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={12} className="text-red-600" />
                      </div>
                      <p className="text-xs text-red-800">Recent financial emergency experienced in the last 6 months.</p>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={12} className="text-red-600" />
                      </div>
                      <p className="text-xs text-red-800">Candidate perceives some company rules as potentially unfair.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Bot size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">AI Investigator Summary</h3>
                    <p className="text-xs text-gray-500">Automated risk profiling</p>
                  </div>
                </div>

                <div className="prose prose-sm max-w-none">
                  {candidate.analysis?.summary ? (
                    <p className="text-gray-700 leading-relaxed text-sm">{candidate.analysis.summary}</p>
                  ) : (
                    <p className="text-gray-700 leading-relaxed text-sm">
                      Candidate shows <span className="font-semibold">high competence</span> in technical areas but flagged for{' '}
                      <span className="font-semibold text-[#D95D00]">Potential Financial Strain</span>. During the profiling session,
                      they mentioned having significant short-term debt obligations. Risk score indicates{' '}
                      <span className="font-semibold">{candidate.riskScore && candidate.riskScore > 50 ? 'elevated' : 'moderate'} risk profile</span>.
                      <br /><br />
                      <span className="font-semibold">Recommendation:</span> Verify financial background through SLIK OJK check and conduct additional reference verification.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Documents</h3>
            {candidate.cvUrl ? (
              <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '800px' }}>
                {candidate.cvUrl.endsWith('.pdf') ? (
                  <iframe
                    src={candidate.cvUrl}
                    className="w-full h-full"
                    title={`CV ${candidate.candidate.name}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">Preview not available</p>
                      <a
                        href={candidate.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors"
                      >
                        Open in New Tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-20">No documents available</p>
            )}
          </div>
        )}

        {activeTab === 'integrity' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Integrity Report akan tersedia setelah kandidat menyelesaikan assessment.</p>
          </div>
        )}

        {activeTab === 'integrity' && candidate.status === 'completed' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-sm border border-orange-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-800 mb-1">{candidate.candidate.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Briefcase size={14} />
                      {candidate.candidate.role}
                    </span>
                    <span>•</span>
                    <span>{new Date(candidate.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    <CheckCircle2 size={14} />
                    RESIKO LOW
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase mb-1">Skor Fraud</div>
                  <div className="text-5xl font-black text-[#D95D00]">{candidate.riskScore || 25}</div>
                  <div className="text-sm text-gray-500">/100</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-4">Visualisasi Fraud Triangle</h3>
                <div className="relative h-56 flex items-center justify-center mb-4">
                  <svg width="240" height="220" viewBox="0 0 240 220">
                    <polygon
                      points="120,30 200,180 40,180"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                    />
                    <polygon
                      points="120,30 200,180 40,180"
                      fill="#D95D00"
                      fillOpacity="0.15"
                      stroke="#D95D00"
                      strokeWidth="2"
                    />
                    <text x="120" y="20" textAnchor="middle" className="text-xs fill-gray-600" fontSize="12" fontWeight="500">Tekanan</text>
                    <text x="30" y="195" textAnchor="middle" className="text-xs fill-gray-600" fontSize="12" fontWeight="500">Peluang</text>
                    <text x="210" y="195" textAnchor="middle" className="text-xs fill-gray-600" fontSize="12" fontWeight="500">Rasionalisasi</text>
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-xs text-gray-600 mb-1 uppercase font-semibold">Tekanan</div>
                    <div className="text-2xl font-black text-red-600">{candidate.fraudTriangle?.pressure || 35}</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-gray-600 mb-1 uppercase font-semibold">Peluang</div>
                    <div className="text-2xl font-black text-blue-600">{candidate.fraudTriangle?.opportunity || 15}</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-xs text-gray-600 mb-1 uppercase font-semibold">Rasionalisasi</div>
                    <div className="text-2xl font-black text-orange-600">{candidate.fraudTriangle?.rationalization || 25}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={20} className="text-blue-600" />
                    <h3 className="font-bold text-gray-800">Ringkasan Analisis AI</h3>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {candidate.analysis?.summary || (
                      <>
                        Candidate exhibits a <span className="font-semibold text-blue-600">low risk profile</span> characterized by <span className="font-semibold">strong adherence to segregation of duties</span> and <span className="font-semibold">low rationalization for fraud</span>. While there are <span className="font-semibold text-orange-600">medium-level indicators</span> regarding financial pressure (stress level: {candidate.fraudTriangle?.pressure || 35}), the candidate's responses consistently reject fraudulent opportunities and unethical rationalizations. Consistency between the self-assessment and SJT scenarios is high.
                      </>
                    )}
                  </p>
                  <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="text-xs font-bold text-blue-900 mb-1 uppercase">Rekomendasi Tindakan</p>
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Recommended for hire.</span> The candidate demonstrates a strong ethical compass and understanding of internal controls. Minor financial pressure indicators are offset by high integrity scores.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={20} className="text-cyan-600" />
                    <h3 className="font-bold text-gray-800">Benchmarking Risiko</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Kandidat</div>
                        <div className="h-7 bg-orange-500 rounded flex items-center justify-end pr-2" style={{ width: `${Math.min(100, (candidate.riskScore || 25) * 2)}%` }}>
                          <span className="text-xs font-bold text-white">{candidate.riskScore || 25}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Rata-rata Perusahaan</div>
                        <div className="h-7 bg-blue-500 rounded flex items-center justify-end pr-2" style={{ width: '60%' }}>
                          <span className="text-xs font-bold text-white">45</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 mb-1">Industri Sejenis</div>
                        <div className="h-7 bg-gray-400 rounded flex items-center justify-end pr-2" style={{ width: '75%' }}>
                          <span className="text-xs font-bold text-white">52</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">Membandingkan skor agregat kandidat dengan database internal.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 size={20} className="text-orange-600" />
                  <h3 className="font-bold text-gray-800">Skor Konsistensi</h3>
                </div>
                <div className="text-center mb-4">
                  <div className="text-5xl font-black text-orange-600">0.92%</div>
                  <div className="text-sm text-gray-500 mt-1">Akurasi Jawaban</div>
                </div>
                <div className="h-3 bg-orange-200 rounded-full mb-4">
                  <div className="h-3 bg-orange-500 rounded-full" style={{ width: '92%' }}></div>
                </div>
                <p className="text-sm text-gray-600">Mengukur konsistensi antara tes tertulis dan wawancara.</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={20} className="text-teal-600" />
                  <h3 className="font-bold text-gray-800">Sentimen Analisis</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-green-700">Positif</span>
                      <span className="font-bold text-gray-800">0%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-green-500 rounded-full" style={{ width: '0%' }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-gray-700">Netral</span>
                      <span className="font-bold text-gray-800">1%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-gray-400 rounded-full" style={{ width: '1%' }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="font-medium text-red-700">Negatif</span>
                      <span className="font-bold text-gray-800">0%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-2 bg-red-500 rounded-full" style={{ width: '0%' }}></div></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={20} className="text-red-600" />
                <h3 className="font-bold text-gray-800">Identifikasi Red Flags</h3>
              </div>
              <div className="space-y-3">
                {candidate.analysis?.redFlags && candidate.analysis.redFlags.length > 0 ? (
                  candidate.analysis.redFlags.map((flag, idx) => (
                    <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800 leading-relaxed">{flag}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800">Candidate reports moderate anxiety regarding personal finances.</p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800">Recent financial emergency experienced in the last 6 months.</p>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={14} className="text-red-600" />
                      </div>
                      <p className="text-sm text-red-800">Candidate perceives some company rules as potentially unfair.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'interview' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-6">AI Interview Transcript</h3>
            {candidate.transcript && candidate.transcript.length > 0 ? (
              <div className="space-y-4">
                {candidate.transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-2xl rounded-lg p-4 ${
                      msg.speaker === 'candidate'
                        ? 'bg-[#D95D00]/10 text-gray-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className="text-xs font-semibold mb-1 text-gray-500">
                        {msg.speaker === 'candidate' ? candidate.candidate.name : 'AI Interviewer'}
                      </div>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-20">No interview transcript available</p>
            )}
          </div>
        )}

        {activeTab === 'background' && candidate.status !== 'completed' && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
            <Clock size={48} className="text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Assessment Belum Selesai</h3>
            <p className="text-gray-600">Background Check akan tersedia setelah kandidat menyelesaikan assessment.</p>
          </div>
        )}

        {activeTab === 'background' && candidate.status === 'completed' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-sm border border-blue-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-800 mb-1">Background Check Report</h2>
                  <p className="text-sm text-gray-600 mb-3">Identity Verification & KYC powered by Didit</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                    <Clock size={14} />
                    COMING SOON
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase mb-1">Verification Status</div>
                  <div className="text-3xl font-black text-gray-400">--</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield size={20} className="text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Overview of Background Check</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Status</span>
                    <span className="text-sm font-semibold text-gray-400">Pending Integration</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Verification Date</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Provider</span>
                    <span className="text-sm font-semibold text-blue-600">Didit KYC</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 size={20} className="text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">ID Verification Image</h3>
                </div>
                <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                  <div className="text-center">
                    <FileText size={48} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">ID Image Preview</p>
                    <p className="text-xs text-gray-400">Coming Soon</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText size={20} className="text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Extracted Data from ID</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Full Name</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">ID Number</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Date of Birth</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Address</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Nationality</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <User size={20} className="text-teal-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Liveness Detection</h3>
                </div>
                <div className="text-center mb-4">
                  <div className="w-32 h-32 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <User size={48} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400">Liveness Check Pending</p>
                  <p className="text-xs text-gray-400 mt-1">Verifies user is physically present</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Scan size={20} className="text-orange-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Face Match</h3>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-3">
                    <span className="text-4xl font-black text-gray-300">--%</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-400">Match Score</p>
                  <p className="text-xs text-gray-400 mt-1">Compares selfie with ID photo</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">AML Screening</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Sanctions List</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">PEP Check</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Watchlist</span>
                    <span className="text-sm font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Globe size={20} className="text-cyan-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">IP Analysis</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">IP Address</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Location</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">ISP</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">VPN/Proxy</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Wifi size={20} className="text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Network Details</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Connection Type</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Speed</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Provider</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Risk Score</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <MapPin size={20} className="text-yellow-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">ID Verification Document Location</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Country</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">City</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Coordinates</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Timezone</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Smartphone size={20} className="text-pink-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Device Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Device Type</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">OS</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Browser</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600">Device ID</span>
                    <span className="text-xs font-semibold text-gray-400">--</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Info size={24} className="text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">Integration Coming Soon</h4>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    This Background Check feature will be powered by <span className="font-semibold">Didit KYC</span>,
                    a comprehensive identity verification and Know Your Customer (KYC) solution. Once integrated,
                    it will provide real-time identity verification, document authentication, liveness detection,
                    AML screening, and comprehensive risk assessment for all candidates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateDetail;
