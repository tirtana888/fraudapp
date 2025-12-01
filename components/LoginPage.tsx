
import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, ShieldAlert, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../types';
import { loginWithFirestore, resetUserPassword } from '../services/firebase';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'forgot_password'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password State
  const [resetEmail, setResetEmail] = useState('');
  
  // Common State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setIsLoading(true);

      try {
          const result = await resetUserPassword(resetEmail);
          setSuccessMsg(result.message);
          setResetEmail('');
      } catch (err: any) {
          setError(err.message || "Gagal mereset password. Pastikan email terdaftar.");
      } finally {
          setIsLoading(false);
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
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">SECURE</span>
        </div>

        <div className="max-w-md w-full mx-auto animate-in fade-in slide-in-from-left-4 duration-500">
          
          {view === 'login' ? (
            <>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Login Perusahaan</h1>
                <p className="text-gray-500 mb-8">Masuk ke akun Enterprise SaaS Anda.</p>

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
                        <button type="button" onClick={() => setView('forgot_password')} className="text-sm font-bold text-brand-orange hover:underline">Lupa sandi?</button>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                        />
                        <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                        >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
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
                        Mengautentikasi...
                        </>
                    ) : (
                        <>
                        Masuk ke Akun <ArrowRight size={20} />
                        </>
                    )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-400">
                    Belum punya akun? <span className="font-bold text-gray-600">Hubungi Sales Enterprise</span>
                    </p>
                </div>
            </>
          ) : (
            <>
                 <button onClick={() => setView('login')} className="flex items-center gap-2 text-gray-500 hover:text-brand-dark mb-6 font-bold text-sm transition-colors">
                    <ArrowLeft size={16} /> Kembali ke Login
                 </button>
                 
                 <div className="w-12 h-12 bg-blue-100 text-brand-blue rounded-xl flex items-center justify-center mb-4">
                    <KeyRound size={24} />
                 </div>
                 
                 <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">Reset Kata Sandi</h1>
                 <p className="text-gray-500 mb-8">Masukkan email terdaftar. Kami akan mengirimkan password sementara yang baru.</p>

                 {successMsg ? (
                     <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in zoom-in-95">
                         <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                             <ShieldCheck size={24} />
                         </div>
                         <h3 className="font-bold text-green-800 mb-2">Email Terkirim!</h3>
                         <p className="text-sm text-green-700 mb-4">{successMsg}</p>
                         <button onClick={() => setView('login')} className="text-sm font-bold text-green-800 hover:underline">
                             Login Sekarang
                         </button>
                     </div>
                 ) : (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Email Perusahaan</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input 
                            type="email" 
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="name@company.com"
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
                        className="w-full bg-brand-dark text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                        {isLoading ? (
                            <>
                            <Loader2 size={20} className="animate-spin" />
                            Memproses...
                            </>
                        ) : (
                            <>
                            Kirim Password Baru <SendIcon />
                            </>
                        )}
                        </button>
                    </form>
                 )}
            </>
          )}

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
            Advanced Fraud Detection.
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            Platform SaaS Enterprise dengan keamanan tingkat tinggi, integrasi database real-time, dan audit otomatis.
          </p>

          <div className="flex justify-center gap-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-xl">
               <p className="text-2xl font-bold text-white">99.9%</p>
               <p className="text-xs text-gray-400 uppercase tracking-wider">Uptime</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-xl">
               <p className="text-2xl font-bold text-white">ISO</p>
               <p className="text-xs text-gray-400 uppercase tracking-wider">27001 Ready</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

// Helper Icon for button
const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
)

export default LoginPage;
