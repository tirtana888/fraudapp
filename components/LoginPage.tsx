import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, ShieldAlert, Eye, EyeOff, KeyRound, ArrowLeft, Send, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { loginWithFirebase, sendPasswordReset, resendVerificationEmail } from '../services/firebase';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
  onSwitchToSignUp?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onSwitchToSignUp }) => {
  const [view, setView] = useState<'login' | 'forgot_password' | 'verify_email'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password State
  const [resetEmail, setResetEmail] = useState('');
  
  // Verification State
  const [unverifiedUser, setUnverifiedUser] = useState<UserProfile | null>(null);
  
  // Common State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const user = await loginWithFirebase(email, password);
      
      // Check if email is verified
      if (!user.emailVerified) {
        console.log('[LOGIN] Email not verified, showing verification prompt');
        setUnverifiedUser(user);
        setView('verify_email');
        setIsLoading(false);
        return;
      }

      // Email verified, proceed with login
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
          await sendPasswordReset(resetEmail);
          setSuccessMsg(`Email reset password telah dikirim ke ${resetEmail}. Periksa inbox Anda.`);
          setResetEmail('');
      } catch (err: any) {
          setError(err.message || "Gagal mereset password. Pastikan email terdaftar.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleResendVerification = async () => {
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      await resendVerificationEmail();
      setSuccessMsg('Email verifikasi telah dikirim ulang! Periksa inbox Anda (termasuk folder spam).');
    } catch (err: any) {
      setError(err.message || "Gagal mengirim ulang email verifikasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipVerification = () => {
    // Allow user to proceed without verification (temporary)
    if (unverifiedUser) {
      onLogin(unverifiedUser);
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
            <span className="font-bold text-xl text-gray-800 tracking-tight">HireGood.one</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">SECURE</span>
        </div>

        <div className="max-w-md w-full mx-auto animate-in fade-in slide-in-from-left-4 duration-500">
          
          {view === 'login' ? (
            <>
                <div className="mb-8">
                  <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Selamat Datang Kembali! 👋</h1>
                  <p className="text-gray-500 text-base">
                    Senang melihat Anda lagi. Masuk untuk melanjutkan proses rekrutmen Anda.
                  </p>
                </div>

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
                        required
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
                        required
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
                    <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-2 animate-in slide-in-from-top-2">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                    )}

                    {successMsg && (
                    <div className="text-green-600 text-sm font-bold bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                        <CheckCircle2 size={16} />
                        {successMsg}
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

                <div className="mt-8">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-500 font-medium">Pengguna baru?</span>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={onSwitchToSignUp}
                      className="w-full mt-4 bg-white text-brand-orange font-bold py-3 px-6 rounded-xl border-2 border-brand-orange hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                    >
                      Buat Akun Gratis
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                      Dengan masuk, Anda menyetujui{' '}
                      <a href="#" className="text-brand-orange hover:underline">Syarat Layanan</a> dan{' '}
                      <a href="#" className="text-brand-orange hover:underline">Kebijakan Privasi</a> kami.
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
                 <p className="text-gray-500 mb-8">Masukkan email terdaftar. Kami akan mengirimkan link reset password ke email Anda.</p>

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
                                required
                                />
                            </div>
                         </div>

                         {error && (
                            <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                                <AlertCircle size={16} />
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
                                Mengirim...
                                </>
                            ) : (
                                <>
                                <Send size={18} /> Kirim Link Reset Password
                                </>
                            )}
                         </button>
                    </form>
                 )}
            </>
          ) : (
            <>
                {/* Email Verification View */}
                <button onClick={() => setView('login')} className="flex items-center gap-2 text-gray-500 hover:text-brand-dark mb-6 font-bold text-sm transition-colors">
                    <ArrowLeft size={16} /> Kembali ke Login
                </button>
                
                <div className="w-16 h-16 bg-orange-100 text-brand-orange rounded-2xl flex items-center justify-center mb-4 mx-auto">
                    <Mail size={32} />
                </div>
                
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 text-center">Verifikasi Email Anda</h1>
                <p className="text-gray-500 mb-6 text-center">
                    Kami telah mengirim email verifikasi ke <span className="font-bold text-gray-700">{unverifiedUser?.email}</span>
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-2">Mengapa perlu verifikasi?</p>
                            <ul className="space-y-1 text-blue-700">
                                <li>• Melindungi akun Anda dari akses tidak sah</li>
                                <li>• Memastikan komunikasi penting terkirim dengan benar</li>
                                <li>• Meningkatkan keamanan data perusahaan</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {successMsg && (
                    <div className="text-green-600 text-sm font-bold bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-2 mb-4 animate-in slide-in-from-top-2">
                        <CheckCircle2 size={16} />
                        {successMsg}
                    </div>
                )}

                {error && (
                    <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 mb-4 animate-in slide-in-from-top-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    <button 
                        onClick={handleResendVerification}
                        disabled={isLoading}
                        className="w-full bg-brand-orange text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                            <Loader2 size={20} className="animate-spin" />
                            Mengirim...
                            </>
                        ) : (
                            <>
                            <RefreshCw size={18} /> Kirim Ulang Email Verifikasi
                            </>
                        )}
                    </button>

                    <button 
                        onClick={handleSkipVerification}
                        className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-all"
                    >
                        Lanjutkan Tanpa Verifikasi
                    </button>
                </div>

                <p className="text-xs text-gray-500 mt-6 text-center">
                    Tidak menerima email? Periksa folder spam atau tunggu beberapa menit sebelum mengirim ulang.
                </p>
            </>
          )}

        </div>
        
        <div className="absolute bottom-6 left-0 right-0 text-center">
             <p className="text-xs text-gray-400 font-medium">© 2024 HireGood.one • Sistem AI Rekrutmen Terpercaya</p>
        </div>
      </div>

      {/* RIGHT SIDE: IMAGE/BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-brand-dark via-gray-800 to-black relative overflow-hidden items-center justify-center">
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>
           
           <div className="relative z-10 max-w-lg text-center p-10">
               <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-2xl">
                   <ShieldCheck size={40} className="text-brand-orange" />
               </div>
               <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight">
                 Rekrutmen Aman dengan <span className="text-brand-orange">AI Intelligence</span>
               </h2>
               <p className="text-gray-300 text-lg leading-relaxed mb-8">
                   Platform deteksi risiko rekrutmen #1 di Indonesia yang menggabungkan psikologi forensik dengan kecerdasan buatan.
               </p>

               <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/5 backdrop-blur-sm p-5 rounded-xl border border-white/10 text-left">
                       <div className="text-3xl font-extrabold text-brand-orange mb-1">500+</div>
                       <p className="text-sm text-gray-400">Perusahaan Terpercaya</p>
                   </div>
                   <div className="bg-white/5 backdrop-blur-sm p-5 rounded-xl border border-white/10 text-left">
                       <div className="text-3xl font-extrabold text-brand-orange mb-1">98%</div>
                       <p className="text-sm text-gray-400">Akurasi Deteksi Fraud</p>
                   </div>
                   <div className="bg-white/5 backdrop-blur-sm p-5 rounded-xl border border-white/10 text-left">
                       <div className="text-3xl font-extrabold text-brand-orange mb-1">10K+</div>
                       <p className="text-sm text-gray-400">Kandidat Terverifikasi</p>
                   </div>
                   <div className="bg-white/5 backdrop-blur-sm p-5 rounded-xl border border-white/10 text-left">
                       <div className="text-3xl font-extrabold text-brand-orange mb-1">ISO 27001</div>
                       <p className="text-sm text-gray-400">Standar Keamanan</p>
                   </div>
               </div>
           </div>
      </div>

    </div>
  );
};

export default LoginPage;
