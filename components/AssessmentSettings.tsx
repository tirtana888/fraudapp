
import React, { useState, useEffect, useRef } from 'react';
import { Save, Copy, Check, Lock, Smartphone, RefreshCw, Loader2, Image as ImageIcon, Palette, Upload, Trash2, AlertCircle } from 'lucide-react';
import { CompanyProfile } from '../types';
import { updateCompany } from '../services/firebase';
import { PLAN_LIMITS } from '../constants/plans';

interface AssessmentSettingsProps {
  currentCompany: CompanyProfile;
  onUpdate: () => void; 
}

// FULL QUESTION LIST (READ ONLY IN ADMIN)
// Updated to reflect the new "Wrapped/Covert" questions
const FIXED_QUESTIONS = [
  // Pressure (Wrapped)
  "1. Dalam perencanaan karir, seberapa besar desakan kebutuhan finansial mempengaruhi keputusan pindah kerja?",
  "2. Bagaimana menyeimbangkan tanggung jawab finansial keluarga besar dengan pendapatan pribadi?",
  "3. Apakah kompensasi pasar saat ini sebanding dengan gaya hidup dan branding diri Anda?",
  "4. (Sales) Apakah penampilan mewah adalah investasi penting untuk meyakinkan klien?",
  "5. (Finance) Apakah Anda aktif mengelola investasi high-risk sebagai strategi finansial?",
  
  // Opportunity (Wrapped)
  "6. Apakah Anda lebih nyaman bekerja dengan otonomi penuh tanpa supervisi harian?",
  "7. Apakah sistem persetujuan ganda (dual control) terkadang memperlambat efisiensi kerja?",
  "8. (Procurement) Apakah wajar memberikan kesempatan tender ke kerabat yang memiliki bisnis relevan?",
  "9. (IT) Seberapa sering Anda harus menggunakan akses 'Super Admin' untuk speed troubleshooting?",
  "10. (Gudang) Apakah stok opname lebih efektif dilakukan mandiri agar cepat?",
  
  // Rationalization (Wrapped)
  "11. Dalam situasi mendesak, bagaimana pandangan Anda tentang fleksibilitas penggunaan aset kantor?",
  "12. Jika loyalitas tim diuji, apakah reputasi tim lebih penting dari laporan kesalahan kecil?",
  "13. Apakah aturan perusahaan yang kaku (SOP) terkadang perlu 'ditekuk' demi hasil?",
  "14. (Procurement) Apakah tim layak dapat insentif dari penghematan biaya vendor?",
  "15. (IT) Apakah tim IT berhak punya akses privilese khusus karena tanggung jawab besarnya?"
];

const AssessmentSettings: React.FC<AssessmentSettingsProps> = ({ currentCompany, onUpdate }) => {
  const [formData, setFormData] = useState({
    logoUrl: currentCompany.logoUrl || '',
    brandColor: currentCompany.brandColor || '#CC5500',
    headerTitle: currentCompany.headerTitle || currentCompany.name,
    welcomeMessage: currentCompany.welcomeMessage || 'Silakan lengkapi data berikut untuk melanjutkan proses seleksi.'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const assessmentLink = `${window.location.origin}?mode=assess&cid=${currentCompany.id}`;
  const features = PLAN_LIMITS[currentCompany.tier];

  useEffect(() => {
    setFormData({
        logoUrl: currentCompany.logoUrl || '',
        brandColor: currentCompany.brandColor || '#CC5500',
        headerTitle: currentCompany.headerTitle || currentCompany.name,
        welcomeMessage: currentCompany.welcomeMessage || 'Silakan lengkapi data berikut untuk melanjutkan proses seleksi.'
    });
  }, [currentCompany]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(assessmentLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const compressAndResizeImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 500;
                  const scaleSize = MAX_WIDTH / img.width;
                  
                  if (scaleSize < 1) {
                      canvas.width = MAX_WIDTH;
                      canvas.height = img.height * scaleSize;
                  } else {
                      canvas.width = img.width;
                      canvas.height = img.height;
                  }

                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                      reject("Canvas context error");
                      return;
                  }
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const dataUrl = canvas.toDataURL('image/png');
                  resolve(dataUrl);
              };
              img.onerror = (err) => reject(err);
          };
          reader.onerror = (err) => reject(err);
      });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file terlalu besar! Maksimal 5MB.");
        return;
    }

    setIsProcessingImg(true);

    try {
        const optimizedLogo = await compressAndResizeImage(file);
        const sizeInBytes = 4 * Math.ceil((optimizedLogo.length / 3)) * 0.5624896334383812;
        if (sizeInBytes > 900 * 1024) {
            alert("Gambar terlalu kompleks. Mohon gunakan logo yang lebih sederhana.");
            setIsProcessingImg(false);
            return;
        }

        setFormData({ ...formData, logoUrl: optimizedLogo });
    } catch (error) {
        console.error("Image processing failed", error);
        alert("Gagal memproses gambar. Coba file lain.");
    } finally {
        setIsProcessingImg(false);
    }
  };

  const handleRemoveLogo = () => {
      setFormData({ ...formData, logoUrl: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCompany(currentCompany.id, formData);
      onUpdate(); 
      alert("✅ Pengaturan Link Asesmen berhasil disimpan!");
    } catch (error: any) {
      console.error("Gagal menyimpan:", error);
      if (error.message && error.message.includes("larger than 1 MB")) {
          alert("Gagal menyimpan: Ukuran Logo terlalu besar.");
      } else {
          alert("Terjadi kesalahan saat menyimpan pengaturan.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500 pb-10">
      
      {/* LEFT COLUMN: SETTINGS FORM */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-6">
             <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Kustomisasi Tampilan</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Atur branding halaman asesmen mandiri kandidat.</p>
             </div>
             <button 
                onClick={handleSave}
                disabled={isSaving || isProcessingImg}
                className="bg-brand-dark dark:bg-white text-white dark:text-brand-dark px-4 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70"
             >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Perubahan
             </button>
          </div>

          <div className="space-y-6">
             {/* Logo Upload Section - GATED */}
             <div className={!features.white_label ? 'opacity-50 pointer-events-none relative' : ''}>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <ImageIcon size={16} /> Logo Perusahaan
                    {!features.white_label && <span className="text-[10px] bg-gray-200 text-gray-500 px-2 rounded-full">Khusus Enterprise</span>}
                </label>
                
                <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative group">
                        {isProcessingImg ? (
                             <Loader2 className="animate-spin text-brand-orange" />
                        ) : formData.logoUrl ? (
                            <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                        ) : (
                            <span className="text-xs text-gray-400 text-center px-2">No Logo</span>
                        )}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingImg}
                                className="bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-dark dark:text-brand-blue px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Upload size={16} /> Upload Logo
                            </button>
                            {formData.logoUrl && (
                                <button 
                                    onClick={handleRemoveLogo}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg transition-colors"
                                    title="Hapus Logo"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleLogoUpload} 
                            accept="image/png, image/jpeg, image/jpg" 
                            className="hidden" 
                        />
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                            <AlertCircle size={10} /> Maksimal ukuran file 5MB (PNG/JPG). Otomatis dioptimasi.
                        </p>
                    </div>
                </div>
                {!features.white_label && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
             </div>

             {/* Branding Color - GATED */}
             <div className={!features.white_label ? 'opacity-50 pointer-events-none relative' : ''}>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Palette size={16} /> Warna Brand Utama
                    {!features.white_label && <span className="text-[10px] bg-gray-200 text-gray-500 px-2 rounded-full">Khusus Enterprise</span>}
                </label>
                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <input 
                            type="color" 
                            value={formData.brandColor}
                            onChange={(e) => setFormData({...formData, brandColor: e.target.value})}
                            className="h-12 w-12 rounded-lg border-none cursor-pointer overflow-hidden opacity-0 absolute inset-0 z-10"
                        />
                        <div 
                            className="h-12 w-12 rounded-lg shadow-sm border border-gray-200 dark:border-slate-600" 
                            style={{ backgroundColor: formData.brandColor }} 
                        />
                    </div>
                    <input 
                        type="text" 
                        value={formData.brandColor}
                        onChange={(e) => setFormData({...formData, brandColor: e.target.value})}
                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-800 dark:text-white font-mono text-sm uppercase focus:ring-2 focus:ring-brand-blue outline-none"
                    />
                </div>
                {!features.white_label && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
             </div>

             {/* Header Title */}
             <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Judul Halaman Publik</label>
                <input 
                    type="text" 
                    value={formData.headerTitle}
                    onChange={(e) => setFormData({...formData, headerTitle: e.target.value})}
                    placeholder="Contoh: Portal Rekrutmen FraudGuard"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-brand-blue outline-none"
                />
             </div>

             {/* Welcome Message */}
             <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Pesan Sambutan Kandidat</label>
                <textarea 
                    rows={4}
                    value={formData.welcomeMessage}
                    onChange={(e) => setFormData({...formData, welcomeMessage: e.target.value})}
                    placeholder="Masukkan pesan instruksi untuk kandidat..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-brand-blue outline-none resize-none leading-relaxed"
                />
             </div>
          </div>
        </div>

        {/* COPY LINK SECTION - GATED */}
        {features.allow_permanent_link ? (
            <div className="bg-brand-blue/10 dark:bg-brand-blue/5 border border-brand-blue/20 p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-brand-dark dark:text-brand-blue uppercase tracking-wide mb-3">Link Asesmen Aktif</h3>
                <div className="flex gap-2">
                    <input 
                        readOnly 
                        value={assessmentLink} 
                        className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-300 focus:outline-none font-medium"
                    />
                    <button 
                        onClick={handleCopyLink}
                        className="bg-brand-blue hover:bg-brand-blue/90 text-white px-5 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                    >
                        {isCopied ? <Check size={18} /> : <Copy size={18} />}
                        {isCopied ? 'Disalin' : 'Salin'}
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Link ini unik untuk perusahaan Anda dan akan menggunakan branding yang disimpan.</p>
            </div>
        ) : (
            <div className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                 <Lock className="text-gray-400 mb-3" size={32} />
                 <h3 className="font-bold text-gray-600 dark:text-gray-300">Link Publik Dikunci</h3>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Anda menggunakan paket Basic. Tingkatkan ke Premium untuk membagikan link rekrutmen.</p>
            </div>
        )}
      </div>

      {/* RIGHT COLUMN: PREVIEW & LOCKED QUESTIONS */}
      <div className="space-y-6">
         
         {/* Live Preview (Mockup) */}
         <div className="bg-white dark:bg-brand-slate-850 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                <Smartphone size={16} /> Live Preview (Tampilan Kandidat)
            </h3>
            
            <div className="border-[10px] border-gray-800 rounded-[3rem] overflow-hidden max-w-[320px] mx-auto shadow-2xl bg-gray-50 relative aspect-[9/19]">
                <div className="absolute top-0 w-full h-full overflow-y-auto bg-gray-50 pb-10 scrollbar-hide">
                    <div className="bg-white px-5 py-4 border-b flex items-center justify-center sticky top-0 z-10 shadow-sm min-h-[60px]">
                        {formData.logoUrl ? (
                            <img src={formData.logoUrl} alt="Logo" className="h-8 object-contain" />
                        ) : (
                            <span className="font-bold text-sm truncate" style={{ color: formData.brandColor }}>{formData.headerTitle}</span>
                        )}
                    </div>
                    <div className="p-5 space-y-5">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-md" style={{ backgroundColor: formData.brandColor }}>
                                <RefreshCw size={24} />
                            </div>
                            <h4 className="font-bold text-gray-900 text-base mb-2">Mulai Asesmen</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">{formData.welcomeMessage}</p>
                            
                            <div className="mt-6 space-y-3">
                                <div className="h-10 bg-gray-50 rounded-lg w-full border border-gray-200"></div>
                                <div className="h-10 bg-gray-50 rounded-lg w-full border border-gray-200"></div>
                            </div>

                            <button className="w-full text-white text-sm font-bold py-3 rounded-xl mt-4 shadow-md" style={{ backgroundColor: formData.brandColor }}>
                                Lanjut
                            </button>
                        </div>
                        
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 opacity-70">
                             <div className="h-3 bg-gray-200 rounded w-3/4 mb-3"></div>
                             <div className="grid grid-cols-3 gap-2">
                                 <div className="h-8 bg-gray-100 rounded border border-gray-200"></div>
                                 <div className="h-8 bg-gray-100 rounded border border-gray-200"></div>
                                 <div className="h-8 bg-gray-100 rounded border border-gray-200"></div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
         </div>

         {/* Locked Questions List */}
         <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700">
             <div className="flex items-center justify-between mb-4">
                 <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <Lock size={16} className="text-brand-orange" /> Pertanyaan Profesi (Tersamar)
                 </h3>
                 <span className="text-[10px] bg-gray-200 dark:bg-slate-700 text-gray-500 px-2 py-1 rounded font-bold">READ ONLY</span>
             </div>
             <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 {FIXED_QUESTIONS.map((q, idx) => (
                     <div key={idx} className="text-xs text-gray-500 dark:text-gray-400 p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700">
                         {q}
                     </div>
                 ))}
             </div>
             <p className="text-[10px] text-gray-400 mt-4 italic text-center">
                 Daftar pertanyaan ini didesain menggunakan teknik 'Masking' untuk mendeteksi fraud tanpa terkesan menuduh.
             </p>
         </div>

      </div>
    </div>
  );
};

export default AssessmentSettings;
