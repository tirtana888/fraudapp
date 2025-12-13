import React from 'react';
import { Lock, Crown, FileText, Sparkles } from 'lucide-react';

interface CVPremiumGateProps {
    onUpgrade: () => void;
    documentType?: 'cv' | 'certificate' | 'portfolio';
}

const CVPremiumGate: React.FC<CVPremiumGateProps> = ({ onUpgrade, documentType = 'cv' }) => {
    const getDocTitle = () => {
        switch (documentType) {
            case 'certificate': return 'Sertifikat';
            case 'portfolio': return 'Portfolio';
            default: return 'CV Lengkap';
        }
    };

    return (
        <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Blurred Background Preview (Skeleton CV) */}
            <div className="absolute inset-0 p-6 filter blur-[6px] opacity-40 select-none pointer-events-none">
                {/* Simulated CV Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gray-300"></div>
                    <div className="space-y-2">
                        <div className="h-5 w-48 bg-gray-300 rounded"></div>
                        <div className="h-3 w-32 bg-gray-200 rounded"></div>
                    </div>
                </div>

                {/* Simulated Sections */}
                <div className="space-y-4">
                    <div className="h-4 w-24 bg-gray-400 rounded mb-2"></div>
                    <div className="h-3 w-full bg-gray-200 rounded"></div>
                    <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
                    <div className="h-3 w-4/5 bg-gray-200 rounded"></div>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="h-4 w-32 bg-gray-400 rounded mb-2"></div>
                    <div className="flex gap-4">
                        <div className="flex-1 h-20 bg-gray-200 rounded-lg"></div>
                        <div className="flex-1 h-20 bg-gray-200 rounded-lg"></div>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="h-4 w-28 bg-gray-400 rounded mb-2"></div>
                    <div className="space-y-2">
                        <div className="h-3 w-full bg-gray-200 rounded"></div>
                        <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>

            {/* Glass Overlay with Premium CTA */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md p-8">
                {/* Icon Badge */}
                <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-xl shadow-orange-500/30 transform rotate-3">
                        <FileText size={36} className="text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border border-gray-100">
                        <Lock size={14} className="text-orange-600" />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-extrabold text-gray-900 mb-2 text-center">
                    {getDocTitle()} Terkunci
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 text-center mb-6 max-w-xs leading-relaxed">
                    Akses dokumen lengkap kandidat hanya tersedia untuk pengguna <span className="font-bold text-orange-600">Premium</span>.
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                    <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                        📄 Lihat CV Lengkap
                    </span>
                    <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                        📊 Download PDF
                    </span>
                    <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                        🔍 AI Analysis
                    </span>
                </div>

                {/* CTA Button */}
                <button
                    onClick={onUpgrade}
                    className="group relative px-8 py-3 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-xl font-bold shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:scale-105 active:scale-100 transition-all duration-200 flex items-center gap-2"
                >
                    <Crown size={18} className="group-hover:rotate-12 transition-transform" />
                    <span>Upgrade ke Premium</span>
                    <Sparkles size={14} className="text-yellow-200 group-hover:animate-pulse" />
                </button>

                {/* Sub-text */}
                <p className="text-xs text-gray-400 mt-4">
                    Mulai dari <span className="font-bold text-gray-600">Rp 99.000/bulan</span>
                </p>
            </div>
        </div>
    );
};

export default CVPremiumGate;
