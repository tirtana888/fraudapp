import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw, Info } from 'lucide-react';
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
      console.log('[LOGIN] 🔐 Attempting login for:', email);
      const user = await loginWithFirebase(email, password);
      console.log('[LOGIN] ✅ Firebase login successful:', user.email, 'Verified:', user.emailVerified);
      
      // Check if email is verified
      if (!user.emailVerified) {
        console.log('[LOGIN] ⚠️ Email not verified, showing verification prompt');
        setUnverifiedUser(user);
        setView('verify_email');
        setIsLoading(false);
        return;
      }

      // Email verified, proceed with login
      console.log('[LOGIN] ✅ Email verified, calling onLogin handler');
      setIsLoading(false); // Stop loading before transition
      
      if (user) {
        // IMPORTANT: Wait a bit for Firebase Auth observer to register the user
        // This prevents race condition where observer hasn't updated yet
        setTimeout(() => {
          onLogin(user);
        }, 100);
      }
    } catch (err: any) {
      console.error('[LOGIN] ❌ Login error:', err);
      console.error('[LOGIN] Error details:', err.message, err.code);
      setError(err.message || "Gagal masuk. Periksa email dan password.");
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
          setSuccessMsg('Email reset password telah dikirim. Periksa inbox Anda.');
          setResetEmail('');
      } catch (err: any) {
          setError(err.message || "Gagal mereset password.");
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
      setSuccessMsg('Email verifikasi telah dikirim ulang! Periksa inbox Anda.');
    } catch (err: any) {
      setError(err.message || "Gagal mengirim ulang email verifikasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipVerification = () => {
    if (unverifiedUser) {
      console.log('[LOGIN] User chose to skip email verification');
      
      // Wait a bit for Firebase Auth observer to register
      setTimeout(() => {
        onLogin(unverifiedUser);
      }, 100);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <img 
              src="/untitled_design_43.png" 
              alt="HireGood Logo" 
              className="w-12 h-12 object-contain"
            />
            <span className="text-2xl font-bold text-gray-900">HireGood</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          
          {view === 'login' ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Masuk</h1>
                <p className="text-sm text-gray-500">Selamat datang kembali</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@perusahaan.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button 
                      type="button" 
                      onClick={() => setView('forgot_password')} 
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span className="text-sm text-green-700">{successMsg}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium py-2.5 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-sm">Memproses...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">Masuk</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <span className="text-sm text-gray-600">Belum punya akun? </span>
                <button
                  type="button"
                  onClick={onSwitchToSignUp}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Daftar sekarang
                </button>
              </div>
            </>
          ) : view === 'forgot_password' ? (
            <>
              <button 
                onClick={() => setView('login')} 
                className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
              >
                ← Kembali
              </button>
              
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
                <p className="text-sm text-gray-500">Masukkan email untuk reset password</p>
              </div>

              {successMsg ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Email Terkirim!</h3>
                  <p className="text-sm text-gray-600 mb-6">{successMsg}</p>
                  <button 
                    onClick={() => setView('login')} 
                    className="text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    Kembali ke Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input 
                        type="email" 
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="nama@perusahaan.com"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium py-2.5 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span className="text-sm">Mengirim...</span>
                      </>
                    ) : (
                      <span className="text-sm">Kirim Link Reset</span>
                    )}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              {/* Email Verification View */}
              <button 
                onClick={() => setView('login')} 
                className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
              >
                ← Kembali
              </button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail size={28} className="text-orange-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifikasi Email</h1>
                <p className="text-sm text-gray-600">
                  Kami telah mengirim link verifikasi ke<br />
                  <span className="font-medium text-gray-900">{unverifiedUser?.email}</span>
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Mengapa verifikasi email?</p>
                    <ul className="text-blue-800 space-y-0.5 text-xs">
                      <li>• Keamanan akun terjamin</li>
                      <li>• Mencegah penyalahgunaan</li>
                      <li>• Komunikasi lancar</li>
                    </ul>
                  </div>
                </div>
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm text-green-700">{successMsg}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <button 
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium py-2.5 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-sm">Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} />
                      <span className="text-sm">Kirim Ulang Email</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={handleSkipVerification}
                  className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-200 transition-all text-sm"
                >
                  Lewati Dulu
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Tidak menerima email? Periksa folder spam
              </p>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">© 2024 HireGood.one</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;