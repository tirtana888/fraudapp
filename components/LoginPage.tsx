import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import { UserProfile } from '../types';
import { loginWithFirestore } from '../services/firebase';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await loginWithFirestore(email, password);
      if (user) {
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || "Gagal masuk. Periksa email dan password.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (type: 'enterprise' | 'admin') => {
    if (type === 'enterprise') {
      setEmail('enterprise@fraudguard.id');
      setPassword('password123');
    } else {
      setEmail('admin@fraudguard.id');
      setPassword('admin123');
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      
      {/* LEFT SIDE: FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 md:px-20 xl:px-32 relative">
        <div className="absolute top-8 left-8 md:left-20 flex items-center gap-2">
            <div className="bg-brand-orange p-1.5 rounded-lg text-white">
              <ShieldAlert size={20} />
            </div>
            <span className="font-bold text-xl text-gray-800 tracking-tight">FraudGuard</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">LIVE DB</span>
        </div>

        <div className="max-w-md w-full mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Login Perusahaan</h1>
          <p className="text-gray-500 mb-8">Masuk ke akun Enterprise real-time Anda.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email Perusahaan</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700">Kata Sandi</label>
                <a href="#" className="text-sm font-bold text-brand-orange hover:underline">Lupa sandi?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                <ShieldAlert size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-brand-orange text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Mengautentikasi ke Cloud...
                </>
              ) : (
                <>
                  Masuk ke Akun <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* Quick Login for Testing the "Real" Scenario */}
          <div className="mt-8 pt-6 border-t border-gray-100">
             <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3 text-center">Akun Real Database (Auto-Seed)</p>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button"
                  onClick={() => fillCredentials('enterprise')}
                  className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-2 rounded-lg border border-gray-200 transition-colors"
                >
                   PT Maju Bersama
                </button>
                <button 
                  type="button"
                  onClick={() => fillCredentials('admin')}
                  className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-2 rounded-lg border border-gray-200 transition-colors"
                >
                   Super Admin
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: VISUAL */}
      <div className="hidden lg:flex w-1/2 bg-brand-slate-900 relative overflow-hidden items-center justify-center">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-orange opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-blue opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 max-w-lg px-10 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-brand-orange to-red-600 rounded-3xl mx-auto mb-8 shadow-2xl flex items-center justify-center rotate-3 transform hover:rotate-6 transition-transform duration-500">
             <ShieldCheck size={48} className="text-white" />
          </div>
          
          <h2 className="text-3xl font-extrabold text-white mb-6 leading-tight">
            Production Ready.
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            Platform SaaS kini terhubung langsung ke <span className="text-brand-orange font-bold">Live Cloud Database</span>. Data user, sesi, dan perusahaan bersifat persisten dan aman.
          </p>

          <div className="flex justify-center gap-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-xl">
               <p className="text-2xl font-bold text-white">Live</p>
               <p className="text-xs text-gray-400 uppercase tracking-wider">Status Database</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-xl">
               <p className="text-2xl font-bold text-white">Real</p>
               <p className="text-xs text-gray-400 uppercase tracking-wider">Multi-Tenant</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default LoginPage;