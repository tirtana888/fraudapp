
import React from 'react';
import { Check, X, Shield, Zap, Crown } from 'lucide-react';

interface PricingViewProps {
  currentTier: string;
}

const PricingView: React.FC<PricingViewProps> = ({ currentTier }) => {
  const tiers = [
    {
      name: 'Basic',
      price: 'Rp 499rb',
      period: '/bulan',
      description: 'Untuk UMKM memulai deteksi dini.',
      features: [
        'Fraud Triangle Assessment (12 Qs)',
        'Basic Interview Mode',
        'PDF Report Standard',
        '1 User Account',
        'Email Support'
      ],
      notIncluded: ['SJT Psychometric Test', 'Euphemism Detection AI', 'Benchmarking'],
      color: 'bg-gray-100 text-gray-800',
      btnColor: 'bg-gray-800',
      icon: Shield
    },
    {
      name: 'Premium',
      price: 'Rp 1.499rb',
      period: '/bulan',
      description: 'Untuk perusahaan berkembang dengan rekrutmen aktif.',
      features: [
        'Semua fitur Basic',
        'SJT (Situational Judgment Test)',
        'Financial Strain Scale',
        'Unlimited Candidate Links',
        '5 User Accounts',
        'Priority Support'
      ],
      notIncluded: ['Custom Branding (White-label)', 'API Access', 'Dedicate Success Manager'],
      color: 'bg-brand-blue text-white',
      btnColor: 'bg-white text-brand-blue',
      popular: true,
      icon: Zap
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Solusi end-to-end untuk korporasi besar.',
      features: [
        'Semua fitur Premium',
        'AI Euphemism Detection',
        'Industry Benchmarking',
        'White-label (Custom Logo/Domain)',
        'API Integration',
        'Unlimited Users',
        'Audit Logs Lengkap'
      ],
      notIncluded: [],
      color: 'bg-brand-orange text-white',
      btnColor: 'bg-white text-brand-orange',
      icon: Crown
    }
  ];

  return (
    <div className="max-w-6xl mx-auto py-10 animate-in fade-in pb-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">Pilih Paket Perlindungan Anda</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Investasi kecil untuk mencegah kerugian besar akibat fraud internal. Upgrade kapan saja sesuai pertumbuhan tim Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((tier) => (
          <div key={tier.name} className={`relative rounded-3xl p-8 shadow-xl border flex flex-col ${tier.popular ? 'border-brand-blue ring-4 ring-brand-blue/20 transform md:-translate-y-4' : 'bg-white dark:bg-brand-slate-850 border-gray-200 dark:border-slate-700'}`}>
            {tier.popular && (
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-brand-blue text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-md">
                Paling Populer
              </div>
            )}
            
            <div className="mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tier.name === 'Enterprise' ? 'bg-orange-100 text-brand-orange' : tier.name === 'Premium' ? 'bg-blue-100 text-brand-blue' : 'bg-gray-100 text-gray-600'}`}>
                    <tier.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{tier.description}</p>
            </div>

            <div className="mb-8">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{tier.price}</span>
                <span className="text-gray-500 font-medium">{tier.period}</span>
            </div>

            <div className="flex-1 space-y-4 mb-8">
                {tier.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <Check className="text-green-500 shrink-0" size={18} />
                        <span>{feat}</span>
                    </div>
                ))}
                {tier.notIncluded.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-gray-400 dark:text-gray-600 line-through">
                        <X className="shrink-0" size={18} />
                        <span>{feat}</span>
                    </div>
                ))}
            </div>

            <button 
                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg hover:opacity-90 ${tier.name === currentTier ? 'bg-green-100 text-green-700 cursor-default' : tier.name === 'Premium' ? 'bg-brand-blue text-white' : tier.name === 'Enterprise' ? 'bg-brand-orange text-white' : 'bg-gray-800 text-white'}`}
            >
                {tier.name === currentTier ? 'Paket Saat Ini' : 'Pilih Paket'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingView;
