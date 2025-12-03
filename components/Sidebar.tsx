
import React from 'react';
import { LayoutDashboard, PlusCircle, History, Settings, LogOut, ShieldAlert, Moon, Sun, X, Shield, Link as LinkIcon, Mail, Briefcase, Users } from 'lucide-react';

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
  
  const menuItems = [
    { id: 'dashboard', label: 'Ringkasan Eksekutif', icon: LayoutDashboard },
    { id: 'candidates', label: 'Candidate Management', icon: Users },
    { id: 'jobs', label: 'Kelola Lowongan', icon: Briefcase },
    { id: 'job-applications', label: 'Aplikasi Lowongan', icon: ShieldAlert },
    { id: 'candidate-blast', label: 'Undang Kandidat', icon: Mail },
    { id: 'link-assessment', label: 'Link Asesmen', icon: LinkIcon },
    { id: 'history', label: 'Riwayat Audit', icon: History },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const adminItem = { id: 'admin-panel', label: 'Admin Panel', icon: Shield };

  return (
    <div className={`
      w-64 bg-white dark:bg-brand-slate-850 border-r border-gray-200 dark:border-slate-700 
      flex flex-col h-screen fixed left-0 top-0 z-30 shadow-xl transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center space-x-2">
            <div className="bg-brand-orange p-2 rounded-lg text-white shadow-md shadow-orange-100 dark:shadow-none">
            <ShieldAlert size={24} />
            </div>
            <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight font-sans">FraudGuard</h1>
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
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors font-medium"
        >
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
