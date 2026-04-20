import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchReferenceForm, submitReferenceForm } from '../services/referenceService';

interface RefRow {
  prevCompanyName: string;
  prevRole: string;
  prevPeriod: string;
  prevHrName: string;
  prevHrPhone: string;
}

const empty: RefRow = { prevCompanyName: '', prevRole: '', prevPeriod: '', prevHrName: '', prevHrPhone: '' };

const PublicReferenceForm: React.FC<{ token: string }> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ candidateName: string; candidateRole: string; companyName: string; status: string } | null>(null);
  const [refs, setRefs] = useState<RefRow[]>([{ ...empty }]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReferenceForm(token);
        setMeta(data);
        if (data.status === 'submitted') setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Token tidak valid');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const update = (i: number, field: keyof RefRow, value: string) => {
    setRefs((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    return /^(\+62|62|0|8)\d{7,13}$/.test(cleaned);
  };

  const handleSubmit = async () => {
    setError(null);
    for (const r of refs) {
      if (!r.prevCompanyName.trim()) return setError('Nama perusahaan wajib diisi');
      if (!r.prevHrPhone.trim()) return setError('Nomor WhatsApp HR wajib diisi');
      if (!validatePhone(r.prevHrPhone)) return setError(`Format nomor WA tidak valid: ${r.prevHrPhone}. Gunakan format +62...`);
    }
    setSubmitting(true);
    try {
      await submitReferenceForm(token, refs);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim form');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error && !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Tidak Valid</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Terima Kasih!</h2>
          <p className="text-gray-600">
            Data referensi kerja kamu telah kami terima. Tim kami akan menghubungi HR/atasan kamu sebelumnya via WhatsApp untuk konfirmasi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-800 px-6 py-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-orange-500 font-bold text-lg">Hire</span>
              <span className="font-bold text-lg">Good</span>
            </div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck size={20} /> Verifikasi Riwayat Kerja
            </h1>
          </div>

          <div className="p-6">
            <p className="text-gray-700 mb-1">Halo, <strong>{meta?.candidateName || 'Kandidat'}</strong>!</p>
            <p className="text-sm text-gray-600 mb-6">
              {meta?.companyName ? `${meta.companyName} ` : ''}sedang memverifikasi pengalaman kerja kamu sebelumnya.
              Mohon isi data kontak HR atau atasan langsung dari pengalaman kerja kamu agar tim kami dapat menghubungi via WhatsApp untuk konfirmasi singkat.
            </p>

            {refs.map((r, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50/50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">Referensi #{idx + 1}</h3>
                  {refs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRefs(refs.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Hapus referensi"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Nama Perusahaan *" value={r.prevCompanyName} onChange={(v) => update(idx, 'prevCompanyName', v)} placeholder="PT Contoh Sejahtera" />
                  <Field label="Posisi / Jabatan" value={r.prevRole} onChange={(v) => update(idx, 'prevRole', v)} placeholder="Staff Akuntansi" />
                  <Field label="Periode Kerja" value={r.prevPeriod} onChange={(v) => update(idx, 'prevPeriod', v)} placeholder="Jan 2022 – Jul 2024" />
                  <Field label="Nama HR / Atasan" value={r.prevHrName} onChange={(v) => update(idx, 'prevHrName', v)} placeholder="Bapak Budi" />
                  <div className="md:col-span-2">
                    <Field
                      label="Nomor WhatsApp HR / Atasan *"
                      value={r.prevHrPhone}
                      onChange={(v) => update(idx, 'prevHrPhone', v)}
                      placeholder="+6281234567890"
                      hint="Format: +62 atau 08..."
                    />
                  </div>
                </div>
              </div>
            ))}

            {refs.length < 3 && (
              <button
                type="button"
                onClick={() => setRefs([...refs, { ...empty }])}
                className="w-full mb-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Tambah Referensi Lain (max 3)
              </button>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Mengirim...</> : 'Kirim Form Verifikasi'}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Data ini hanya digunakan untuk keperluan verifikasi pengalaman kerja kamu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }> = ({ label, value, onChange, placeholder, hint }) => (
  <label className="block">
    <span className="text-xs font-medium text-gray-700">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
    />
    {hint && <span className="text-[11px] text-gray-500 mt-0.5 block">{hint}</span>}
  </label>
);

export default PublicReferenceForm;
