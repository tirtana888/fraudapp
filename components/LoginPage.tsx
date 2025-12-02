import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, ShieldAlert, Eye, EyeOff, KeyRound, ArrowLeft, Send, User } from 'lucide-react';
import { UserProfile } from '../types';
import { signIn, resetUserPassword, signUp } from '../services/supabase';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'forgot_password' | 'signup'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign Up State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupCompany, setSignupCompany] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  
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
      const user = await signIn(email, password);
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      // Generate company ID from company name
      const companyId = `temp-${Date.now()}`;

      await signUp(signupEmail, signupPassword, {
        name: signupName,
        role: 'Company Admin',
        company_id: companyId,
        avatar: `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(signupName)}`
      });

      setSuccessMsg('Akun berhasil dibuat! Silakan login.');
      setTimeout(() => {
        setView('login');
        setEmail(signupEmail);
        setSuccessMsg('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Gagal membuat akun. Coba lagi.");
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
                    Belum punya akun? <button onClick={() => setView('signup')} className="font-bold text-brand-orange hover:underline">Daftar Sekarang</button>
                    </p>
                </div>
            </>
          ) : view === 'forgot_password' ? (
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
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                <Send size={18} /> Kirim Password Baru
                                </>
                            )}
                         </button>
                    </form>
                 )}
            </>
          ) : (
            <>
                 <button onClick={() => setView('login')} className="flex items-center gap-2 text-gray-500 hover:text-brand-dark mb-6 font-bold text-sm transition-colors">
                    <ArrowLeft size={16} /> Kembali ke Login
                 </button>

                 <div className="w-12 h-12 bg-orange-100 text-brand-orange rounded-xl flex items-center justify-center mb-4">
                    <User size={24} />
                 </div>

                 <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">Buat Akun Baru</h1>
                 <p className="text-gray-500 mb-8">Daftar untuk mulai menggunakan FraudGuard.</p>

                 {successMsg ? (
                     <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in zoom-in-95">
                         <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                             <ShieldCheck size={24} />
                         </div>
                         <h3 className="font-bold text-green-800 mb-2">Berhasil!</h3>
                         <p className="text-sm text-green-700">{successMsg}</p>
                     </div>
                 ) : (
                    <form onSubmit={handleSignUp} className="space-y-4">
                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nama Lengkap</label>
                            <div className="relative">
                                <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                type="text"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                placeholder="John Doe"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                                />
                            </div>
                         </div>

                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                type="email"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                placeholder="name@company.com"
                                required
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                                />
                            </div>
                         </div>

                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                type={showSignupPassword ? "text" : "password"}
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                                />
                                <button
                                type="button"
                                onClick={() => setShowSignupPassword(!showSignupPassword)}
                                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                                >
                                {showSignupPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Minimal 6 karakter</p>
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
                                Membuat Akun...
                                </>
                            ) : (
                                <>
                                <User size={18} /> Buat Akun
                                </>
                            )}
                         </button>

                         <p className="text-xs text-gray-500 text-center mt-4">
                            Dengan mendaftar, Anda menyetujui <span className="text-brand-orange font-bold">Terms & Conditions</span>
                         </p>
                    </form>
                 )}
            </>
          )}

        </div>
        
        <div className="absolute bottom-6 left-0 right-0 text-center">
             <p className="text-xs text-gray-300 font-medium">© 2024 FraudGuard System AI</p>
        </div>
      </div>

      {/* RIGHT SIDE: IMAGE/BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 relative overflow-hidden items-center justify-center">
           <div className="absolute inset-0 bg-gradient-to-br from-brand-dark to-black opacity-90"></div>
           
           <div className="relative z-10 max-w-lg text-center p-10">
               <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-2xl">
                   <ShieldCheck size={40} className="text-brand-orange" />
               </div>
               <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight">Secure Your Hiring with <span className="text-brand-orange">AI Intelligence</span></h2>
               <p className="text-gray-300 text-lg leading-relaxed">
                   Platform deteksi risiko rekrutmen #1 di Indonesia yang menggabungkan psikologi forensik dengan kecerdasan buatan.
               </p>

               <div className="mt-10 grid grid-cols-2 gap-4 text-left">
                   <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                       <h4 className="font-bold text-white mb-1">98% Akurasi</h4>
                       <p className="text-xs text-gray-400">Dalam mendeteksi potensi fraud kandidat.</p>
                   </div>
                   <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                       <h4 className="font-bold text-white mb-1">ISO 27001</h4>
                       <p className="text-xs text-gray-400">Standar keamanan data perbankan.</p>
                   </div>
               </div>
           </div>
      </div>

    </div>
  );
};

export default LoginPage;