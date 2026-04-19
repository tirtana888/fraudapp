import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Copy, Check, Lock, Smartphone, Monitor, RefreshCw, Loader2,
  Image as ImageIcon, Palette, Upload, Trash2, AlertCircle, ExternalLink,
  Code, Share2, Eye, Layout, ChevronRight, PlayCircle
} from 'lucide-react';
import { CompanyProfile } from '../types';
import { updateCompany, uploadCompanyLogo, deleteCompanyLogo } from '../services/firebase';
import { PLAN_LIMITS } from '../constants/plans';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AssessmentSettingsProps {
  currentCompany: CompanyProfile;
  onUpdate: () => void;
}

// FULL QUESTION LIST (READ ONLY IN ADMIN)
// Updated to reflect the new "Wrapped/Covert" questions
const FIXED_QUESTIONS = {
  pressure: [
    "1. Dalam perencanaan karir, seberapa besar desakan kebutuhan finansial mempengaruhi keputusan pindah kerja?",
    "2. Bagaimana menyeimbangkan tanggung jawab finansial keluarga besar dengan pendapatan pribadi?",
    "3. Apakah kompensasi pasar saat ini sebanding dengan gaya hidup dan branding diri Anda?",
    "4. (Sales) Apakah penampilan mewah adalah investasi penting untuk meyakinkan klien?",
    "5. (Finance) Apakah Anda aktif mengelola investasi high-risk sebagai strategi finansial?",
  ],
  opportunity: [
    "6. Apakah Anda lebih nyaman bekerja dengan otonomi penuh tanpa supervisi harian?",
    "7. Apakah sistem persetujuan ganda (dual control) terkadang memperlambat efisiensi kerja?",
    "8. (Procurement) Apakah wajar memberikan kesempatan tender ke kerabat yang memiliki bisnis relevan?",
    "9. (IT) Seberapa sering Anda harus menggunakan akses 'Super Admin' untuk speed troubleshooting?",
    "10. (Gudang) Apakah stok opname lebih efektif dilakukan mandiri agar cepat?",
  ],
  rationalization: [
    "11. Dalam situasi mendesak, bagaimana pandangan Anda tentang fleksibilitas penggunaan aset kantor?",
    "12. Jika loyalitas tim diuji, apakah reputasi tim lebih penting dari laporan kesalahan kecil?",
    "13. Apakah aturan perusahaan yang kaku (SOP) terkadang perlu 'ditekuk' demi hasil?",
    "14. (Procurement) Apakah tim layak dapat insentif dari penghematan biaya vendor?",
    "15. (IT) Apakah tim IT berhak punya akses privilese khusus karena tanggung jawab besarnya?"
  ]
};

const AssessmentSettings: React.FC<AssessmentSettingsProps> = ({ currentCompany, onUpdate }) => {
  const toast = useToast();

  // -- STATE --
  const [formData, setFormData] = useState({
    logoUrl: currentCompany.logoUrl || '',
    brandColor: currentCompany.brandColor || '#CC5500',
    headerTitle: currentCompany.headerTitle || currentCompany.name,
    welcomeMessage: currentCompany.welcomeMessage || 'Silakan lengkapi data berikut untuk melanjutkan proses seleksi.'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [activeTab, setActiveTab] = useState<'design' | 'questions'>('design');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use hiregood.one as requested
  const assessmentLink = `https://hiregood.one/?mode=assess&cid=${currentCompany.id}`;

  // Embed code snippet
  const embedCode = `<a href="${assessmentLink}" target="_blank" style="background-color: ${formData.brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Apply Now</a>`;

  // FEATURE GATING
  const features = currentCompany?.tier && PLAN_LIMITS[currentCompany.tier]
    ? PLAN_LIMITS[currentCompany.tier]
    : PLAN_LIMITS['Freemium'];

  // -- EFFECTS --
  useEffect(() => {
    // Sync with props
    const newData = {
      logoUrl: currentCompany.logoUrl || '',
      brandColor: currentCompany.brandColor || '#CC5500',
      headerTitle: currentCompany.headerTitle || currentCompany.name,
      welcomeMessage: currentCompany.welcomeMessage || 'Silakan lengkapi data berikut untuk melanjutkan proses seleksi.'
    };
    if (JSON.stringify(formData) !== JSON.stringify(newData)) {
      setFormData(newData);
    }
  }, [currentCompany]);

  useEffect(() => {
    // Detect changes
    const hasChanges =
      formData.logoUrl !== (currentCompany.logoUrl || '') ||
      formData.brandColor !== (currentCompany.brandColor || '#CC5500') ||
      formData.headerTitle !== (currentCompany.headerTitle || currentCompany.name) ||
      formData.welcomeMessage !== (currentCompany.welcomeMessage || 'Silakan lengkapi data berikut untuk melanjutkan proses seleksi.');

    setHasUnsavedChanges(hasChanges);
  }, [formData, currentCompany]);

  /* -- HANDLERS -- */
  const handleCopyLink = () => {
    navigator.clipboard.writeText(assessmentLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success('Link tersalin ke clipboard!');
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setIsCodeCopied(true);
    setTimeout(() => setIsCodeCopied(false), 2000);
    toast.success('Kode tombol tersalin!');
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file terlalu besar (Max 5MB)');
      return;
    }

    setIsProcessingImg(true);
    try {
      const downloadURL = await uploadCompanyLogo(currentCompany.id, file);
      setFormData({ ...formData, logoUrl: downloadURL });
      toast.success('Logo berhasil di-upload! Jangan lupa simpan.');
    } catch (error: any) {
      toast.error(`Gagal upload: ${error.message}`);
    } finally {
      setIsProcessingImg(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await deleteCompanyLogo(currentCompany.id);
      setFormData({ ...formData, logoUrl: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setFormData({ ...formData, logoUrl: '' });
    }
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await updateCompany(currentCompany.id, {
        logoUrl: formData.logoUrl || '',
        brandColor: formData.brandColor,
        headerTitle: formData.headerTitle,
        welcomeMessage: formData.welcomeMessage
      });

      // Artificial delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      setHasUnsavedChanges(false);
      onUpdate();
      toast.success('Assessment Studio berhasil disimpan!');
    } catch (error: any) {
      toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-500">

      {/* TOOLBAR */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm rounded-t-2xl">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('design')}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === 'design'
                  ? "bg-white dark:bg-slate-600 text-[#D95D00] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              )}
            >
              <Layout size={16} /> Design Studio
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === 'questions'
                  ? "bg-white dark:bg-slate-600 text-[#D95D00] shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              )}
            >
              <Eye size={16} /> Fraud Triangle
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden md:block"></div>

          {/* Device Toggle - Only show in Design Mode */}
          {activeTab === 'design' && (
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={cn(
                  "p-2 rounded-md transition-all",
                  previewDevice === 'desktop' ? "bg-white dark:bg-slate-600 text-blue-600 shadow-sm" : "text-slate-400"
                )}
                title="Desktop View"
              >
                <Monitor size={18} />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={cn(
                  "p-2 rounded-md transition-all",
                  previewDevice === 'mobile' ? "bg-white dark:bg-slate-600 text-blue-600 shadow-sm" : "text-slate-400"
                )}
                title="Mobile View"
              >
                <Smartphone size={18} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || isProcessingImg || !hasUnsavedChanges}
          className={cn(
            "px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
            hasUnsavedChanges
              ? "bg-[#D95D00] hover:bg-[#b14d00] text-white hover:scale-105"
              : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-default"
          )}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {hasUnsavedChanges ? 'Publish Changes' : 'All Saved'}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-b-2xl">

        {/* --- LEFT PANEL: EDITOR --- */}
        {activeTab === 'design' ? (
          <div className="w-full md:w-[400px] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto custom-scrollbar p-6 space-y-8 flex-shrink-0">

            {/* 1. BRAND IDENTITY */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Palette size={14} /> Brand Identity
              </h3>

              <div className="space-y-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                {/* Logo */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Company Logo</label>
                    {!features.white_label && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">PRO</span>}
                  </div>

                  <div className={!features.white_label ? "opacity-50 pointer-events-none" : ""}>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 bg-white flex items-center justify-center cursor-pointer hover:border-[#D95D00] transition-colors relative group overflow-hidden"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isProcessingImg ? (
                          <Loader2 className="animate-spin text-[#D95D00]" />
                        ) : formData.logoUrl ? (
                          <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Upload size={20} className="text-slate-400 group-hover:text-[#D95D00]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-bold text-[#D95D00] hover:underline block mb-1"
                        >
                          Upload New
                        </button>
                        <button
                          onClick={handleRemoveLogo}
                          className="text-xs text-red-500 hover:text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Brand Color</label>
                  <div className={cn("flex gap-2", !features.white_label && "opacity-50 pointer-events-none")}>
                    <input
                      type="color"
                      value={formData.brandColor}
                      onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={formData.brandColor}
                      onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                      className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 text-sm font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 2. CONTENT & MESSAGING */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Code size={14} /> Content
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Page Title</label>
                  <input
                    value={formData.headerTitle}
                    onChange={(e) => setFormData({ ...formData, headerTitle: e.target.value })}
                    placeholder="e.g. Karir di Perusahaan Maju"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-[#D95D00] outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">Welcome Message</label>
                  <textarea
                    rows={4}
                    value={formData.welcomeMessage}
                    onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                    placeholder="Sapa kandidat Anda..."
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-[#D95D00] outline-none transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>
            </section>


            {/* 3. INTEGRATION */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Share2 size={14} /> Integration (Recruitment Site)
              </h3>

              <div className="bg-[#D95D00]/5 border border-[#D95D00]/20 rounded-xl p-4 space-y-4">
                {/* Direct Link */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-[#D95D00]">Direct Link</span>
                    {features.allow_permanent_link ? (
                      <span className="text-[10px] text-green-600 bg-green-100 px-1.5 rounded font-bold">ACTIVE</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 rounded font-bold">LOCKED</span>
                    )}
                  </div>

                  {features.allow_permanent_link ? (
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white border border-[#D95D00]/30 rounded-lg px-3 py-2 text-xs text-slate-600 truncate font-mono select-all">
                        {assessmentLink}
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className="p-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#b14d00]"
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500 text-center">
                      Upgrade to Premium to unlock direct links.
                    </div>
                  )}
                </div>

                {/* Website Button */}
                {features.allow_permanent_link && (
                  <div>
                    <span className="text-xs font-bold text-[#D95D00] mb-1 block">Embed "Apply" Button</span>
                    <div className="relative group">
                      <pre className="bg-slate-800 text-slate-300 text-[10px] p-3 rounded-lg overflow-x-auto custom-scrollbar font-mono border border-slate-700">
                        {embedCode}
                      </pre>
                      <button
                        onClick={handleCopyEmbed}
                        className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded text-white"
                      >
                        {isCodeCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      Paste this code into your career page HTML.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          /* --- FRAUD TRIANGLE SHOWCASE TAB --- */
          <div className="w-full md:w-[400px] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-6 space-y-6 flex-shrink-0">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-[#D95D00]">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fraud Triangle Science</h2>
              <p className="text-sm text-slate-500">Bagaimana kami mendeteksi resiko tanpa menuduh.</p>
            </div>

            {/* Triangle Visual */}
            <div className="relative h-48 w-full flex items-center justify-center mb-8">
              <div className="absolute w-40 h-40 border-l-[160px] border-r-[160px] border-b-[240px] border-l-transparent border-r-transparent border-b-orange-50 dark:border-b-slate-700/50 transform scale-75 opacity-50"></div>

              <div className="absolute top-4 text-center">
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full border border-red-100">PRESSURE</span>
              </div>
              <div className="absolute bottom-4 left-8 text-center">
                <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full border border-yellow-100">OPPORTUNITY</span>
              </div>
              <div className="absolute bottom-4 right-8 text-center">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">RATIONALIZATION</span>
              </div>

              <div className="z-10 bg-white dark:bg-slate-800 p-2 rounded-full shadow-lg border border-slate-100">
                <RefreshCw size={24} className="text-[#D95D00]" />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-red-600 mb-2 border-b border-red-100 pb-1">Pressure (Tekanan)</h3>
                <p className="text-xs text-slate-500 mb-3 italic">"Apakah kandidat sedang dalam himpitan finansial besar?"</p>
                <ul className="space-y-2">
                  {FIXED_QUESTIONS.pressure.map((q, i) => (
                    <li key={i} className="text-xs p-2 bg-red-50/50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/30 text-slate-700 dark:text-slate-300">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-yellow-600 mb-2 border-b border-yellow-100 pb-1">Opportunity (Kesempatan)</h3>
                <p className="text-xs text-slate-500 mb-3 italic">"Apakah kandidat cenderung menyalahgunakan wewenang?"</p>
                <ul className="space-y-2">
                  {FIXED_QUESTIONS.opportunity.map((q, i) => (
                    <li key={i} className="text-xs p-2 bg-yellow-50/50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-900/30 text-slate-700 dark:text-slate-300">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-2 border-b border-blue-100 pb-1">Rationalization (Pembenaran)</h3>
                <p className="text-xs text-slate-500 mb-3 italic">"Apakah kandidat merasa 'boleh' curang demi tujuan?"</p>
                <ul className="space-y-2">
                  {FIXED_QUESTIONS.rationalization.map((q, i) => (
                    <li key={i} className="text-xs p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded border border-blue-100 dark:border-blue-900/30 text-slate-700 dark:text-slate-300">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* --- RIGHT PANEL: LIVE PREVIEW --- */}
        <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
          <div className="absolute inset-0 bg-slate-100/90 dark:bg-slate-900/90 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white/80 dark:bg-slate-800/80 px-4 py-1 rounded-full backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
              Live Candidate View - hiregood.one
            </span>

            {/* DEVICE FRAME */}
            <motion.div
              layout
              initial={false}
              animate={{
                width: previewDevice === 'mobile' ? 360 : 800,
                height: previewDevice === 'mobile' ? 680 : 500,
                borderRadius: previewDevice === 'mobile' ? 40 : 12
              }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className={cn(
                "bg-white shadow-2xl border-[8px] border-slate-800 overflow-hidden relative shrink-0",
                previewDevice === 'mobile' ? "rounded-[40px]" : "rounded-xl"
              )}
            >
              {/* Fake Browser Bar (Desktop only) */}
              {previewDevice === 'desktop' && (
                <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 bg-white h-5 rounded flex items-center px-2 text-[10px] text-slate-400 font-mono">
                    hiregood.one
                  </div>
                </div>
              )}

              {/* PREVIEW CONTENT */}
              <div className="w-full h-full overflow-y-auto bg-gray-50 scrollbar-hide">
                {/* HEADER */}
                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-center sticky top-0 z-10 shadow-sm/50">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo Preview" className="h-8 object-contain" />
                  ) : (
                    <h2 className="font-bold text-gray-800" style={{ color: formData.brandColor }}>
                      {formData.headerTitle}
                    </h2>
                  )}
                </div>

                {/* HERO SECTION */}
                <div className="px-6 py-8">
                  <div className="bg-white rounded-2xl p-8 shadow-lg shadow-gray-200/50 text-center border border-gray-50 animate-in slide-in-from-bottom-5 duration-700">
                    <div
                      className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-white shadow-lg transform hover:scale-110 transition-transform duration-300"
                      style={{ backgroundColor: formData.brandColor }}
                    >
                      <PlayCircle size={32} fill="white" />
                    </div>

                    <h1 className="text-xl font-bold text-gray-900 mb-3">{formData.headerTitle}</h1>
                    <p className="text-sm text-gray-500 leading-relaxed mb-8">
                      {formData.welcomeMessage || "Welcome to the assessment portal."}
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-left">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                          <RefreshCw size={16} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-700">Estimasi Waktu</p>
                          <p className="text-[10px] text-gray-400">10-15 Menit</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 text-left">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                          <Lock size={16} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-700">Data Privacy</p>
                          <p className="text-[10px] text-gray-400">Enkripsi End-to-End</p>
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full mt-8 py-3.5 rounded-xl text-white font-bold text-sm shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group"
                      style={{
                        backgroundColor: formData.brandColor,
                        boxShadow: `0 10px 20px -5px ${formData.brandColor}40`
                      }}
                    >
                      Mulai Sekarang <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>

                  <p className="text-center text-[10px] text-gray-300 mt-6 flex items-center justify-center gap-1">
                    Powered by <span className="font-bold text-gray-400">HireGood.One</span>
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AssessmentSettings;
