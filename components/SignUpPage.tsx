import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Building2,
  User,
  Phone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
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
    if (formData.password !== formData.confirmPassword) return 'Password dan konfirmasi password tidak cocok';
    if (passwordStrength === 'weak') return 'Password terlalu lemah. Gunakan kombinasi huruf besar, kecil, angka, dan simbol';
    
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
        onSignUpSuccess(user);
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

  return (
    <div className="min-h-screen flex bg-white font-sans">
      
      {/* LEFT SIDE: FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 md:px-20 xl:px-32 relative overflow-y-auto">
        <div className="absolute top-8 left-8 md:left-20 flex items-center gap-2">
          <div className="bg-brand-orange p-1.5 rounded-lg text-white">
            <ShieldAlert size={20} />
          </div>
          <span className="font-bold text-xl text-gray-800 tracking-tight">HireGood.one</span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">SECURE</span>
        </div>

        <div className="max-w-md w-full mx-auto py-16 animate-in fade-in slide-in-from-left-4 duration-500">
          
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Daftar Perusahaan</h1>
          <p className="text-gray-500 mb-8">Buat akun Enterprise SaaS untuk perusahaan Anda.</p>

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nama Perusahaan</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="text" 
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="PT. Nama Perusahaan"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="text" 
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email Perusahaan</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nomor Telepon</label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+62 812-3456-7890"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    <div className={`h-1.5 flex-1 rounded-full ${formData.password.length > 0 ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                    <div className={`h-1.5 flex-1 rounded-full ${passwordStrength && passwordStrength !== 'weak' ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                    <div className={`h-1.5 flex-1 rounded-full ${passwordStrength === 'strong' ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                  </div>
                  <p className={`text-xs font-semibold ${
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
              <label className="block text-sm font-bold text-gray-700 mb-2">Konfirmasi Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Ketik ulang kata sandi"
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all outline-none font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className="mt-2 flex items-center gap-2">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <CheckCircle2 size={16} className="text-green-600" />
                      <p className="text-xs text-green-600 font-semibold">Password cocok</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="text-red-600" />
                      <p className="text-xs text-red-600 font-semibold">Password tidak cocok</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-orange hover:bg-orange-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Mendaftar...</span>
                </>
              ) : (
                <>
                  <span>Daftar Sekarang</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {/* Switch to Login */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-bold text-brand-orange hover:underline"
                >
                  Login di sini
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT SIDE: BRANDING & BENEFITS */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-orange via-orange-600 to-orange-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
        
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="max-w-lg animate-in fade-in slide-in-from-right-4 duration-700">
            <ShieldCheck size={64} className="mb-6" />
            <h2 className="text-4xl font-extrabold mb-6 leading-tight">
              Bergabung dengan Platform Rekrutmen Terpercaya
            </h2>
            <p className="text-xl text-orange-100 mb-12 leading-relaxed">
              HireGood.one membantu perusahaan menemukan kandidat terbaik dengan sistem penilaian integritas berbasis AI.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm flex-shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Deteksi Fraud Otomatis</h3>
                  <p className="text-orange-100">AI-powered fraud detection untuk screening kandidat</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm flex-shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Background Check Terintegrasi</h3>
                  <p className="text-orange-100">Verifikasi identitas dengan Didit KYC</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm flex-shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">Workflow Customizable</h3>
                  <p className="text-orange-100">Sesuaikan proses rekrutmen dengan kebutuhan bisnis</p>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/20">
              <p className="text-sm text-orange-100">
                Dipercaya oleh <span className="font-bold text-white">500+ perusahaan</span> di Indonesia
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
