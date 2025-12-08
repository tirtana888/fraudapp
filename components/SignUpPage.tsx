import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Building2, User, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';
import { signUpWithFirebase } from '../services/firebase';

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
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!formData.phone.trim()) return 'Nomor telepon harus diisi';
    if (formData.password.length < 8) return 'Password minimal 8 karakter';
    if (formData.password !== formData.confirmPassword) return 'Password tidak cocok';
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

    try {
      const user = await signUpWithFirebase({
        companyName: formData.companyName.trim(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password
      });

      if (user) {
        // Show verification message instead of auto-login
        setRegisteredEmail(formData.email);
        setShowVerificationMessage(true);
      }
    } catch (err: any) {
      setError(err.message || "Gagal mendaftar. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pendaftaran Berhasil!</h2>
            <p className="text-sm text-gray-600 mb-6">
              Kami telah mengirim email verifikasi ke<br />
              <span className="font-medium text-gray-900">{registeredEmail}</span>
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-orange-900 font-medium mb-2">Langkah Selanjutnya:</p>
              <ol className="text-xs text-orange-800 text-left space-y-1">
                <li>1. Buka email dari HireGood.one</li>
                <li>2. Klik link verifikasi</li>
                <li>3. Login ke akun Anda</li>
              </ol>
            </div>
            <button
              onClick={onSwitchToLogin}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium py-2.5 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all"
            >
              Ke Halaman Login
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Tidak menerima email? Periksa folder spam
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">HireGood</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Buat Akun</h1>
            <p className="text-sm text-gray-500">Daftar untuk memulai rekrutmen</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Perusahaan</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="PT. Nama Perusahaan"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="nama@perusahaan.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor Telepon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+62 812-3456-7890"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Minimal 8 karakter"
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
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    <div className={`h-1 flex-1 rounded-full ${formData.password.length > 0 ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                    <div className={`h-1 flex-1 rounded-full ${passwordStrength && passwordStrength !== 'weak' ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                    <div className={`h-1 flex-1 rounded-full ${passwordStrength === 'strong' ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                  </div>
                  <p className={`text-xs mt-1 font-medium ${
                    passwordStrength === 'weak' ? 'text-red-600' :
                    passwordStrength === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {getPasswordStrengthText()}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Ketik ulang password"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="mt-2 flex items-center gap-2">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <CheckCircle2 size={14} className="text-green-600" />
                      <p className="text-xs text-green-600 font-medium">Password cocok</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-red-600" />
                      <p className="text-xs text-red-600 font-medium">Password tidak cocok</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium py-2.5 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Mendaftar...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">Daftar</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Switch to Login */}
            <div className="text-center mt-4">
              <span className="text-sm text-gray-600">Sudah punya akun? </span>
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                Login
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">© 2024 HireGood.one</p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;