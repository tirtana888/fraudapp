import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { UserProfile } from '../types';
import { loginWithFirebase, sendPasswordReset, resendVerificationEmail, signInWithGoogle } from '../services/supabase';
import AuthLayout from './layouts/AuthLayout';
import Input from './ui/Input';
import Button from './ui/Button';
import GoogleSignInButton from './ui/GoogleSignInButton';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

      if (!user.emailVerified) {
        console.log('[LOGIN] ⚠️ Email not verified, showing verification prompt');
        setUnverifiedUser(user);
        setView('verify_email');
        setIsLoading(false);
        return;
      }

      console.log('[LOGIN] ✅ Email verified, calling onLogin handler');
      setIsLoading(false);

      if (user) {
        setTimeout(() => {
          onLogin(user);
        }, 100);
      }
    } catch (err: any) {
      console.error('[LOGIN] ❌ Login error:', err);
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
      setTimeout(() => {
        onLogin(unverifiedUser);
      }, 100);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMsg('');
    setIsGoogleLoading(true);

    try {
      console.log('[LOGIN] 🔐 Attempting Google Sign-In...');
      await signInWithGoogle();
      // Google OAuth is a redirect flow — the line above redirects the browser.
      // We should never reach here; if we do it means the redirect failed.
      setIsGoogleLoading(false);
    } catch (err: any) {
      if (err?.isOAuthRedirect) {
        // Redirect is in progress; suppress the error UI — browser will navigate away.
        return;
      }
      console.error('[LOGIN] ❌ Google Sign-In error:', err);
      setError(err.message || "Gagal masuk dengan Google.");
      setIsGoogleLoading(false);
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'login':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <GoogleSignInButton
              onClick={handleGoogleSignIn}
              isLoading={isGoogleLoading}
              disabled={isLoading}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-br from-slate-50 to-orange-50/30 text-slate-500 font-medium">atau</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <Input
                label="Email Perusahaan"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={18} />}
                required
              />

              <div className="space-y-1">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock size={18} />}
                  rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  onRightIconClick={() => setShowPassword(!showPassword)}
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setView('forgot_password')}
                    className="text-xs font-semibold text-brand-orange hover:text-orange-700 transition-colors"
                  >
                    Lupa password?
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50/50 border border-red-100 rounded-xl animate-fade-in-up">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-600 font-medium">{error}</span>
                </div>
              )}

              <Button type="submit" isLoading={isLoading}>
                Masuk Sekarang <ArrowRight size={18} />
              </Button>
            </form>

            <div className="text-center">
              <span className="text-sm text-slate-500">Belum punya akun? </span>
              <button
                type="button"
                onClick={onSwitchToSignUp}
                className="text-sm font-bold text-brand-orange hover:text-orange-700 transition-colors"
              >
                Daftar Gratis
              </button>
            </div>
          </motion.div>
        );

      case 'forgot_password':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <button
              onClick={() => setView('login')}
              className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Kembali ke Login
            </button>

            {successMsg ? (
              <div className="text-center py-8 animate-fade-in-up">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <CheckCircle2 size={40} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Email Terkirim!</h3>
                <p className="text-slate-600 mb-8">{successMsg}</p>
                <Button onClick={() => setView('login')} variant="outline">
                  Kembali ke Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <p className="text-sm text-slate-600">
                  Masukkan email yang terdaftar. Kami akan mengirimkan link untuk mereset password Anda.
                </p>

                <Input
                  label="Email Terdaftar"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  icon={<Mail size={18} />}
                  required
                />

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50/50 border border-red-100 rounded-xl">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-600 font-medium">{error}</span>
                  </div>
                )}

                <Button type="submit" isLoading={isLoading}>
                  Kirim Link Reset
                </Button>
              </form>
            )}
          </motion.div>
        );

      case 'verify_email':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Mail size={32} className="text-brand-orange" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Verifikasi Email</h3>
              <p className="text-sm text-slate-600">
                Link verifikasi telah dikirim ke: <br />
                <span className="font-bold text-slate-900 block mt-1 text-base">{unverifiedUser?.email}</span>
              </p>
            </div>

            {successMsg && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 size={20} className="text-green-600" />
                <span className="text-sm text-green-700 font-medium">{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600 font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <Button onClick={handleResendVerification} isLoading={isLoading}>
                <RefreshCw size={18} /> Kirim Ulang Email
              </Button>

              <Button onClick={handleSkipVerification} variant="ghost">
                Lewati & Masuk Dashboard
              </Button>
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              Cek folder Spam jika email tidak muncul di kotak masuk utama.
            </p>
          </motion.div>
        );
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'login': return 'Selamat Datang Kembali';
      case 'forgot_password': return 'Reset Password';
      case 'verify_email': return 'Periksa Email Anda';
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case 'login': return 'Masukkan kredensial Anda untuk mengakses akun';
      case 'forgot_password': return 'Jangan khawatir, ini bisa terjadi pada siapa saja';
      case 'verify_email': return 'Kami perlu memverifikasi identitas Anda';
    }
  };

  return (
    <AuthLayout
      title={getTitle()}
      subtitle={getSubtitle()}
    >
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>
    </AuthLayout>
  );
};

export default LoginPage;