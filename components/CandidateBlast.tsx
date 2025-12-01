
import React, { useState, useEffect } from 'react';
import { Mail, Plus, Send, Copy, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { blastAssessmentInvites, getAssessmentInvites } from '../services/firebase';
import { CompanyProfile, AssessmentInvite } from '../types';

interface CandidateBlastProps {
  currentCompany: CompanyProfile;
}

const CandidateBlast: React.FC<CandidateBlastProps> = ({ currentCompany }) => {
  const [candidates, setCandidates] = useState<{ name: string; email: string; role: string }[]>([
    { name: '', email: '', role: '' }
  ]);
  const [invites, setInvites] = useState<AssessmentInvite[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [blastResult, setBlastResult] = useState<{success: number, failed: number} | null>(null);

  useEffect(() => {
    const unsubscribe = getAssessmentInvites(currentCompany.id, (data) => {
        setInvites(data);
    });
    return () => unsubscribe();
  }, [currentCompany.id]);

  const handleAddRow = () => {
    setCandidates([...candidates, { name: '', email: '', role: '' }]);
  };

  const handleRemoveRow = (index: number) => {
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
    // 1. Validasi Tier
    if (currentCompany.tier === 'Basic') {
        alert("Fitur Undang Kandidat hanya tersedia untuk paket Premium dan Enterprise.");
        return;
    }

    // 2. Filter kandidat valid
    const validCandidates = candidates.filter(c => c.name && c.email);
    if (validCandidates.length === 0) {
        alert("Mohon isi nama dan email kandidat minimal satu baris.");
        return;
    }

    if (confirm(`Kirim undangan ke ${validCandidates.length} kandidat?`)) {
        setIsSending(true);
        setBlastResult(null);
        try {
            const result = await blastAssessmentInvites(validCandidates, currentCompany.id, currentCompany.name);
            setBlastResult(result);
            if (result.success > 0) {
                // Reset form on success
                setCandidates([{ name: '', email: '', role: '' }]);
            }
        } catch (error: any) {
            console.error("Blast Error:", error);
            alert(`Gagal mengirim undangan: ${error.message}`);
        } finally {
            setIsSending(false);
        }
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
        <div className="bg-blue-50 dark:bg-blue-900/20 text-brand-blue px-4 py-2 rounded-xl text-sm font-bold border border-blue-100 dark:border-blue-900/30 flex items-center gap-2">
            <CheckCircle2 size={16} /> Kuota: {currentCompany.tier === 'Enterprise' || currentCompany.tier === 'Premium' ? 'Unlimited' : '15/Bulan'}
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
                     <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-gray-500">
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
                     <input 
                        type="text" 
                        placeholder="Posisi (Opsional)" 
                        value={c.role}
                        onChange={(e) => handleChange(idx, 'role', e.target.value)}
                        className="w-full md:w-1/4 px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                     />
                     {candidates.length > 1 && (
                         <button onClick={() => handleRemoveRow(idx)} className="text-red-400 hover:text-red-600 p-2">
                             &times;
                         </button>
                     )}
                 </div>
             ))}
         </div>

         <div className="mt-6 flex flex-col md:flex-row justify-end gap-3 items-center">
             {blastResult && (
                 <div className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mr-auto w-full md:w-auto ${blastResult.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                     <CheckCircle2 size={16} /> 
                     Hasil: {blastResult.success} Sukses, {blastResult.failed} Gagal
                 </div>
             )}
             <button 
                onClick={handleSendBlast} 
                disabled={isSending}
                className="w-full md:w-auto bg-brand-orange text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
             >
                 {isSending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                 Kirim Undangan Massal
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
                          <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                              <td className="p-4">
                                  <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{inv.name}</p>
                                  <p className="text-xs text-gray-500">{inv.email}</p>
                              </td>
                              <td className="p-4">
                                  <div className="flex items-center gap-2">
                                      <code className="bg-gray-100 dark:bg-slate-900 px-2 py-1 rounded text-brand-blue font-mono font-bold">{inv.access_code}</code>
                                      <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(inv.access_code);
                                            alert("Kode disalin!");
                                        }}
                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        title="Salin Kode"
                                      >
                                          <Copy size={14} />
                                      </button>
                                  </div>
                              </td>
                              <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(inv.createdAt).toLocaleDateString('id-ID')}
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                      inv.status === 'USED' 
                                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' 
                                      : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                                  }`}>
                                      {inv.status === 'USED' ? 'Sudah Tes' : 'Pending'}
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
