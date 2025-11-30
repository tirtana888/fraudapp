
import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, MoreVertical, Mail, Users, Star, ArrowUpRight, Loader2, X, CheckCircle2, CloudLightning, Pencil, Trash2, Shield, Save } from 'lucide-react';
import { CompanyProfile } from '../types';
import { inviteCompanyCloud, getCompanies, updateCompany, deleteCompany } from '../services/firebase';

const AdminDashboard: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Invite Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit Modal & Dropdown State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyProfile | null>(null);

  // Form State
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
      const result = await inviteCompanyCloud(payload);
      await fetchCompanies();
      
      // Fix: Cast result to any to avoid "Property 'message' does not exist on type 'unknown'"
      const successMessage = (result as any)?.message || "Perusahaan berhasil didaftarkan.";
      alert(`✅ SUKSES!\n\n${successMessage}`);

      setNewCompany({ name: '', email: '', tier: 'Basic' });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Gagal mengundang:", error);
      // Fix: Cast error to any or Error to access message safely
      const errorMessage = (error as any)?.message || "Terjadi kesalahan saat memproses undangan.";
      alert(`Gagal: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (company: CompanyProfile) => {
    setEditingCompany(company);
    setIsEditModalOpen(true);
    setActiveMenuId(null);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    setIsSubmitting(true);
    try {
        await updateCompany(editingCompany.id, {
            name: editingCompany.name,
            tier: editingCompany.tier,
            status: editingCompany.status
        });
        await fetchCompanies();
        setIsEditModalOpen(false);
        setEditingCompany(null);
    } catch (error) {
        // Fix: Safe error handling
        const errorMessage = (error as any)?.message || "Gagal mengupdate perusahaan.";
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
              <ArrowUpRight size={14} /> +2 bulan ini
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
             <CloudLightning size={20} /> Invite via Cloud Function
           </button>
           <p className="text-white/80 text-xs mt-3 font-medium">Trigger email & DB otomatis</p>
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
                <th className="p-5 font-bold">Admin Email</th>
                <th className="p-5 font-bold">User</th>
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
              ) : companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-300">
                        {company.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{company.name}</p>
                        <p className="text-xs text-gray-400">ID: {company.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold border 
                      ${company.tier === 'Enterprise' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30' 
                        : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'}`}>
                      {company.tier}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${company.status === 'Active' ? 'bg-green-500' : company.status === 'Pending' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                       <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{company.status}</span>
                    </div>
                  </td>
                  <td className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    {company.adminEmail}
                  </td>
                  <td className="p-5 text-sm text-gray-500 dark:text-gray-400">
                    {company.usersCount || 0}
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
                        <div className="absolute right-8 top-8 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-20 overflow-hidden animate-in zoom-in-95 duration-100">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleEditClick(company); }}
                                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                                <Pencil size={14} /> Edit Data
                            </button>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-brand-slate-850 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <CloudLightning className="text-brand-orange" size={20} />
                Trigger Cloud Function
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
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Paket</label>
                <div className="flex gap-3">
                  <label className={`flex-1 p-3 rounded-xl border cursor-pointer flex items-center justify-center gap-2 ${newCompany.tier === 'Basic' ? 'border-brand-orange bg-orange-50 dark:bg-orange-900/20 text-brand-orange font-bold' : 'border-gray-200 dark:border-slate-600'}`}>
                    <input type="radio" name="tier" value="Basic" className="hidden" checked={newCompany.tier === 'Basic'} onChange={() => setNewCompany({...newCompany, tier: 'Basic'})} /> Basic
                  </label>
                  <label className={`flex-1 p-3 rounded-xl border cursor-pointer flex items-center justify-center gap-2 ${newCompany.tier === 'Enterprise' ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/20 text-brand-blue font-bold' : 'border-gray-200 dark:border-slate-600'}`}>
                    <input type="radio" name="tier" value="Enterprise" className="hidden" checked={newCompany.tier === 'Enterprise'} onChange={() => setNewCompany({...newCompany, tier: 'Enterprise'})} /> Enterprise
                  </label>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-brand-dark dark:bg-white text-white dark:text-brand-dark py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Jalankan Cloud Function"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-brand-slate-850 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Pencil className="text-brand-blue" size={20} />
                Edit Perusahaan
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Nama Perusahaan</label>
                <input 
                    type="text" required value={editingCompany.name}
                    onChange={(e) => setEditingCompany({...editingCompany, name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Status Akun</label>
                <select
                    value={editingCompany.status}
                    onChange={(e) => setEditingCompany({...editingCompany, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-brand-blue outline-none"
                >
                    <option value="Active">Active (Aktif)</option>
                    <option value="Pending">Pending (Menunggu)</option>
                    <option value="Suspended">Suspended (Ditangguhkan)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Paket Langganan</label>
                <div className="flex gap-3">
                  <label className={`flex-1 p-3 rounded-xl border cursor-pointer flex items-center justify-center gap-2 ${editingCompany.tier === 'Basic' ? 'border-brand-orange bg-orange-50 dark:bg-orange-900/20 text-brand-orange font-bold' : 'border-gray-200 dark:border-slate-600 text-gray-500'}`}>
                    <input type="radio" name="edit_tier" value="Basic" className="hidden" checked={editingCompany.tier === 'Basic'} onChange={() => setEditingCompany({...editingCompany, tier: 'Basic'})} /> Basic
                  </label>
                  <label className={`flex-1 p-3 rounded-xl border cursor-pointer flex items-center justify-center gap-2 ${editingCompany.tier === 'Enterprise' ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/20 text-brand-blue font-bold' : 'border-gray-200 dark:border-slate-600 text-gray-500'}`}>
                    <input type="radio" name="edit_tier" value="Enterprise" className="hidden" checked={editingCompany.tier === 'Enterprise'} onChange={() => setEditingCompany({...editingCompany, tier: 'Enterprise'})} /> Enterprise
                  </label>
                </div>
              </div>

              <div className="pt-2">
                 <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18}/> Simpan Perubahan</>}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
