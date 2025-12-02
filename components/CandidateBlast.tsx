
import React, { useState, useEffect } from 'react';
import { Mail, Plus, Send, Copy, Loader2, CheckCircle2, AlertCircle, X, ChevronDown } from 'lucide-react';
import { subscribeToInvites } from '../services/firebase';
import { CompanyProfile, AssessmentInvite } from '../types';
import { PLAN_LIMITS } from '../constants/plans';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../services/firebase';

interface CandidateBlastProps {
  currentCompany: CompanyProfile;
}

const AVAILABLE_ROLES = [
  "Manajer Keuangan", "Staff Pengadaan (Procurement)", "Kepala Gudang / Logistik", 
  "Sales Manager / Tim Sales", "Kasir Senior", "Internal Auditor", "Staff Administrasi", "IT / System Admin", "Lainnya"
];

const CandidateBlast: React.FC<CandidateBlastProps> = ({ currentCompany }) => {
  const [candidates, setCandidates] = useState<{ name: string; email: string; role: string }[]>([
    { name: '', email: '', role: '' }
  ]);
  const [invites, setInvites] = useState<AssessmentInvite[]>([]);
  
  // UI States
  const [isSending, setIsSending] = useState(false);
  const [blastStatus, setBlastStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (currentCompany?.id) {
        const unsubscribe = subscribeToInvites(currentCompany.id, (data) => {
            setInvites(data);
        });
        return () => unsubscribe();
    }
  }, [currentCompany?.id]);

  const handleAddRow = () => {
    setCandidates([...candidates, { name: '', email: '', role: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (candidates.length <= 1) return;
    const newArr = [...candidates];
    newArr.splice(index, 1);
    setCandidates(newArr);
  };

  const handleChange = (index: number, field: string, value: string) => {
    const newArr = [...candidates];
    (newArr[index] as any)[field] = value;
    setCandidates(newArr);
  };

  const handleSendBlast = async () => {
    setIsSending(true);
    setBlastStatus('idle');
    setStatusMessage('Memvalidasi data...');

    try {
        console.log("Attempting to send blast...");

        if (!currentCompany || !currentCompany.id) {
            throw new Error("Profil perusahaan tidak termuat. Silakan refresh halaman.");
        }

        const planFeatures = PLAN_LIMITS[currentCompany.tier];
        if (!planFeatures.allow_permanent_link) {
            throw new Error("Fitur undangan massal hanya tersedia untuk paket Premium/Enterprise.");
        }

        const validCandidates = candidates.filter(c => c.name.trim() && c.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));

        if (validCandidates.length === 0) {
            throw new Error("Mohon isi minimal Nama dan Email yang valid untuk satu kandidat.");
        }

        setStatusMessage(`Mengirim ${validCandidates.length} undangan...`);

        // Call backend Cloud Function
        const functions = getFunctions(app, 'europe-west1');
        const sendInvites = httpsCallable(functions, 'sendCandidateInvites');

        const result = await sendInvites({
            candidates: validCandidates,
            companyId: currentCompany.id,
            companyName: currentCompany.name
        });

        const data = result.data as { success: number; failed: number; errors: any[] };

        if (data.success > 0) {
            setBlastStatus('success');
            setStatusMessage(`${data.success} undangan berhasil dikirim. ${data.failed > 0 ? `${data.failed} gagal.` : ''}`);
            setCandidates([{ name: '', email: '', role: '' }]);
        } else {
            throw new Error(`Gagal mengirim semua undangan. (${data.failed} gagal)`);
        }
    } catch (error: any) {
        console.error("Blast sending failed:", error);
        setBlastStatus('error');
        setStatusMessage(error.message || "Terjadi kesalahan tak terduga.");
    } finally {
        setIsSending(false);
        console.log("Process finished. Button unlocked.");

        setTimeout(() => {
            setBlastStatus('idle');
            setStatusMessage('');
        }, 8000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Mail className="text-brand-orange" size={24} /> Undang Kandidat
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
                Kirim link asesmen dengan Kode Akses unik yang aman untuk setiap kandidat.
            </p>
        </div>
      </div>

      {/* INPUT FORM */}
      <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
         <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-gray-700 dark:text-gray-200">Input Data Kandidat</h3>
             <button onClick={handleAddRow} className="text-sm text-brand-blue font-bold hover:underline flex items-center gap-1">
                 <Plus size={16} /> Tambah Baris
             </button>
         </div>

         <div className="space-y-3">
             {candidates.map((c, idx) => (
                 <div key={idx} className="flex flex-col md:flex-row gap-3 items-center">
                     <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                         {idx + 1}
                     </div>
                     <input 
                        type="text" 
                        placeholder="Nama Lengkap" 
                        value={c.name}
                        onChange={(e) => handleChange(idx, 'name', e.target.value)}
                        className="flex-1 w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                     />
                     <input 
                        type="email" 
                        placeholder="Email" 
                        value={c.email}
                        onChange={(e) => handleChange(idx, 'email', e.target.value)}
                        className="flex-1 w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                     />
                     <div className="relative w-full md:w-1/3">
                        <select
                            value={c.role}
                            onChange={(e) => handleChange(idx, 'role', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue appearance-none"
                        >
                            <option value="">Pilih Posisi (Opsional)</option>
                            {AVAILABLE_ROLES.map((role, rIdx) => (
                                <option key={rIdx} value={role}>{role}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                     </div>
                     
                     {candidates.length > 1 && (
                         <button onClick={() => handleRemoveRow(idx)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                             <X size={16} />
                         </button>
                     )}
                 </div>
             ))}
         </div>

         <div className="mt-6 flex flex-col md:flex-row justify-between gap-3 items-center">
             {/* STATUS MESSAGE */}
             <div className="w-full md:w-auto">
                 {statusMessage && (
                     <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 w-full animate-in fade-in ${
                         blastStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                         blastStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                         'bg-blue-50 text-blue-700 border border-blue-200'
                     }`}>
                         {blastStatus === 'success' ? <CheckCircle2 size={16} /> :
                          blastStatus === 'error' ? <AlertCircle size={16} /> :
                          <Loader2 size={16} className="animate-spin" />}
                         {statusMessage}
                     </div>
                 )}
             </div>

             <button 
                onClick={handleSendBlast} 
                disabled={isSending}
                className={`w-full md:w-auto text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSending ? 'bg-gray-400' : 'bg-brand-orange hover:bg-orange-700 hover:shadow-xl'
                }`}
             >
                 {isSending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                 {isSending ? 'Memproses...' : 'Kirim Undangan Massal'}
             </button>
         </div>
      </div>

      {/* INVITE HISTORY TABLE */}
      <div className="bg-white dark:bg-brand-slate-850 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-800 dark:text-white">Status Undangan Terkirim</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 uppercase">
                      <tr>
                          <th className="p-4">Kandidat</th>
                          <th className="p-4">Kode Akses</th>
                          <th className="p-4">Tanggal Kirim</th>
                          <th className="p-4">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {invites.map((inv) => (
                          <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                              <td className="p-4">
                                  <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{inv.name}</p>
                                  <p className="text-xs text-gray-500">{inv.email}</p>
                                  <p className="text-[10px] text-brand-blue mt-0.5">{inv.role}</p>
                              </td>
                              <td className="p-4">
                                  <div className="flex items-center gap-2">
                                      <code className="bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded text-brand-blue font-mono font-bold text-sm">{inv.access_code}</code>
                                      <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(inv.access_code);
                                            alert("Kode disalin!");
                                        }}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                        title="Salin Kode"
                                      >
                                          <Copy size={14} />
                                      </button>
                                  </div>
                              </td>
                              <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(inv.createdAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute:'2-digit'})}
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold border whitespace-nowrap ${
                                      inv.status === 'COMPLETED'
                                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400'
                                      : inv.status === 'IN_PROGRESS'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                                      : inv.status === 'ACCESSING'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400'
                                      : inv.status === 'EXPIRED'
                                      ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400'
                                      : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                                  }`}>
                                      {inv.status === 'COMPLETED' ? '✓ Selesai'
                                       : inv.status === 'IN_PROGRESS' ? '⏳ Sedang Interview'
                                       : inv.status === 'ACCESSING' ? '👀 Sedang Mengakses'
                                       : inv.status === 'EXPIRED' ? '❌ Kadaluarsa'
                                       : '⏱️ Menunggu Kandidat'}
                                  </span>
                              </td>
                          </tr>
                      ))}
                      {invites.length === 0 && (
                          <tr>
                              <td colSpan={4} className="p-8 text-center text-gray-400 text-sm italic">Belum ada undangan terkirim.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
};

export default CandidateBlast;
