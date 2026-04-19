import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Building2, User, CheckCircle2, ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { signUpWithFirebase, signInWithGoogle } from '../services/supabase';
import AuthLayout from './layouts/AuthLayout';
import Input from './ui/Input';
import Button from './ui/Button';
import GoogleSignInButton from './ui/GoogleSignInButton';
import { motion, AnimatePresence } from 'framer-motion';

interface SignUpPageProps {
  onSignUpSuccess: (user: UserProfile) => void;
  onSwitchToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSignUpSuccess, onSwitchToLogin }) => {
  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    fullName: '',
    email: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Password Strength Check
  const checkPasswordStrength = (password: string) => {
    if (password.length === 0) {
      setPasswordStrength(null);
      return;
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    const strength = [hasLower, hasUpper, hasNumber, hasSpecial, isLongEnough].filter(Boolean).length;

    if (strength <= 2) setPasswordStrength('weak');
    else if (strength <= 4) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'password') {
      checkPasswordStrength(value);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.companyName.trim()) return 'Nama perusahaan harus diisi';
    if (!formData.fullName.trim()) return 'Nama lengkap harus diisi';
    if (!formData.email.trim()) return 'Email harus diisi';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Format email tidak valid';
    if (formData.password.length < 8) return 'Password minimal 8 karakter';
    if (passwordStrength === 'weak') return 'Password terlalu lemah';

    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    console.log('[SIGNUP] 🚀 Starting sign up process...');

    try {
      const user = await signUpWithFirebase({
        companyName: formData.companyName.trim(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: '',
        password: formData.password
      });

      console.log('[SIGNUP] ✅ Sign up successful!');

      if (user) {
        // Show verification message instead of auto-login
        setRegisteredEmail(formData.email);
        setShowVerificationMessage(true);
      }
    } catch (err: any) {
      console.error('[SIGNUP] ❌ Sign up error:', err);

      // Special handling for duplicate email
      if (err.message && err.message.includes('Email sudah terdaftar')) {
        setError('Email ini sudah terdaftar. Silakan login atau reset password jika lupa.');
      } else {
        setError(err.message || "Gagal mendaftar. Silakan coba lagi.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      console.log('[SIGNUP] 🔐 Attempting Google Sign-Up...');
      const user = await signInWithGoogle();
      console.log('[SIGNUP] ✅ Google Sign-Up successful:', user.email);

      setIsGoogleLoading(false);

      if (user) {
        // Directly call onSignUpSuccess for Google users (email already verified)
        setTimeout(() => {
          onSignUpSuccess(user);
        }, 100);
      }
    } catch (err: any) {
      console.error('[SIGNUP] ❌ Google Sign-Up error:', err);
      setError(err.message || "Gagal mendaftar dengan Google.");
      setIsGoogleLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    if (!passwordStrength) return '';
    if (passwordStrength === 'weak') return 'bg-red-500';
    if (passwordStrength === 'medium') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (!passwordStrength) return '';
    if (passwordStrength === 'weak') return 'Lemah';
    if (passwordStrength === 'medium') return 'Sedang';
    return 'Kuat';
  };

  if (showVerificationMessage) {
    return (
      <AuthLayout title="Buat Akun Baru" subtitle="Bergabunglah dengan ribuan perusahaan yang merekrut lebih cerdas">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Pendaftaran Berhasil!</h2>
          <p className="text-slate-600 mb-6">
            Kami telah mengirim email verifikasi ke<br />
            <span className="font-bold text-slate-900 block mt-1">{registeredEmail}</span>
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8 text-left">
            <p className="text-sm text-brand-orange font-bold mb-3 uppercase tracking-wider">Langkah Selanjutnya:</p>
            <ol className="text-sm text-slate-700 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-xs font-bold">1</span>
                Buka email dari HireGood.one
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-xs font-bold">2</span>
                Klik link verifikasi
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-xs font-bold">3</span>
                Login ke akun Anda
              </li>
            </ol>
          </div>

          <Button onClick={onSwitchToLogin}>
            Ke Halaman Login <ArrowRight size={18} />
          </Button>

          <p className="text-xs text-slate-400 mt-4">
            Tidak menerima email? Periksa folder spam
          </p>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Buat Akun Baru" subtitle="Bergabunglah dengan ribuan perusahaan yang merekrut lebih cerdas">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6"
      >
        <button
          onClick={onSwitchToLogin}
          className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2 md:hidden"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Kembali ke Login
        </button>

        <GoogleSignInButton
          onClick={handleGoogleSignUp}
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

        <form onSubmit={handleSignUp} className="space-y-5">
          <Input
            label="Nama Perusahaan"
            value={formData.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            icon={<Building2 size={18} />}
            required
          />

          <Input
            label="Nama Lengkap"
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            icon={<User size={18} />}
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            icon={<Mail size={18} />}
            required
          />

          <div className="space-y-2">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              icon={<Lock size={18} />}
              rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              onRightIconClick={() => setShowPassword(!showPassword)}
              required
            />
            {/* Validasi visual password */}
            {formData.password && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex-1 flex gap-1 h-1">
                  <div className={`flex-1 rounded-full transition-colors ${formData.password.length > 0 ? getPasswordStrengthColor() : 'bg-slate-100'}`} />
                  <div className={`flex-1 rounded-full transition-colors ${passwordStrength && passwordStrength !== 'weak' ? getPasswordStrengthColor() : 'bg-slate-100'}`} />
                  <div className={`flex-1 rounded-full transition-colors ${passwordStrength === 'strong' ? getPasswordStrengthColor() : 'bg-slate-100'}`} />
                </div>
                <span className={`text-[10px] uppercase font-bold ${passwordStrength === 'weak' ? 'text-red-500' :
                  passwordStrength === 'medium' ? 'text-yellow-500' :
                    'text-green-500'
                  }`}>
                  {getPasswordStrengthText()}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-red-50/50 border border-red-100 rounded-xl animate-fade-in-up">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600 font-medium">{error}</span>
              </div>

              {/* Show login button if email already exists */}
              {error.includes('Email') && error.includes('sudah terdaftar') && (
                <Button
                  type="button"
                  onClick={onSwitchToLogin}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft size={18} /> Ke Halaman Login
                </Button>
              )}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="mt-4">
            Daftar Sekarang <ArrowRight size={18} />
          </Button>

          <div className="text-center pt-2">
            <span className="text-sm text-slate-500">Sudah punya akun? </span>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-sm font-bold text-brand-orange hover:text-orange-700 transition-colors"
            >
              Masuk disini
            </button>
          </div>
        </form>
      </motion.div>
    </AuthLayout>
  );
};

export default SignUpPage;