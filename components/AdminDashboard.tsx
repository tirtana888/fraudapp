
import React, { useState, useEffect } from 'react';
import { Building2, Search, MoreVertical, Star, ArrowUpRight, Loader2, X, CloudLightning, Pencil, Trash2, Save, Send, CreditCard, Calendar, ShieldCheck, Settings } from 'lucide-react';
import { CompanyProfile } from '../types';
import { inviteCompanyReal, getCompanies, updateCompany, deleteCompany } from '../services/supabase';
import { PLAN_LIMITS } from '../constants/plans';

const AdminDashboard: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Invite Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Subscription Management Modal State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [managingCompany, setManagingCompany] = useState<CompanyProfile | null>(null);

  // Subscription Form State
  const [subFormData, setSubFormData] = useState({
      tier: 'Basic' as 'Basic' | 'Premium' | 'Enterprise',
      status: 'Active' as 'Active' | 'Suspended' | 'Past Due',
      subscription_ends_at: '',
      custom_candidate_limit: 0, // 0 means default
      verification_credits: 0
  });

  // Invite Form State
  const [newCompany, setNewCompany] = useState({
    name: '',
    email: '',
    tier: 'Basic' as 'Basic' | 'Premium' | 'Enterprise'
  });

  const fetchCompanies = async () => {
    setIsLoading(true);
    const data = await getCompanies();
    setCompanies(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // --- Handlers ---

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = {
      name: newCompany.name,
      adminEmail: newCompany.email,
      tier: newCompany.tier,
      status: 'Pending' as const, 
      joinedDate: new Date().toISOString(),
      usersCount: 0
    };

    try {
      const result = await inviteCompanyReal(payload);
      await fetchCompanies();
      const message = (result as any)?.message || "Proses selesai.";
      alert(`✅ STATUS UNDANGAN\n\n${message}`);
      setNewCompany({ name: '', email: '', tier: 'Basic' });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Gagal mengundang:", error);
      const errorMessage = (error as any)?.message || "Terjadi kesalahan.";
      alert(`❌ ERROR\n\n${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async (companyId: string) => {
    alert('Fitur email akan diimplementasikan dengan email service provider.');
    setActiveMenuId(null);
  };

  const handleManageClick = (company: CompanyProfile) => {
    setManagingCompany(company);
    
    // Set expiry default to today + 30 days if not set
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    
    setSubFormData({
        tier: company.tier,
        status: company.status as any,
        subscription_ends_at: company.subscription_ends_at ? company.subscription_ends_at.split('T')[0] : defaultExpiry.toISOString().split('T')[0],
        custom_candidate_limit: company.custom_candidate_limit || 0,
        verification_credits: company.verification_credits || 0
    });
    
    setIsManageModalOpen(true);
    setActiveMenuId(null);
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCompany) return;

    setIsSubmitting(true);
    try {
        // Convert empty/0 custom limit to undefined (or handle in logic)
        const updatePayload = {
            tier: subFormData.tier,
            status: subFormData.status,
            subscription_ends_at: new Date(subFormData.subscription_ends_at).toISOString(),
            custom_candidate_limit: Number(subFormData.custom_candidate_limit),
            verification_credits: Number(subFormData.verification_credits)
        };

        await updateCompany(managingCompany.id, updatePayload);
        
        await fetchCompanies();
        setIsManageModalOpen(false);
        setManagingCompany(null);
        alert("✅ Data langganan berhasil diperbarui.");
    } catch (error) {
        const errorMessage = (error as any)?.message || "Gagal mengupdate langganan.";
        alert(errorMessage);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus perusahaan ini? Data tidak dapat dikembalikan.")) {
        setIsLoading(true);
        try {
            await deleteCompany(id);
            await fetchCompanies();
            alert("✅ Perusahaan berhasil dihapus.");
        } catch (error) {
            console.error(error);
            alert("Gagal menghapus data.");
        }
        setIsLoading(false);
    }
    setActiveMenuId(null);
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-10 animate-in fade-in duration-500 min-h-screen" onClick={() => setActiveMenuId(null)}>
      
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-brand-dark rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Total Tenant (SaaS)</p>
            <h3 className="text-4xl font-extrabold">{companies.length}</h3>
            <p className="text-green-400 text-sm font-medium mt-2 flex items-center gap-1">
              <ArrowUpRight size={14} /> Live Data
            </p>
          </div>
          <Building2 className="absolute right-4 bottom-4 text-white opacity-10" size={64} />
        </div>
        
        <div className="bg-white dark:bg-brand-slate-850 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
           <div className="relative z-10">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Estimasi MRR</p>
            <h3 className="text-4xl font-extrabold text-gray-800 dark:text-white">$12,450</h3>
            <p className="text-gray-400 text-sm font-medium mt-2">Monthly Recurring Revenue</p>
          </div>
          <Star className="absolute right-4 bottom-4 text-brand-orange opacity-10" size={64} />
        </div>

        <div className="bg-gradient-to-br from-brand-orange to-red-600 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center items-center text-center">
           <button 
             onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
             className="bg-white text-brand-orange w-full py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2"
           >
             <CloudLightning size={20} /> Invite & Send Email
           </button>
           <p className="text-white/80 text-xs mt-3 font-medium">Real Email via Frontend</p>
        </div>
      </div>

      {/* Company List Table */}
      <div className="bg-white dark:bg-brand-slate-850 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-visible">
        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Building2 className="text-brand-blue" size={20} />
            Daftar Perusahaan Terdaftar
          </h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari perusahaan..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue transition-all dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="p-5 font-bold">Nama Perusahaan</th>
                <th className="p-5 font-bold">Paket (Tier)</th>
                <th className="p-5 font-bold">Status</th>
                <th className="p-5 font-bold">Kuota Kandidat</th>
                <th className="p-5 font-bold">Expiry Date</th>
                <th className="p-5 font-bold text-right">Opsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <Loader2 className="w-8 h-8 text-brand-orange animate-spin mx-auto" />
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 dark:text-gray-500 italic">
                    Belum ada data perusahaan. Klik tombol Invite untuk menambahkan.
                  </td>
                </tr>
              ) : companies.map((company) => {
                // Calculate limits based on plan or override
                const planLimit = PLAN_LIMITS[company.tier]?.max_candidates;
                const finalLimit = company.custom_candidate_limit || planLimit;
                const isUnlimited = finalLimit === 'unlimited';
                
                // Expiry Check
                const expiryDate = company.subscription_ends_at ? new Date(company.subscription_ends_at) : null;
                const isExpired = expiryDate ? expiryDate < new Date() : false;

                return (
                <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-300">
                        {company.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{company.name}</p>
                        <p className="text-xs text-gray-400">{company.adminEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold border 
                      ${company.tier === 'Enterprise' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30' 
                        : company.tier === 'Premium'
                        ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'
                        : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'}`}>
                      {company.tier}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${company.status === 'Active' ? 'bg-green-500' : company.status === 'Pending' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                       <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                         {isExpired ? 'Expired' : company.status}
                       </span>
                    </div>
                  </td>
                  <td className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col">
                        <span className="font-bold">{isUnlimited ? '∞ Unlimited' : finalLimit}</span>
                        {company.custom_candidate_limit && <span className="text-[10px] text-brand-orange">(Custom Override)</span>}
                    </div>
                  </td>
                  <td className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    {expiryDate ? expiryDate.toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="p-5 text-right relative">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === company.id ? null : company.id);
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <MoreVertical size={18} />
                    </button>
                    
                    {/* DROPDOWN MENU */}
                    {activeMenuId === company.id && (
                        <div className="absolute right-8 top-8 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-20 overflow-hidden animate-in zoom-in-95 duration-100 text-left">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleManageClick(company); }}
                                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                                <Settings size={14} /> Kelola Langganan
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleResendEmail(company.id); }}
                                className="w-full text-left px-4 py-3 text-sm text-brand-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                            >
                                <Send size={14} /> Kirim Ulang Akses
                            </button>
                            <div className="border-b border-gray-100 dark:border-slate-700 my-1"></div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(company.id); }}
                                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                                <Trash2 size={14} /> Hapus
                            </button>
                        </div>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANAGE SUBSCRIPTION MODAL */}
      {isManageModalOpen && managingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-brand-slate-850 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="text-brand-orange" size={20} />
                    Kelola Langganan
                </h3>
                <p className="text-xs text-gray-500">{managingCompany.name}</p>
              </div>
              <button onClick={() => setIsManageModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateSubscription} className="p-6 space-y-6">
              
              {/* PLAN TIER & STATUS */}
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Paket (Tier)</label>
                    <select
                        value={subFormData.tier}
                        onChange={(e) => setSubFormData({...subFormData, tier: e.target.value as any})}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                    >
                        <option value="Basic">Basic</option>
                        <option value="Premium">Premium</option>
                        <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Status</label>
                    <select
                        value={subFormData.status}
                        onChange={(e) => setSubFormData({...subFormData, status: e.target.value as any})}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                    >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Past Due">Past Due</option>
                    </select>
                  </div>
              </div>

              {/* EXPIRY DATE */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center gap-2">
                    <Calendar size={14} /> Tanggal Berakhir
                </label>
                <input 
                    type="date" 
                    value={subFormData.subscription_ends_at}
                    onChange={(e) => setSubFormData({...subFormData, subscription_ends_at: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">*Sistem akan otomatis mengubah status ke 'Past Due' setelah tanggal ini.</p>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Override Kuota & Kredit</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Kuota Kandidat (Custom)</label>
                        <input 
                            type="number"
                            value={subFormData.custom_candidate_limit}
                            onChange={(e) => setSubFormData({...subFormData, custom_candidate_limit: Number(e.target.value)})}
                            placeholder="0 = Default"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Isi 0 untuk mengikuti default plan.</p>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                             <CreditCard size={12} /> Kredit Verifikasi
                        </label>
                        <input 
                            type="number"
                            value={subFormData.verification_credits}
                            onChange={(e) => setSubFormData({...subFormData, verification_credits: Number(e.target.value)})}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Saldo untuk cek SLIK/OJK (Next Feature).</p>
                     </div>
                  </div>
              </div>

              <div className="pt-2 flex gap-3">
                 <button 
                    type="button"
                    onClick={() => setIsManageModalOpen(false)}
                    className="flex-1 py-3 rounded-xl font-bold border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 transition-all"
                 >
                    Batal
                 </button>
                 <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="flex-1 bg-brand-dark dark:bg-brand-blue text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                 >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18}/> Update Paket</>}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal (Existing) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-brand-slate-850 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CloudLightning className="text-brand-orange" size={20} />
                Undang Perusahaan Baru
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nama Perusahaan</label>
                <input 
                    type="text" required value={newCompany.name}
                    onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                    placeholder="Contoh: PT Teknologi Maju"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email Admin</label>
                <input 
                    type="email" required value={newCompany.email}
                    onChange={(e) => setNewCompany({...newCompany, email: e.target.value})}
                    placeholder="admin@perusahaan.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-orange outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Paket Langganan</label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Basic Tier */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col items-center justify-center gap-1 text-xs text-center transition-all ${newCompany.tier === 'Basic' ? 'border-gray-400 bg-gray-100 text-gray-800 font-bold shadow-sm ring-1 ring-gray-300' : 'border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="tier" value="Basic" className="hidden" checked={newCompany.tier === 'Basic'} onChange={() => setNewCompany({...newCompany, tier: 'Basic'})} />
                    <span className="font-bold">Basic</span>
                    <span className="text-[10px] opacity-70">Starter</span>
                  </label>

                  {/* Premium Tier */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col items-center justify-center gap-1 text-xs text-center transition-all ${newCompany.tier === 'Premium' ? 'border-brand-blue bg-blue-50 text-brand-blue font-bold shadow-sm ring-1 ring-brand-blue' : 'border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="tier" value="Premium" className="hidden" checked={newCompany.tier === 'Premium'} onChange={() => setNewCompany({...newCompany, tier: 'Premium'})} />
                    <span className="font-bold">Premium</span>
                    <span className="text-[10px] opacity-70">Pro Guard</span>
                  </label>

                  {/* Enterprise Tier */}
                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col items-center justify-center gap-1 text-xs text-center transition-all ${newCompany.tier === 'Enterprise' ? 'border-brand-orange bg-orange-50 text-brand-orange font-bold shadow-sm ring-1 ring-brand-orange' : 'border-gray-200 dark:border-slate-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                    <input type="radio" name="tier" value="Enterprise" className="hidden" checked={newCompany.tier === 'Enterprise'} onChange={() => setNewCompany({...newCompany, tier: 'Enterprise'})} />
                    <span className="font-bold">Enterprise</span>
                    <span className="text-[10px] opacity-70">Forensic</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-brand-dark dark:bg-white text-white dark:text-brand-dark py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Kirim Undangan (EmailJS)"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
