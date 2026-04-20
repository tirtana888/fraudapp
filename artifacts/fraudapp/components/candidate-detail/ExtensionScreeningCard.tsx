import React, { useState } from 'react';
import { Shield, Eye, AlertTriangle, CheckCircle2, Globe, Laptop, Key, RefreshCw, Send } from 'lucide-react';
import { GamblingAnalysis, ProctoringData } from '../../types';
import { requestExtensionToken, generateExtensionWhatsAppMessage, getRiskColor, getSeverityColor } from '../../services/extensionService';
import { useToast } from '../Toast';

interface ExtensionScreeningCardProps {
  sessionId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  companyName: string;
  gamblingAnalysis?: GamblingAnalysis;
  proctoringData?: ProctoringData;
}

export default function ExtensionScreeningCard({
  sessionId,
  candidateName,
  candidateEmail,
  candidatePhone,
  companyName,
  gamblingAnalysis,
  proctoringData
}: ExtensionScreeningCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const toast = useToast();

  const handleGenerateToken = async () => {
    try {
      setIsGenerating(true);
      const data = await requestExtensionToken(sessionId, candidateEmail);
      setGeneratedToken(data.token);
      toast.success('Token berhasil dibuat!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghasilkan token extension');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!generatedToken || !candidatePhone) {
      toast.info('Nomor WhatsApp belum tersedia atau token belum dibuat.');
      return;
    }
    const message = generateExtensionWhatsAppMessage(candidateName, generatedToken, companyName);
    let phoneNum = candidatePhone.replace(/\D/g, '');
    if (phoneNum.startsWith('0')) phoneNum = '62' + phoneNum.substring(1);
    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const copyToClipboard = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      toast.success('Token disalin!');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Shield size={18} />
          FraudGuard Profiling / PC Monitoring
        </h3>
        {gamblingAnalysis?.completedAt && (
          <span className="px-3 py-1 bg-green-500/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Selesai
          </span>
        )}
      </div>

      <div className="p-5">
        {!gamblingAnalysis && !proctoringData && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-5 border border-indigo-100 dark:border-indigo-800 mb-4">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-full text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                <Laptop size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Mulai Screening PC / Riwayat Judi</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Kirimkan kode token ke kandidat. Kandidat harus menginstall Chrome Extension FraudGuard dan memasukkan token tersebut. Kami akan mendeteksi riwayat judi dan aktivitas mencurigakan selama ujian.
                </p>

                {!generatedToken ? (
                  <button
                    onClick={handleGenerateToken}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
                    Generate Token (50 Credit)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded border border-indigo-200 dark:border-indigo-700 flex items-center justify-between gap-3">
                      <span className="font-mono text-lg font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest">
                        {generatedToken}
                      </span>
                      <button
                        onClick={copyToClipboard}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium whitespace-nowrap"
                      >
                        Salin
                      </button>
                    </div>
                    {candidatePhone && (
                      <button
                        onClick={handleSendWhatsApp}
                        className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium rounded-lg transition-colors w-full justify-center"
                      >
                        <Send size={16} />
                        Kirim via WhatsApp ke {candidatePhone}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {gamblingAnalysis && (
          <div className="mb-6">
            <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b pb-2">
              <Globe size={18} className="text-purple-500" />
              Riwayat Browser & Judi (30 Hari)
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-slate-900 rounded p-3 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 mb-1">Status Risiko</p>
                <p className={`font-bold uppercase ${getRiskColor(gamblingAnalysis.overallRisk || 'LOW')}`}>
                  {gamblingAnalysis.overallRisk || 'LOW'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded p-3 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                <p className="font-bold text-gray-800 dark:text-gray-200">{gamblingAnalysis.riskScore || 0} / 100</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded p-3 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 mb-1">Total Dianalisis (30 hari)</p>
                <p className="font-bold text-gray-800 dark:text-gray-200">{gamblingAnalysis.totalHistoryAnalyzed || 0}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded p-3 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 mb-1">Situs Terdeteksi</p>
                <p className="font-bold text-gray-800 dark:text-gray-200">{gamblingAnalysis.flaggedSitesCount || 0}</p>
                {(gamblingAnalysis.gamblingSitesCount > 0 || gamblingAnalysis.adultSitesCount > 0) && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    🎰 {gamblingAnalysis.gamblingSitesCount || 0} · 🔞 {gamblingAnalysis.adultSitesCount || 0}
                  </p>
                )}
              </div>
            </div>

            {gamblingAnalysis.flaggedSites && gamblingAnalysis.flaggedSites.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 border border-red-100 dark:border-red-900/30 mb-3">
                <p className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle size={16} /> Domain Bermasalah:
                </p>
                <div className="space-y-2">
                  {gamblingAnalysis.flaggedSites.map((site, idx) => {
                    const isAdult = site.category === 'adult';
                    return (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-red-100 dark:border-red-800/20 pb-1">
                        <span className="font-mono text-red-700 dark:text-red-300 flex items-center gap-2">
                          <span title={isAdult ? 'Situs Dewasa' : 'Situs Judi'}>{isAdult ? '🔞' : '🎰'}</span>
                          {site.domain}
                        </span>
                        <div className="flex gap-3 text-xs">
                          <span className="text-red-600/70">{site.visitCount}x</span>
                          <span className={`px-2 py-0.5 rounded ${isAdult ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                            {isAdult ? 'DEWASA' : 'JUDI'}
                          </span>
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded dark:bg-red-900 dark:text-red-200">{site.riskLevel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {gamblingAnalysis.suspiciousPatterns && gamblingAnalysis.suspiciousPatterns.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-3 border border-yellow-100 dark:border-yellow-900/30">
                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Pola Mencurigakan:</p>
                <ul className="space-y-1">
                  {gamblingAnalysis.suspiciousPatterns.map((p, i) => (
                    <li key={i} className="text-xs text-yellow-700 dark:text-yellow-300">⚠️ {p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {proctoringData && (
          <div>
            <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 mb-3 border-b pb-2">
              <Eye size={18} className="text-indigo-500" />
              Live Proctoring Log
            </h4>

            <div className="flex flex-wrap items-center gap-4 mb-4 bg-gray-50 dark:bg-slate-900 p-3 rounded">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${proctoringData.isFlagged ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-sm font-medium">
                  {proctoringData.isFlagged ? 'Sesi Bermasalah (Flagged)' : 'Sesi Aman'}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-300" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total Pelanggaran: <strong className="text-gray-900 dark:text-white">{proctoringData.events?.length || 0}</strong>
              </span>
              <div className="h-4 w-px bg-gray-300" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Skor Kecurigaan: <strong className="text-red-600">{proctoringData.suspiciousActivityScore || 0}</strong>
              </span>
            </div>

            {proctoringData.events && proctoringData.events.length > 0 ? (
              <div className="relative border-l-2 border-indigo-200 ml-3 space-y-4 pt-2">
                {proctoringData.events.map((event, idx) => (
                  <div key={idx} className="relative pl-4">
                    <div className={`absolute w-3 h-3 -left-[7px] top-1 rounded-full ${getSeverityColor(event.severity)}`} />
                    <p className="text-xs text-gray-500 mb-0.5">
                      {new Date(event.timestamp).toLocaleTimeString('id-ID')}
                    </p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">
                      {event.type.replace(/_/g, ' ')}
                    </p>
                    {event.details && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-700">
                        {event.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-gray-500 bg-gray-50 dark:bg-gray-900 py-4 rounded-lg">
                Tidak ada aktivitas mencurigakan yang terdeteksi.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
