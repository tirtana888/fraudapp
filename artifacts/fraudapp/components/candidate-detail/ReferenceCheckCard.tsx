import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, Send, RefreshCw, MessageSquare, Phone, Clock, CheckCircle2, XCircle, AlertCircle, Plus } from 'lucide-react';
import {
  createReferenceRequest,
  requestAdditionalReferences,
  listReferenceRequests,
  resendReferenceMessage,
  refStatusLabel,
  refStatusColor,
  type ReferenceCheckRequest,
  type ReferenceCheckResponse,
} from '../../services/referenceService';
import { useToast } from '../Toast';

interface Props {
  sessionId: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  companyName: string;
}

const HOURS_48 = 48 * 3600 * 1000;

const ReferenceCheckCard: React.FC<Props> = ({ sessionId, candidateName, candidateEmail, candidatePhone, companyName }) => {
  const toast = useToast();
  const [requests, setRequests] = useState<ReferenceCheckRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await listReferenceRequests(sessionId);
      setRequests(data);
    } catch (err) {
      console.warn('[REF-CHECK] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30000); // poll every 30s
    return () => clearInterval(t);
  }, [reload]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const r = await createReferenceRequest({
        sessionId,
        candidateName,
        candidateEmail,
        candidatePhone,
        companyName,
      });
      toast.success(`Form verifikasi dikirim${r.emailSent ? ' via email' : ''}${r.waSent ? ' & WhatsApp' : ''} ke kandidat.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat permintaan');
    } finally {
      setCreating(false);
    }
  };

  const handleAddMore = async () => {
    setCreating(true);
    try {
      const r = await requestAdditionalReferences({
        sessionId,
        candidateName,
        candidateEmail,
        candidatePhone,
        companyName,
      });
      toast.success(`Form referensi tambahan dikirim${r.emailSent ? ' via email' : ''}${r.waSent ? ' & WhatsApp' : ''} ke kandidat.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal meminta referensi tambahan');
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async (requestId: string, responseId: string) => {
    setResendingId(responseId);
    try {
      await resendReferenceMessage(requestId, responseId);
      toast.success('Pesan dikirim ulang ke HR');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal kirim ulang');
    } finally {
      setResendingId(null);
    }
  };

  const activeRequest = requests[0];
  // Latest request is "submitted" → HR may request more references via the
  // "Tambah Referensi" button. We also surface ALL prior requests so the
  // history of submissions is visible.
  const canAddMore = activeRequest?.status === 'submitted';
  const olderRequests = requests.slice(1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Briefcase size={18} />
          Referensi Kerja Sebelumnya
        </h3>
        <span className="text-xs text-white/90">via WhatsApp</span>
      </div>

      <div className="p-5">
        {loading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Memuat data referensi...
          </div>
        )}

        {!loading && !activeRequest && (
          <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-5 border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              Verifikasi pengalaman kerja kandidat dengan mengirim form ke kandidat.
              Setelah kandidat mengisi data HR sebelumnya, sistem otomatis mengirim WhatsApp template
              berisi tombol konfirmasi <strong>Ya / Tidak</strong>.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              Kirim Cek Referensi
            </button>
          </div>
        )}

        {activeRequest && (
          <div>
            <div className="flex items-center justify-between mb-4 text-sm gap-2 flex-wrap">
              <span className="text-gray-600 dark:text-gray-400">
                Status form:{' '}
                <strong className={activeRequest.status === 'submitted' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}>
                  {activeRequest.status === 'submitted' ? 'Sudah diisi kandidat' : 'Menunggu kandidat mengisi form'}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                {activeRequest.status === 'pending' && (
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={creating ? 'animate-spin' : ''} /> Kirim ulang ke kandidat
                  </button>
                )}
                {canAddMore && (
                  <button
                    onClick={handleAddMore}
                    disabled={creating}
                    title="Minta kandidat mengisi referensi tambahan"
                    className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 disabled:opacity-50"
                  >
                    {creating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                    Tambah Referensi
                  </button>
                )}
              </div>
            </div>

            {activeRequest.responses.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-6 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                Belum ada referensi yang diisi kandidat.
              </div>
            ) : (
              <div className="space-y-3">
                {activeRequest.responses.map((resp) => (
                  <ReferenceRow
                    key={resp.id}
                    response={resp}
                    onResend={() => handleResend(activeRequest.id, resp.id)}
                    isResending={resendingId === resp.id}
                  />
                ))}
              </div>
            )}

            {olderRequests.length > 0 && (
              <details className="mt-5 text-sm">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                  Lihat {olderRequests.length} permintaan referensi sebelumnya
                </summary>
                <div className="mt-3 space-y-4 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                  {olderRequests.map((req) => (
                    <div key={req.id}>
                      <div className="text-xs text-gray-500 mb-2">
                        Dibuat {new Date(req.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{req.responses.length} referensi
                      </div>
                      <div className="space-y-2">
                        {req.responses.map((resp) => (
                          <ReferenceRow
                            key={resp.id}
                            response={resp}
                            onResend={() => handleResend(req.id, resp.id)}
                            isResending={resendingId === resp.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ReferenceRow: React.FC<{
  response: ReferenceCheckResponse;
  onResend: () => void;
  isResending: boolean;
}> = ({ response, onResend, isResending }) => {
  const sentAt = response.sentAt ? new Date(response.sentAt).getTime() : 0;
  const canResend =
    (response.status === 'pending' || response.status === 'no_response') &&
    sentAt > 0 &&
    Date.now() - sentAt > HOURS_48;

  const Icon =
    response.status === 'confirmed' ? CheckCircle2 :
    response.status === 'denied' ? XCircle :
    response.status === 'no_response' ? AlertCircle : Clock;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">{response.prevCompanyName}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {response.prevRole || '—'}{response.prevPeriod ? ` · ${response.prevPeriod}` : ''}
          </div>
        </div>
        <span className={`px-2 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap flex items-center gap-1 ${refStatusColor(response.status)}`}>
          <Icon size={12} /> {refStatusLabel(response.status)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
        {response.prevHrName && (
          <span className="flex items-center gap-1"><MessageSquare size={11} /> {response.prevHrName}</span>
        )}
        <span className="flex items-center gap-1"><Phone size={11} /> {response.prevHrPhone}</span>
        {response.sentAt && (
          <span className="flex items-center gap-1"><Send size={11} /> Terkirim {new Date(response.sentAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {response.respondedAt && (
          <span className="flex items-center gap-1"><Clock size={11} /> Dibalas {new Date(response.respondedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      {response.responseText && (
        <div className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-gray-500 dark:text-gray-400">Catatan HR:</span> {response.responseText}
        </div>
      )}

      {canResend && (
        <button
          onClick={onResend}
          disabled={isResending}
          className="mt-3 text-xs px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
          Kirim Ulang ke HR
        </button>
      )}
    </div>
  );
};

export default ReferenceCheckCard;
