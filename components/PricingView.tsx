
import React from 'react';
import { Check, X, Shield, Zap, Crown, HelpCircle } from 'lucide-react';

interface PricingViewProps {
  currentTier: string;
}

const PricingView: React.FC<PricingViewProps> = ({ currentTier }) => {
  
  const renderCheck = (active: boolean, text?: string) => {
    if (active) {
      return (
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="bg-green-100 text-green-600 p-1 rounded-full">
             <Check size={16} strokeWidth={3} />
          </div>
          {text && <span className="text-[10px] font-bold text-gray-600 text-center">{text}</span>}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-1 opacity-40">
        <X size={18} className="text-gray-400" />
        {text && <span className="text-[10px] text-gray-400 text-center">{text}</span>}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 animate-in fade-in pb-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Tabel Perbandingan Fitur</h2>
        <p className="text-gray-500 dark:text-gray-400">Pilih tingkat perlindungan yang sesuai dengan risiko bisnis Anda.</p>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-brand-slate-850 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-700">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="p-6 text-left w-1/4 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                 <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kategori Fitur</span>
              </th>
              <th className={`p-6 text-center w-1/4 border-b border-gray-100 dark:border-slate-700 ${currentTier === 'Basic' ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                 <div className="flex flex-col items-center">
                    <Shield className="text-gray-600 mb-2" size={24} />
                    <h3 className="text-lg font-extrabold text-gray-800 dark:text-white">STARTER (Basic)</h3>
                 </div>
              </th>
              <th className={`p-6 text-center w-1/4 border-b border-brand-blue/20 bg-brand-blue/5 dark:bg-brand-blue/10 relative ${currentTier === 'Premium' ? 'ring-2 ring-inset ring-brand-blue' : ''}`}>
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-[10px] font-bold px-3 py-1 rounded-b-lg shadow-sm">
                    MOST POPULAR 🏆
                 </div>
                 <div className="flex flex-col items-center mt-2">
                    <Zap className="text-brand-blue mb-2" size={24} />
                    <h3 className="text-lg font-extrabold text-brand-blue">PRO GUARD (Premium)</h3>
                 </div>
              </th>
              <th className={`p-6 text-center w-1/4 border-b border-gray-100 dark:border-slate-700 ${currentTier === 'Enterprise' ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                 <div className="flex flex-col items-center">
                    <Crown className="text-brand-orange mb-2" size={24} />
                    <h3 className="text-lg font-extrabold text-brand-orange">ENTERPRISE (Forensic)</h3>
                 </div>
              </th>
            </tr>
            {/* PRICE ROW */}
            <tr>
               <td className="p-4 px-6 font-bold text-gray-500 text-sm">Harga</td>
               <td className="p-4 text-center">
                  <p className="text-2xl font-black text-gray-800 dark:text-white">Rp 499.000</p>
                  <p className="text-xs text-gray-500">/bulan</p>
               </td>
               <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">
                  <p className="text-2xl font-black text-brand-blue">Rp 1.499.000</p>
                  <p className="text-xs text-gray-500">/bulan</p>
               </td>
               <td className="p-4 text-center">
                  <p className="text-2xl font-black text-brand-orange">Custom</p>
                  <p className="text-xs text-gray-500">Pricing</p>
               </td>
            </tr>
            {/* TARGET USER */}
            <tr className="border-b border-gray-100 dark:border-slate-700">
               <td className="p-4 px-6 font-bold text-gray-500 text-sm">Target User</td>
               <td className="p-4 text-center text-sm text-gray-600 dark:text-gray-300">UMKM / Hiring Cepat</td>
               <td className="p-4 text-center text-sm font-bold text-gray-800 dark:text-white bg-brand-blue/5 dark:bg-brand-blue/10">Manager / Hiring Rutin</td>
               <td className="p-4 text-center text-sm text-gray-600 dark:text-gray-300">Korporat & Compliance</td>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
             
             {/* GROUP: TEKNOLOGI DETEKSI */}
             <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td colSpan={4} className="py-2 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Teknologi Deteksi</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Engine AI</td>
                <td className="p-4 text-center text-sm">Standard AI <br/><span className="text-[10px] text-gray-400 italic">(Interview Sopan)</span></td>
                <td className="p-4 text-center text-sm font-bold bg-brand-blue/5 dark:bg-brand-blue/10 text-brand-blue">Deep Forensic AI 🧠 <br/><span className="text-[10px] text-brand-blue/70 italic font-normal">(Interview Menekan & Analitis)</span></td>
                <td className="p-4 text-center text-sm font-bold text-brand-orange">Full Suite + External Data <br/><span className="text-[10px] text-brand-orange/70 italic font-normal">(AI + Cek Database Negara)</span></td>
             </tr>

             {/* GROUP: FITUR KILLER AI */}
             <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td colSpan={4} className="py-2 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Fitur "Killer" AI</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Euphemism Detection <br/><span className="text-[10px] text-gray-400">(Deteksi Bahasa Halus)</span></td>
                <td className="p-4 text-center">{renderCheck(false, "Tidak Ada")}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Consistency Score <br/><span className="text-[10px] text-gray-400">(Cek Konsistensi Jawaban)</span></td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Custom Scenarios</td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>

             {/* GROUP: MEKANISME INTERVIEW */}
             <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td colSpan={4} className="py-2 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Mekanisme Interview</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Metode Input</td>
                <td className="p-4 text-center text-sm">Self-Assessment Only <br/><span className="text-[10px] text-gray-400">(Link Random)</span></td>
                <td className="p-4 text-center text-sm font-bold bg-brand-blue/5 dark:bg-brand-blue/10">Self-Assess + Manual Copilot <br/><span className="text-[10px] text-gray-500 font-normal">(Screening + Panduan Tatap Muka)</span></td>
                <td className="p-4 text-center text-sm font-bold">Full Spectrum <br/><span className="text-[10px] text-gray-500 font-normal">(Self + Manual + Bulk)</span></td>
             </tr>

             {/* GROUP: PSIKOLOGI */}
             <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td colSpan={4} className="py-2 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Psikologi (Soft)</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Fraud Triangle (12 Qs)</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">SJT (Dilema Etika)</td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Financial Strain Scale</td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>

             {/* GROUP: FORENSIK & 3RD PARTY */}
             <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td colSpan={4} className="py-2 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Forensik Dokumen & Pihak Ke-3</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">AI Document Forgery</td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(true, "Basic Check")}</td>
                <td className="p-4 text-center">{renderCheck(true, "Advanced Metadata")}</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">SLIK OJK / BI Checking</td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(false)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Cek Ijazah (Dikti) / NIK</td>
                <td className="p-4 text-center">{renderCheck(false)}</td>
                <td className="p-4 text-center bg-brand-blue/5 dark:bg-brand-blue/10">{renderCheck(false)}</td>
                <td className="p-4 text-center">{renderCheck(true)}</td>
             </tr>

             {/* GROUP: INFRASTRUKTUR */}
             <tr className="bg-gray-50 dark:bg-slate-800/50">
                <td colSpan={4} className="py-2 px-6 text-xs font-bold text-gray-400 uppercase tracking-widest">Infrastruktur</td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Tipe Link</td>
                <td className="p-4 text-center text-sm text-gray-500">Random Link</td>
                <td className="p-4 text-center text-sm font-bold bg-brand-blue/5 dark:bg-brand-blue/10 text-brand-dark">Permanent Link 🔒</td>
                <td className="p-4 text-center text-sm font-bold">White-Label <br/><span className="text-[10px] text-gray-400 font-normal">(Domain Sendiri)</span></td>
             </tr>
             <tr>
                <td className="p-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">Penyimpanan Data</td>
                <td className="p-4 text-center text-sm text-gray-500">30 Hari</td>
                <td className="p-4 text-center text-sm font-bold bg-brand-blue/5 dark:bg-brand-blue/10">Lifetime Vault</td>
                <td className="p-4 text-center text-sm font-bold">Audit Logs</td>
             </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 text-center">
         <p className="text-gray-500 text-sm mb-4">Butuh bantuan memilih paket?</p>
         <button className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2 mx-auto">
             <HelpCircle size={20} /> Konsultasi dengan Sales
         </button>
      </div>
    </div>
  );
};

export default PricingView;
