import React, { useState } from 'react';
import { GraduationCap, Search, CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import type { PddiktiVerification, PddiktiSearchMatch, ParsedCVData } from '../../types';
import { verifyNim, selectMatch, pddiktiStatusLabel, pddiktiStatusColor } from '../../services/pddiktiService';
import { useToast } from '../Toast';

interface NimVerificationCardProps {
  sessionId: string;
  education: NonNullable<ParsedCVData['education']>;
  pddiktiVerification?: PddiktiVerification;
  onVerified: () => void;
}

export default function NimVerificationCard({
  sessionId,
  education,
  pddiktiVerification,
  onVerified,
}: NimVerificationCardProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSelecting, setIsSelecting] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const toast = useToast();

  const lastEdu = education[education.length - 1];
  const verification = pddiktiVerification;

  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      await verifyNim(sessionId);
      toast.success('Verifikasi NIM selesai!');
      onVerified();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memverifikasi NIM');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectMatch = async (match: PddiktiSearchMatch) => {
    try {
      setIsSelecting(match.id);
      await selectMatch(sessionId, match.id);
      toast.success('Mahasiswa berhasil dipilih!');
      onVerified();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memilih data');
    } finally {
      setIsSelecting(null);
    }
  };

  const statusIcon = () => {
    if (!verification) return <Search size={20} className="text-gray-400" />;
    switch (verification.status) {
      case 'verified':
        return <CheckCircle2 size={20} className="text-green-500" />;
      case 'not_found':
        return <XCircle size={20} className="text-red-500" />;
      case 'multiple_matches':
        return <AlertTriangle size={20} className="text-yellow-500" />;
      default:
        return <Search size={20} className="text-blue-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3">
        <div className="flex items-center gap-2 text-white">
          <GraduationCap size={20} />
          <h3 className="font-semibold text-sm">Verifikasi NIM — PDDikti</h3>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Source Data */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">Data dari CV (Pendidikan Terakhir)</p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{lastEdu.institution || '-'}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{lastEdu.degree || '-'} &middot; {lastEdu.year || '-'}</p>
          </div>
        </div>

        {/* Status & Result */}
        {verification ? (
          <div className="space-y-3">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {statusIcon()}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${pddiktiStatusColor(verification.status)}`}>
                {pddiktiStatusLabel(verification.status)}
              </span>
              {verification.verifiedAt && (
                <span className="text-xs text-gray-400">
                  {new Date(verification.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* AI Analysis */}
            {verification.aiAnalysis && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain size={14} className="text-purple-500" />
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Analisis AI</span>
                  <span className="ml-auto text-xs font-bold text-purple-600">
                    Confidence: {verification.aiAnalysis.confidence}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{verification.aiAnalysis.reasoning}</p>
              </div>
            )}

            {/* Verified Result */}
            {verification.status === 'verified' && verification.matchedStudent && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nama</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{verification.matchedStudent.nama}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">NIM</p>
                    <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{verification.matchedStudent.nim}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Perguruan Tinggi</p>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{verification.matchedStudent.nama_pt}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Program Studi</p>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{verification.matchedStudent.prodi}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Jenjang</p>
                    <p className="text-gray-700 dark:text-gray-300">{verification.matchedStudent.jenjang}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <p className="text-gray-700 dark:text-gray-300">{verification.matchedStudent.status_saat_ini}</p>
                  </div>
                  {verification.matchedStudent.tanggal_masuk && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal Masuk</p>
                      <p className="text-gray-700 dark:text-gray-300">{verification.matchedStudent.tanggal_masuk}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Not Found */}
            {verification.status === 'not_found' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  Data mahasiswa tidak ditemukan di PDDikti untuk nama &quot;{verification.searchKeyword}&quot;.
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  Kemungkinan: nama berbeda, belum terdaftar, atau institusi tidak melapor ke PDDikti.
                </p>
              </div>
            )}

            {/* Multiple Matches */}
            {verification.status === 'multiple_matches' && verification.allMatches && verification.allMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  AI tidak cukup yakin. Silakan pilih mahasiswa yang benar:
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(showAllMatches ? verification.allMatches : verification.allMatches.slice(0, 5)).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{m.nama}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          NIM: {m.nim} &middot; {m.nama_pt} &middot; {m.nama_prodi}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSelectMatch(m)}
                        disabled={isSelecting === m.id}
                        className="ml-2 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {isSelecting === m.id ? 'Memilih...' : 'Pilih'}
                      </button>
                    </div>
                  ))}
                </div>
                {verification.allMatches.length > 5 && (
                  <button
                    onClick={() => setShowAllMatches(!showAllMatches)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    {showAllMatches ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showAllMatches ? 'Tampilkan sedikit' : `Tampilkan semua (${verification.allMatches.length})`}
                  </button>
                )}
              </div>
            )}

            {/* Re-verify & PDDikti link */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={isVerifying ? 'animate-spin' : ''} />
                Cek Ulang
              </button>
              {verification.matchedStudent?.nim && (
                <a
                  href={`https://pddikti.kemdiktisaintek.go.id/search/mahasiswa?keyword=${encodeURIComponent(verification.matchedStudent.nim)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <ExternalLink size={13} />
                  Buka PDDikti
                </a>
              )}
            </div>
          </div>
        ) : (
          /* No verification yet */
          <div className="text-center py-4">
            <GraduationCap size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Belum diverifikasi. Klik tombol di bawah untuk memverifikasi NIM kandidat melalui database PDDikti.
            </p>
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isVerifying ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Verifikasi NIM
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
