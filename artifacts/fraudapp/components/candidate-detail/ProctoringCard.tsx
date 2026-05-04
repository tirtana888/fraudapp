import React, { useEffect, useState } from 'react';
import { Camera, Eye, AlertTriangle, CheckCircle2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { API_BASE } from '../../services/apiBase';

interface ProctoringEvent {
  event_type: string;
  severity: string;
  details: string | null;
  occurred_at: string;
}

interface ProctoringSnapshot {
  storage_path: string;
  taken_at: string;
  width: number | null;
  height: number | null;
  url: string | null;
}

interface ProctoringCardProps {
  sessionId: string;
  proctoringConsentAt?: string | null;
  proctoringStartedAt?: string | null;
  proctoringFinishedAt?: string | null;
}

function severityClass(s: string): string {
  switch (s) {
    case 'critical': return 'bg-red-500';
    case 'warning':  return 'bg-yellow-500';
    default:         return 'bg-gray-400';
  }
}

export default function ProctoringCard({
  sessionId,
  proctoringConsentAt,
  proctoringStartedAt,
  proctoringFinishedAt,
}: ProctoringCardProps) {
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [snapshots, setSnapshots] = useState<ProctoringSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnap, setSelectedSnap] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tok = sess?.session?.access_token;
      if (!tok) throw new Error('Sesi tidak aktif');
      const r = await fetch(`${API_BASE}/api/extension/proctoring/data?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Gagal memuat data');
      setEvents(j.events || []);
      setSnapshots(j.snapshots || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (proctoringConsentAt || proctoringStartedAt) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, proctoringConsentAt, proctoringStartedAt]);

  const hasData = !!(proctoringConsentAt || proctoringStartedAt);
  const criticalCount = events.filter(e => e.severity === 'critical').length;
  const warningCount  = events.filter(e => e.severity === 'warning').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Camera size={18} />
          Live Proctor (Kamera + Tab Tracking)
        </h3>
        {proctoringFinishedAt ? (
          <span className="px-3 py-1 bg-green-500/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Selesai
          </span>
        ) : proctoringStartedAt ? (
          <span className="px-3 py-1 bg-yellow-500/30 text-white rounded-lg text-xs font-medium">Sedang Berjalan</span>
        ) : (
          <span className="px-3 py-1 bg-white/20 text-white rounded-lg text-xs font-medium">Belum Dimulai</span>
        )}
      </div>

      <div className="p-5">
        {!hasData && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-5 border border-orange-100 dark:border-orange-800 text-center">
            <Eye className="mx-auto text-orange-600 mb-2" size={28} />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Kandidat belum memulai sesi proctoring. Setelah kandidat membuka extension dan menyetujui ketentuan kamera, snapshot dan log aktivitas akan muncul di sini.
            </p>
          </div>
        )}

        {hasData && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 dark:bg-slate-900 rounded p-3 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 mb-1">Snapshot Kamera</p>
                <p className="font-bold text-gray-800 dark:text-gray-200 text-lg">{snapshots.length}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded p-3 text-center border border-gray-100 dark:border-slate-800">
                <p className="text-xs text-gray-500 mb-1">Total Event</p>
                <p className="font-bold text-gray-800 dark:text-gray-200 text-lg">{events.length}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded p-3 text-center border border-red-100 dark:border-red-800">
                <p className="text-xs text-red-600 mb-1">Critical</p>
                <p className="font-bold text-red-700 dark:text-red-400 text-lg">{criticalCount}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-3 text-center border border-yellow-100 dark:border-yellow-800">
                <p className="text-xs text-yellow-600 mb-1">Warning</p>
                <p className="font-bold text-yellow-700 dark:text-yellow-400 text-lg">{warningCount}</p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {proctoringStartedAt && <>Mulai: {new Date(proctoringStartedAt).toLocaleString('id-ID')}</>}
                {proctoringFinishedAt && <> · Selesai: {new Date(proctoringFinishedAt).toLocaleString('id-ID')}</>}
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-700 disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-3">{error}</div>}

            {/* Snapshots gallery */}
            <div className="mb-5">
              <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 mb-2">
                <ImageIcon size={16} className="text-orange-500" />
                Snapshot Kamera ({snapshots.length})
              </h4>
              {snapshots.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-900 py-4 rounded text-center">
                  Belum ada snapshot.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
                  {snapshots.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSnap(s.url)}
                      className="relative aspect-[4/3] bg-gray-200 rounded overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-orange-400 transition"
                      title={new Date(s.taken_at).toLocaleTimeString('id-ID')}
                    >
                      {s.url ? (
                        <img src={s.url} alt={`snap-${i}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">N/A</div>
                      )}
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-white bg-black/60 py-0.5 px-1 truncate">
                        {new Date(s.taken_at).toLocaleTimeString('id-ID')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Events timeline */}
            <div>
              <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200 mb-3">
                <AlertTriangle size={16} className="text-red-500" />
                Log Aktivitas ({events.length})
              </h4>
              {events.length === 0 ? (
                <p className="text-sm text-center text-gray-500 bg-gray-50 dark:bg-gray-900 py-4 rounded-lg">
                  Tidak ada aktivitas mencurigakan terdeteksi. ✅
                </p>
              ) : (
                <div className="relative border-l-2 border-orange-200 ml-3 space-y-3 pt-2 max-h-80 overflow-y-auto">
                  {events.map((event, idx) => (
                    <div key={idx} className="relative pl-4">
                      <div className={`absolute w-3 h-3 -left-[7px] top-1.5 rounded-full ${severityClass(event.severity)}`} />
                      <p className="text-xs text-gray-500 mb-0.5">
                        {new Date(event.occurred_at).toLocaleTimeString('id-ID')}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </p>
                      {event.details && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {event.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lightbox modal */}
      {selectedSnap && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedSnap(null)}
        >
          <img src={selectedSnap} alt="snapshot" className="max-w-full max-h-full rounded shadow-2xl" />
        </div>
      )}
    </div>
  );
}
