
import React, { useState } from 'react';
import { LayoutDashboard, PlusCircle, History, Settings, LogOut, ShieldAlert, Moon, Sun, X, Shield, Link as LinkIcon, Mail, Briefcase, Users, ChevronDown, ChevronRight, Zap, UserPlus, ClipboardCheck, BookOpen } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  companyName: string;
  userRole: string;
  isDarkMode: boolean;
  toggleTheme: () => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, companyName, userRole, isDarkMode, toggleTheme, isOpen, onClose, onLogout }) => {
  const [candidatesExpanded, setCandidatesExpanded] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Ringkasan Eksekutif', icon: LayoutDashboard },
    { id: 'jobs', label: 'Kelola Lowongan', icon: Briefcase },
    { id: 'link-assessment', label: 'Link Asesmen', icon: LinkIcon },
    { id: 'history', label: 'Riwayat Audit', icon: History },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'documentation', label: 'Dokumentasi', icon: BookOpen },
  ];

  const candidateSubMenus = [
    { id: 'candidates-auto', label: 'Otomatis', icon: Zap },
    { id: 'candidates-manual', label: 'Manual Invite', icon: UserPlus },
    { id: 'candidates-review', label: 'Review & Invite', icon: ClipboardCheck },
  ];

  const isCandidateSubmenu = activeTab.startsWith('candidates-');
  const shouldShowCandidateActive = isCandidateSubmenu;

  const adminItem = { id: 'admin-panel', label: 'Admin Panel', icon: Shield };

  return (
    <div className={`
      w-64 bg-white dark:bg-brand-slate-850 border-r border-gray-200 dark:border-slate-700 
      flex flex-col h-screen fixed left-0 top-0 z-30 shadow-xl transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center space-x-3">
            <img
              src="/untitled_design_(43).png"
              alt="HireGood Logo"
              className="h-10 w-10 object-contain"
            />
            <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight font-sans">HireGood.one</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider truncate max-w-[120px]">{companyName}</p>
            </div>
        </div>
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={24} />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {userRole === 'System Admin' && (
           <div className="mb-6">
              <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Super Admin</p>
              <button
                onClick={() => setActiveTab(adminItem.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${
                  activeTab === adminItem.id
                    ? 'bg-brand-dark text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Shield size={20} className={activeTab === adminItem.id ? 'text-brand-orange' : 'text-gray-400'} />
                <span>{adminItem.label}</span>
              </button>
              <div className="my-2 border-b border-gray-100 dark:border-slate-700 mx-4"></div>
           </div>
        )}

        <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Menu Utama</p>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${
                isActive
                  ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500'} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Kandidat - Parent Menu dengan Submenu */}
        <div className="mt-2">
          <button
            onClick={() => setCandidatesExpanded(!candidatesExpanded)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              shouldShowCandidateActive
                ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Users size={20} className={shouldShowCandidateActive ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600'} />
              <span>Kandidat</span>
            </div>
            {candidatesExpanded ?
              <ChevronDown size={16} className={`transition-transform ${shouldShowCandidateActive ? 'text-brand-orange' : 'text-gray-400'}`} /> :
              <ChevronRight size={16} className={`transition-transform ${shouldShowCandidateActive ? 'text-brand-orange' : 'text-gray-400'}`} />
            }
          </button>

          {/* Submenu Items */}
          {candidatesExpanded && (
            <div className="mt-1.5 space-y-0.5">
              {candidateSubMenus.map((subItem) => {
                const SubIcon = subItem.icon;
                const isActive = activeTab === subItem.id;
                return (
                  <button
                    key={subItem.id}
                    onClick={() => setActiveTab(subItem.id)}
                    className={`w-full flex items-center space-x-3 pl-12 pr-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${
                      isActive
                        ? 'bg-brand-orange text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <SubIcon size={16} className={isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600'} />
                    <div className="flex-1 text-left font-medium">{subItem.label}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-slate-700 space-y-2">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium text-sm"
        >
          <span className="flex items-center gap-3">
             {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
             <span>Mode {isDarkMode ? 'Gelap' : 'Terang'}</span>
          </span>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${isDarkMode ? 'bg-brand-orange' : 'bg-gray-300'}`}>
             <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${isDarkMode ? 'left-4.5' : 'left-0.5'}`} style={{ left: isDarkMode ? '18px' : '2px' }}></div>
          </div>
        </button>

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors font-medium"
        >
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-brand-orange/10 dark:bg-brand-orange/20 p-3 rounded-full">
                <LogOut size={28} className="text-brand-orange" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
              Konfirmasi Keluar
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6 text-sm">
              Apakah Anda yakin ingin keluar dari akun Anda?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-orange text-white font-medium hover:bg-brand-orange/90 transition-colors shadow-md hover:shadow-lg"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
