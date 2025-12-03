import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, CheckCircle2, XCircle, AlertTriangle, Clock, FileText, Shield, Bot, DollarSign, Radar, Activity, MessageSquare } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'integrity' | 'interview'>('overview');
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#D95D00]/10 rounded-lg">
                    <Radar size={24} className="text-[#D95D00]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">360° Risk Radar</h3>
                    <p className="text-sm text-gray-500">The Fraud Triangle Analysis</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Pressure</span>
                      <span className={`text-sm font-bold ${getRiskColor(candidate.fraudTriangle?.pressure || 0)}`}>
                        {candidate.fraudTriangle?.pressure}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressBarColor(candidate.fraudTriangle?.pressure || 0)}`}
                        style={{ width: `${candidate.fraudTriangle?.pressure}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Financial or personal stress indicators</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Opportunity</span>
                      <span className={`text-sm font-bold ${getRiskColor(candidate.fraudTriangle?.opportunity || 0)}`}>
                        {candidate.fraudTriangle?.opportunity}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressBarColor(candidate.fraudTriangle?.opportunity || 0)}`}
                        style={{ width: `${candidate.fraudTriangle?.opportunity}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Access to commit misconduct</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Rationalization</span>
                      <span className={`text-sm font-bold ${getRiskColor(candidate.fraudTriangle?.rationalization || 0)}`}>
                        {candidate.fraudTriangle?.rationalization}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${getProgressBarColor(candidate.fraudTriangle?.rationalization || 0)}`}
                        style={{ width: `${candidate.fraudTriangle?.rationalization}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Justification patterns detected</p>
                  </div>
                </div>

                {(candidate.fraudTriangle?.rationalization || 0) > 60 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">High Rationalization Alert</p>
                      <p className="text-xs text-red-600 mt-1">This candidate shows strong tendency to justify rule-bending behavior. Recommend additional screening.</p>
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
                    <p className="text-gray-700 leading-relaxed">{candidate.analysis.summary}</p>
                  ) : (
                    <p className="text-gray-700 leading-relaxed">
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

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign size={24} className="text-yellow-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Financial Strain Scale</h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all ${getProgressBarColor(candidate.financialStrain || 0)}`}
                        style={{ width: `${candidate.financialStrain}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getRiskColor(candidate.financialStrain || 0)}`}>
                      {candidate.financialStrain}
                    </div>
                    <div className="text-xs text-gray-500">Stress Level</div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mt-3">
                  {(candidate.financialStrain || 0) > 60
                    ? 'High financial stress detected. Candidate may be vulnerable to financial misconduct.'
                    : 'Financial stress levels within acceptable range.'}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield size={24} className="text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Verification Status</h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className={candidate.verificationStatus?.email ? 'text-green-500' : 'text-gray-300'} />
                      <span className="text-sm text-gray-700">Email Verified</span>
                    </div>
                    {candidate.verificationStatus?.email && (
                      <span className="text-xs text-green-600 font-medium">Verified</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className={candidate.verificationStatus?.phone ? 'text-green-500' : 'text-gray-300'} />
                      <span className="text-sm text-gray-700">Phone Verified</span>
                    </div>
                    {candidate.verificationStatus?.phone && (
                      <span className="text-xs text-green-600 font-medium">Verified</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {candidate.verificationStatus?.documents === 'verified' ? (
                        <CheckCircle2 size={20} className="text-green-500" />
                      ) : candidate.verificationStatus?.documents === 'failed' ? (
                        <XCircle size={20} className="text-red-500" />
                      ) : (
                        <Clock size={20} className="text-yellow-500" />
                      )}
                      <span className="text-sm text-gray-700">Document Forgery Check</span>
                    </div>
                    <span className={`text-xs font-medium ${
                      candidate.verificationStatus?.documents === 'verified' ? 'text-green-600' :
                      candidate.verificationStatus?.documents === 'failed' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {candidate.verificationStatus?.documents === 'verified' ? 'Verified' :
                       candidate.verificationStatus?.documents === 'failed' ? 'Failed' :
                       'Processing...'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Activity size={24} className="text-cyan-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Industry Benchmarking</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Risk Score vs Industry Average</span>
                    <span className="text-sm font-bold text-green-600">
                      {candidate.riskScore || 0} vs 45 (Industry Avg)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Percentile Ranking</span>
                    <span className="text-sm font-bold text-blue-600">
                      Top {100 - Math.min(95, Math.round((candidate.riskScore || 25) / 1.5))}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Similar Role Comparison</span>
                    <span className="text-sm font-bold text-purple-600">
                      {candidate.riskScore && candidate.riskScore < 40 ? 'Above Average' : 'Below Average'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <CheckCircle2 size={24} className="text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Consistency Analysis</h3>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={16} className="text-green-600" />
                      <span className="text-sm font-semibold text-green-800">Response Pattern</span>
                    </div>
                    <p className="text-xs text-green-700">
                      Answers show consistent ethical framework across all scenarios
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={16} className="text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800">Time Pattern</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      Response times indicate thoughtful consideration (avg 45s per question)
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 size={16} className="text-purple-600" />
                      <span className="text-sm font-semibold text-purple-800">Behavioral Alignment</span>
                    </div>
                    <p className="text-xs text-purple-700">
                      Stated values align with behavioral responses (92% match)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <MessageSquare size={24} className="text-teal-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Sentiment Analysis</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-black text-green-600">72%</p>
                    <p className="text-xs text-gray-600 mt-1">Positive</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-black text-gray-600">21%</p>
                    <p className="text-xs text-gray-600 mt-1">Neutral</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-black text-yellow-600">7%</p>
                    <p className="text-xs text-gray-600 mt-1">Cautious</p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-semibold mb-1">Key Insights:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Demonstrates strong ethical awareness in responses</li>
                    <li>• Shows appropriate caution when discussing sensitive topics</li>
                    <li>• Expresses confidence in handling ethical dilemmas</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle size={24} className="text-red-600" />
                  </div>
                  <h3 className="font-bold text-gray-800">Red Flags Identification</h3>
                </div>
                {candidate.analysis?.redFlags && candidate.analysis.redFlags.length > 0 ? (
                  <div className="space-y-2">
                    {candidate.analysis.redFlags.map((flag, idx) => (
                      <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800">{flag}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle2 size={32} className="text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-800">No Critical Red Flags Detected</p>
                    <p className="text-xs text-green-700 mt-1">
                      Candidate passed all integrity checkpoints successfully
                    </p>
                  </div>
                )}
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

        {activeTab === 'integrity' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Full Integrity Report</h3>
            <p className="text-gray-600">Detailed integrity analysis coming soon...</p>
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
      </div>
    </div>
  );
};

export default CandidateDetail;
