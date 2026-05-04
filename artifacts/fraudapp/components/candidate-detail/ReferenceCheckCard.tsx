import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, Send, RefreshCw, MessageSquare, Phone, Clock, CheckCircle2, XCircle, AlertCircle, Plus, Copy, Link2, Mail, PhoneCall, X, Mic } from 'lucide-react';
import {
  createReferenceRequest,
  requestAdditionalReferences,
  listReferenceRequests,
  resendReferenceMessage,
  sendDirectWhatsapp,
  sendReferenceEmail,
  initiateAiCall,
  callStatusLabel,
  callStatusColor,
  refStatusLabel,
  refStatusColor,
  type ReferenceCheckRequest,
  type ReferenceCheckResponse,
  type DirectReferenceInput,
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
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);

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

  const handleSendEmail = async (requestId: string, responseId: string) => {
    setSendingEmail(responseId);
    try {
      await sendReferenceEmail(requestId, responseId);
      toast.success('Email referensi terkirim');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal kirim email');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleAiCall = async (requestId: string, responseId: string) => {
    setCallingId(responseId);
    try {
      await initiateAiCall(requestId, responseId);
      toast.success('Panggilan AI dimulai');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memulai panggilan');
    } finally {
      setCallingId(null);
    }
  };

  const handleDirectWa = async (refs: DirectReferenceInput[]) => {
    setCreating(true);
    try {
      const r = await sendDirectWhatsapp({ sessionId, references: refs });
      const ok = r.results.filter((x) => x.ok).length;
      const fail = r.results.filter((x) => !x.ok).length;
      toast.success(`WhatsApp terkirim ke ${ok} referensi${fail > 0 ? ` (${fail} gagal)` : ''}`);
      setShowDirectModal(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim');
    } finally {
      setCreating(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDirectModal(true)}
            className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded flex items-center gap-1"
          >
            <Send size={12} /> Kirim Langsung
          </button>
          <span className="text-xs text-white/90">WhatsApp · Email · AI Call</span>
        </div>
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
            {activeRequest.status === 'pending' && (
              <FormLinkBox
                link={`${window.location.origin}/reference/${activeRequest.requestToken}`}
                onCopied={() => toast.success('Link disalin ke clipboard')}
              />
            )}
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
                    requestId={activeRequest.id}
                    onResend={() => handleResend(activeRequest.id, resp.id)}
                    isResending={resendingId === resp.id}
                    onSendEmail={() => handleSendEmail(activeRequest.id, resp.id)}
                    isSendingEmail={sendingEmail === resp.id}
                    onAiCall={() => handleAiCall(activeRequest.id, resp.id)}
                    isCalling={callingId === resp.id}
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
                            requestId={req.id}
                            onResend={() => handleResend(req.id, resp.id)}
                            isResending={resendingId === resp.id}
                            onSendEmail={() => handleSendEmail(req.id, resp.id)}
                            isSendingEmail={sendingEmail === resp.id}
                            onAiCall={() => handleAiCall(req.id, resp.id)}
                            isCalling={callingId === resp.id}
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

      {showDirectModal && (
        <DirectReferenceModal
          onClose={() => setShowDirectModal(false)}
          onSubmit={handleDirectWa}
          submitting={creating}
        />
      )}
    </div>
  );
};

const ReferenceRow: React.FC<{
  response: ReferenceCheckResponse;
  requestId: string;
  onResend: () => void;
  isResending: boolean;
  onSendEmail: () => void;
  isSendingEmail: boolean;
  onAiCall: () => void;
  isCalling: boolean;
}> = ({ response, onResend, isResending, onSendEmail, isSendingEmail, onAiCall, isCalling }) => {
  const sentAt = response.sentAt ? new Date(response.sentAt).getTime() : 0;
  const canResend =
    (response.status === 'pending' || response.status === 'no_response') &&
    sentAt > 0 &&
    Date.now() - sentAt > HOURS_48;

  const canEmail = response.refEmail && !response.emailSentAt && response.status === 'pending';
  const canCall = response.prevHrPhone && (!response.callStatus || response.callStatus === 'failed' || response.callStatus === 'no_answer');

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
        {response.refEmail && (
          <span className="flex items-center gap-1"><Mail size={11} /> {response.refEmail}</span>
        )}
        {response.sentAt && (
          <span className="flex items-center gap-1"><Send size={11} /> WA {new Date(response.sentAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {response.emailSentAt && (
          <span className="flex items-center gap-1"><Mail size={11} /> Email {new Date(response.emailSentAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
        {response.respondedAt && (
          <span className="flex items-center gap-1"><Clock size={11} /> Dibalas {new Date(response.respondedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      {/* Call status badge */}
      {response.callStatus && (
        <div className="mb-2">
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1 w-fit ${callStatusColor(response.callStatus)}`}>
            <PhoneCall size={11} /> {callStatusLabel(response.callStatus)}
            {response.callDuration ? ` (${response.callDuration}s)` : ''}
          </span>
        </div>
      )}

      {response.responseText && (
        <div className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-gray-500 dark:text-gray-400">Catatan:</span> {response.responseText}
        </div>
      )}

      {/* AI Call Transcript */}
      {response.callTranscript && response.callTranscript.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Mic size={11} /> Transkrip Percakapan ({response.callTranscript.length} pesan)
          </summary>
          <div className="mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded space-y-2 max-h-48 overflow-y-auto">
            {response.callTranscript.map((msg, i) => (
              <div key={i} className={`text-xs ${msg.speaker === 'AI' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                <span className="font-semibold">{msg.speaker}:</span> {msg.text}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* AI Call Analysis */}
      {response.callAnalysis && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
          <span className="font-semibold text-blue-700 dark:text-blue-300">AI Analisis:</span>{' '}
          <span className="text-gray-700 dark:text-gray-300">{response.callAnalysis.reasoning}</span>
        </div>
      )}

      {/* Call Recording */}
      {response.callRecordingUrl && (
        <div className="mt-2">
          <audio controls className="w-full h-8" src={response.callRecordingUrl + '.mp3'}>
            <track kind="captions" />
          </audio>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {canResend && (
          <button
            onClick={onResend}
            disabled={isResending}
            className="text-xs px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={12} className={isResending ? 'animate-spin' : ''} />
            Kirim Ulang WA
          </button>
        )}
        {canEmail && (
          <button
            onClick={onSendEmail}
            disabled={isSendingEmail}
            className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded flex items-center gap-1 disabled:opacity-50"
          >
            {isSendingEmail ? <RefreshCw size={12} className="animate-spin" /> : <Mail size={12} />}
            Kirim Email
          </button>
        )}
        {canCall && (
          <button
            onClick={onAiCall}
            disabled={isCalling}
            className="text-xs px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 rounded flex items-center gap-1 disabled:opacity-50"
          >
            {isCalling ? <RefreshCw size={12} className="animate-spin" /> : <PhoneCall size={12} />}
            AI Call
          </button>
        )}
      </div>
    </div>
  );
};

const FormLinkBox: React.FC<{ link: string; onCopied: () => void }> = ({ link, onCopied }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onCopied();
    } catch {
      window.prompt('Salin link berikut:', link);
    }
  };
  const waText = encodeURIComponent(`Halo, mohon isi form verifikasi riwayat kerja berikut: ${link}`);
  return (
    <div className="mb-4 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
        <Link2 size={13} /> Link form untuk kandidat
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[200px] text-xs px-2 py-1.5 rounded border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-mono"
        />
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1"
        >
          <Copy size={12} /> Salin
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-1"
        >
          <Send size={12} /> Kirim via WA
        </a>
      </div>
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        Bisa kirim manual ke kandidat lewat WhatsApp/email pribadi jika pesan otomatis belum sampai.
      </p>
    </div>
  );
};

// ── Direct Reference Modal ───────────────────────────────────────────────────

const emptyRef = (): DirectReferenceInput => ({ name: '', phone: '', company: '', role: '', period: '', email: '' });

const DirectReferenceModal: React.FC<{
  onClose: () => void;
  onSubmit: (refs: DirectReferenceInput[]) => void;
  submitting: boolean;
}> = ({ onClose, onSubmit, submitting }) => {
  const [refs, setRefs] = useState<DirectReferenceInput[]>([emptyRef()]);

  const update = (i: number, field: keyof DirectReferenceInput, value: string) => {
    setRefs((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const addRow = () => { if (refs.length < 5) setRefs((p) => [...p, emptyRef()]); };
  const removeRow = (i: number) => { setRefs((p) => p.filter((_, idx) => idx !== i)); };

  const valid = refs.every((r) => r.name.trim() && r.phone.trim() && r.company.trim());

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Send size={18} /> Kirim Langsung ke Referensi
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Kirim WhatsApp langsung ke HR referensi tanpa melalui form kandidat.
            Opsional: isi email untuk kirim email konfirmasi juga.
          </p>

          {refs.map((ref, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Referensi #{i + 1}</span>
                {refs.length > 1 && (
                  <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 p-0.5">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Nama HR *"
                  value={ref.name}
                  onChange={(e) => update(i, 'name', e.target.value)}
                  className="col-span-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
                <input
                  placeholder="No. HP (08xxx) *"
                  value={ref.phone}
                  onChange={(e) => update(i, 'phone', e.target.value)}
                  className="col-span-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
                <input
                  placeholder="Perusahaan *"
                  value={ref.company}
                  onChange={(e) => update(i, 'company', e.target.value)}
                  className="col-span-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
                <input
                  placeholder="Jabatan"
                  value={ref.role}
                  onChange={(e) => update(i, 'role', e.target.value)}
                  className="col-span-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
                <input
                  placeholder="Periode kerja"
                  value={ref.period}
                  onChange={(e) => update(i, 'period', e.target.value)}
                  className="col-span-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
                <input
                  placeholder="Email HR (opsional)"
                  type="email"
                  value={ref.email}
                  onChange={(e) => update(i, 'email', e.target.value)}
                  className="col-span-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          ))}

          {refs.length < 5 && (
            <button onClick={addRow} className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <Plus size={14} /> Tambah referensi
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            Batal
          </button>
          <button
            onClick={() => onSubmit(refs)}
            disabled={!valid || submitting}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            Kirim WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferenceCheckCard;
