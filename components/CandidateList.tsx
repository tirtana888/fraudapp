import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, ChevronRight, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { InterviewSession } from '../types';
import { db, COLLECTIONS } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface CandidateListProps {
  companyId: string;
  onViewCandidate: (sessionId: string) => void;
}

interface CandidateWithDetails extends InterviewSession {
  jobTitle?: string;
  riskScore?: number;
  stage?: string;
}

const CandidateList: React.FC<CandidateListProps> = ({ companyId, onViewCandidate }) => {
  const [candidates, setCandidates] = useState<CandidateWithDetails[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<CandidateWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  useEffect(() => {
    loadCandidates();
  }, [companyId]);

  useEffect(() => {
    filterCandidates();
  }, [searchTerm, stageFilter, riskFilter, candidates]);

  const loadCandidates = async () => {
    try {
      setIsLoading(true);

      const sessionsQuery = query(
        collection(db, COLLECTIONS.SESSIONS),
        where('companyId', '==', companyId)
      );
      const sessionsSnapshot = await getDocs(sessionsQuery);

      const candidatesData: CandidateWithDetails[] = await Promise.all(
        sessionsSnapshot.docs.map(async (docSnap) => {
          const sessionData = { id: docSnap.id, ...docSnap.data() } as any;

          let jobTitle = 'Direct Application';
          if (sessionData.jobId) {
            try {
              const jobsQuery = query(
                collection(db, COLLECTIONS.JOBS),
                where('__name__', '==', sessionData.jobId)
              );
              const jobSnapshot = await getDocs(jobsQuery);
              if (!jobSnapshot.empty) {
                jobTitle = jobSnapshot.docs[0].data().title;
              }
            } catch (error) {
              console.error('Error fetching job:', error);
            }
          }

          const riskScore = sessionData.analysis?.riskScore ||
                           sessionData.analysis?.fraudScore ||
                           calculateRiskScore(sessionData);

          const stage = determineStage(sessionData);

          return {
            ...sessionData,
            jobTitle,
            riskScore,
            stage
          } as CandidateWithDetails;
        })
      );

      candidatesData.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setCandidates(candidatesData);
    } catch (error) {
      console.error('[CANDIDATE-LIST] Error loading candidates:', error);
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

  const determineStage = (session: any): string => {
    const stageMap: { [key: string]: string } = {
      'screening': 'Screening',
      'processing': 'Screening',
      'review': 'Review',
      'interview': 'Interview',
      'bc_check': 'Background Check',
      'background_check': 'Background Check',
      'hired': 'Hired',
      'approved': 'Hired',
      'rejected': 'Rejected',
      'application': 'Application',
      'integrity_test': 'Integrity Check',
      'interview_office': 'Interview',
      'kyc': 'KYC Process'
    };

    if (session.recruitmentStage && session.recruitmentStage !== 'screening' && session.recruitmentStage !== 'processing') {
      return stageMap[session.recruitmentStage] || session.recruitmentStage;
    }

    if (session.status === 'completed') return 'Review';
    if (session.status === 'pending_review') return 'Pending Review';
    if (session.status === 'in_progress') return 'In Progress';
    return 'Screening';
  };

  const filterCandidates = () => {
    let filtered = [...candidates];

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter(c => c.stage === stageFilter);
    }

    if (riskFilter !== 'all') {
      filtered = filtered.filter(c => {
        const score = c.riskScore || 0;
        if (riskFilter === 'low') return score <= 20;
        if (riskFilter === 'medium') return score > 20 && score <= 50;
        if (riskFilter === 'high') return score > 50;
        return true;
      });
    }

    setFilteredCandidates(filtered);
  };

  const getRiskBadge = (score: number) => {
    if (score <= 20) {
      return {
        label: 'Low Risk',
        color: 'bg-green-100 text-green-700 border-green-300',
        icon: <CheckCircle2 size={14} />
      };
    } else if (score <= 50) {
      return {
        label: 'Medium Risk',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        icon: <Clock size={14} />
      };
    } else {
      return {
        label: 'High Risk',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: <AlertTriangle size={14} />
      };
    }
  };

  const getStageBadge = (stage: string) => {
    const stageColors: { [key: string]: string } = {
      'Screening': 'bg-blue-100 text-blue-700 border-blue-300',
      'Review': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'Interview': 'bg-orange-100 text-orange-700 border-orange-300',
      'Background Check': 'bg-purple-100 text-purple-700 border-purple-300',
      'Hired': 'bg-green-100 text-green-700 border-green-300',
      'Rejected': 'bg-red-100 text-red-700 border-red-300',
      'Application': 'bg-blue-100 text-blue-700 border-blue-300',
      'Integrity Check': 'bg-purple-100 text-purple-700 border-purple-300',
      'Interview Complete': 'bg-cyan-100 text-cyan-700 border-cyan-300',
      'KYC Process': 'bg-teal-100 text-teal-700 border-teal-300',
      'Pending Review': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'In Progress': 'bg-blue-100 text-blue-700 border-blue-300',
      'New': 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return stageColors[stage] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const uniqueStages = [...new Set(candidates.map(c => c.stage))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D95D00] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading candidates...</p>
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
              <Users className="text-[#D95D00]" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Candidate Management</h2>
              <p className="text-sm text-gray-500">Review and process all applicants</p>
            </div>
          </div>
          <div className="bg-[#D95D00]/10 border border-[#D95D00]/20 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-[#D95D00]" />
              <span className="font-bold text-[#D95D00]">{filteredCandidates.length}</span>
              <span className="text-sm text-gray-600">Candidates</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
              />
            </div>
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">All Stages</option>
            {uniqueStages.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D95D00]/20"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Candidates Found</h3>
            <p className="text-gray-500">Try adjusting your filters or search criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Applied For
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Risk Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCandidates.map((candidate) => {
                  const riskBadge = getRiskBadge(candidate.riskScore || 0);
                  return (
                    <tr
                      key={candidate.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#D95D00]/10 flex items-center justify-center text-[#D95D00] font-bold text-sm">
                            {getInitials(candidate.candidate.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">{candidate.candidate.name}</div>
                            <div className="text-sm text-gray-500">{candidate.candidate.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-800">{candidate.jobTitle}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStageBadge(candidate.stage || 'New')}`}>
                          {candidate.stage}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${riskBadge.color}`}>
                            {riskBadge.icon}
                            {riskBadge.label}
                          </span>
                          <span className="text-xs text-gray-500">({candidate.riskScore})</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-600">
                          {new Date(candidate.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => onViewCandidate(candidate.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors text-sm font-medium"
                        >
                          View
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="text-green-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {candidates.filter(c => (c.riskScore || 0) <= 20).length}
              </div>
              <div className="text-sm text-gray-500">Low Risk</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {candidates.filter(c => {
                  const score = c.riskScore || 0;
                  return score > 20 && score <= 50;
                }).length}
              </div>
              <div className="text-sm text-gray-500">Medium Risk</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {candidates.filter(c => (c.riskScore || 0) > 50).length}
              </div>
              <div className="text-sm text-gray-500">High Risk</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateList;
