
import React, { useState } from 'react';
import { LayoutDashboard, PlusCircle, History, Settings, LogOut, ShieldAlert, Moon, Sun, X, Shield, Link as LinkIcon, Mail, Briefcase, Users, ChevronDown, ChevronRight, Zap, UserPlus, ClipboardCheck, BookOpen, ChevronLeft, Workflow, CreditCard } from 'lucide-react';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, companyName, userRole, isDarkMode, toggleTheme, isOpen, onClose, onLogout, isCollapsed = false, onToggleCollapse }) => {
  const [candidatesExpanded, setCandidatesExpanded] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const coreMenuItems = [
    { id: 'dashboard', label: 'Ringkasan Eksekutif', icon: LayoutDashboard },
    { id: 'jobs', label: 'Kelola Lowongan', icon: Briefcase },
    { id: 'workflows', label: 'Workflow Rekrutmen', icon: Workflow },
  ];

  const candidateSubMenus = [
    { id: 'candidates-auto', label: 'Sourcing Otomatis', icon: Zap },
    { id: 'candidates-manual', label: 'Undang Manual', icon: UserPlus },
    { id: 'candidates-review', label: 'Review & Invite', icon: ClipboardCheck },
  ];

  const linkMenuItem = { id: 'link-assessment', label: 'Link Asesmen', icon: LinkIcon };

  const dataLogMenuItems = [
    { id: 'history', label: 'Riwayat', icon: History },
    { id: 'documentation', label: 'Dokumentasi', icon: BookOpen },
  ];

  const creditMenuItem = { id: 'credit-management', label: 'Manajemen Kredit', icon: CreditCard };
  const systemMenuItem = { id: 'settings', label: 'Pengaturan', icon: Settings };

  const isCandidateSubmenu = activeTab.startsWith('candidates-');
  const shouldShowCandidateActive = isCandidateSubmenu;

  const adminItem = { id: 'admin-panel', label: 'Admin Panel', icon: Shield };

  return (
    <div className={`
      ${isCollapsed ? 'w-16' : 'w-56'} bg-white dark:bg-brand-slate-850 border-r border-gray-200 dark:border-slate-700 
      flex flex-col h-screen fixed left-0 top-0 z-30 shadow-lg transition-all duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      {/* Header */}
      <div className={`${isCollapsed ? 'p-3' : 'p-4'} flex items-center justify-between border-b border-gray-100 dark:border-slate-700`}>
        {!isCollapsed ? (
          <div className="flex items-center space-x-2">
            <img
              src="/untitled_design_(43).png"
              alt="HireGood Logo"
              className="h-8 w-8 object-contain"
            />
            <div>
              <h1 className="text-base font-bold text-gray-800 dark:text-white tracking-tight">HireGood</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider truncate max-w-[100px]">{companyName}</p>
            </div>
          </div>
        ) : (
          <img
            src="/untitled_design_(43).png"
            alt="HireGood Logo"
            className="h-8 w-8 object-contain mx-auto"
          />
        )}
        
        {/* Mobile close button */}
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={20} />
        </button>
      </div>

      {/* Collapse Toggle Button - Desktop only */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex absolute -right-3 top-20 bg-white dark:bg-brand-slate-850 border border-gray-200 dark:border-slate-700 rounded-full p-1.5 shadow-md hover:shadow-lg transition-all hover:bg-gray-50 dark:hover:bg-slate-800 z-40"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft size={16} className={`text-gray-600 dark:text-gray-400 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      )}

      <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-3'} space-y-1 overflow-y-auto`}>
        {(userRole === 'System Admin' || userRole === 'superadmin') && (
           <div className="mb-3">
              {!isCollapsed && <p className="px-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Admin</p>}
              <button
                onClick={() => setActiveTab(adminItem.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
                  activeTab === adminItem.id
                    ? 'bg-brand-dark text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={isCollapsed ? adminItem.label : ''}
              >
                <Shield size={18} className={activeTab === adminItem.id ? 'text-brand-orange' : 'text-gray-400'} />
                {!isCollapsed && <span className="text-sm">{adminItem.label}</span>}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap">
                    {adminItem.label}
                  </span>
                )}
              </button>
           </div>
        )}

        {/* BAGIAN 1: INTI (Sering Diakses) */}
        {!isCollapsed && <p className="px-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Inti</p>}
        {coreMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
                isActive
                  ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <Icon size={18} className={isActive ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500'} />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
              {isCollapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

        {/* Kandidat - Parent Menu dengan Submenu */}
        <div className="mt-2">
          <button
            onClick={() => isCollapsed ? null : setCandidatesExpanded(!candidatesExpanded)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
              shouldShowCandidateActive
                ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title={isCollapsed ? 'Kandidat' : ''}
          >
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-2'}`}>
              <Users size={18} className={shouldShowCandidateActive ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600'} />
              {!isCollapsed && <span className="text-sm">Kandidat</span>}
            </div>
            {!isCollapsed && (
              candidatesExpanded ?
                <ChevronDown size={14} className={`transition-transform ${shouldShowCandidateActive ? 'text-brand-orange' : 'text-gray-400'}`} /> :
                <ChevronRight size={14} className={`transition-transform ${shouldShowCandidateActive ? 'text-brand-orange' : 'text-gray-400'}`} />
            )}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                Kandidat
              </span>
            )}
          </button>

          {!isCollapsed && candidatesExpanded && (
            <div className="mt-1 ml-2 pl-2 space-y-0.5 border-l-2 border-gray-200 dark:border-slate-700">
              {candidateSubMenus.map((subItem) => {
                const SubIcon = subItem.icon;
                const isActive = activeTab === subItem.id;
                return (
                  <button
                    key={subItem.id}
                    onClick={() => setActiveTab(subItem.id)}
                    className={`w-full flex items-center space-x-2 pl-4 pr-3 py-2 rounded-lg transition-all duration-200 text-xs group ${
                      isActive
                        ? 'bg-brand-orange/10 text-brand-orange dark:bg-brand-orange/20'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <SubIcon size={14} className={isActive ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600'} />
                    <span className="flex-1 text-left font-medium leading-snug">{subItem.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Link Asesmen */}
        <div className="mt-2">
          <button
            onClick={() => setActiveTab(linkMenuItem.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
              activeTab === linkMenuItem.id
                ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title={isCollapsed ? linkMenuItem.label : ''}
          >
            <LinkIcon size={18} className={activeTab === linkMenuItem.id ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500'} />
            {!isCollapsed && <span className="text-sm">{linkMenuItem.label}</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                {linkMenuItem.label}
              </span>
            )}
          </button>
        </div>

        {/* BAGIAN 2: DATA & LOG */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700">
          {!isCollapsed && <p className="px-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Data</p>}
          {dataLogMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
                  isActive
                    ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <Icon size={18} className={isActive ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500'} />
                {!isCollapsed && <span className="text-sm">{item.label}</span>}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* BAGIAN 3: SISTEM */}
        <div className="mt-3">
          {!isCollapsed && <p className="px-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 mt-2">Sistem</p>}
          
          {/* Credit Management */}
          <button
            onClick={() => setActiveTab(creditMenuItem.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
              activeTab === creditMenuItem.id
                ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title={isCollapsed ? creditMenuItem.label : ''}
          >
            <CreditCard size={18} className={activeTab === creditMenuItem.id ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500'} />
            {!isCollapsed && <span className="text-sm">{creditMenuItem.label}</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                {creditMenuItem.label}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveTab(systemMenuItem.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg transition-all duration-200 font-medium group relative ${
              activeTab === systemMenuItem.id
                ? 'bg-brand-blue/15 text-brand-orange shadow-sm dark:bg-brand-orange/20 dark:text-brand-orange'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            title={isCollapsed ? systemMenuItem.label : ''}
          >
            <Settings size={18} className={activeTab === systemMenuItem.id ? 'text-brand-orange' : 'text-gray-400 dark:text-slate-500'} />
            {!isCollapsed && <span className="text-sm">{systemMenuItem.label}</span>}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                {systemMenuItem.label}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className={`${isCollapsed ? 'p-2' : 'p-3'} border-t border-gray-100 dark:border-slate-700 space-y-1.5`}>
        <button 
          onClick={toggleTheme}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium text-sm group relative`}
          title={isCollapsed ? (isDarkMode ? 'Mode Gelap' : 'Mode Terang') : ''}
        >
          {!isCollapsed ? (
            <>
              <span className="flex items-center gap-2">
                {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                <span className="text-xs">Mode {isDarkMode ? 'Gelap' : 'Terang'}</span>
              </span>
              <div className={`w-7 h-3.5 rounded-full relative transition-colors ${isDarkMode ? 'bg-brand-orange' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm`} style={{ left: isDarkMode ? '15px' : '2px' }}></div>
              </div>
            </>
          ) : (
            <>
              {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                Mode {isDarkMode ? 'Gelap' : 'Terang'}
              </span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors font-medium group relative`}
          title={isCollapsed ? 'Keluar' : ''}
        >
          <LogOut size={18} />
          {!isCollapsed && <span className="text-sm">Keluar</span>}
          {isCollapsed && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Keluar
            </span>
          )}
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
