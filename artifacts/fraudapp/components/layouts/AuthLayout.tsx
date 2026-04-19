import React from 'react';
import { motion } from 'framer-motion';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    image?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, image }) => {
    return (
        <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 to-orange-50/30 dark:from-brand-slate-900 dark:to-slate-900">

            {/* BRAND SIDE (Left - Desktop) / (Hidden - Mobile) */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="hidden lg:flex w-1/2 relative overflow-hidden bg-brand-slate-900 justify-center items-center"
            >
                <div className="absolute inset-0 opacity-20 bg-[url('https://res.cloudinary.com/dpkc6ywq4/image/upload/v1710344440/pattern_bg_kyz8w2.png')] bg-repeat opacity-5" />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-slate-900 via-transparent to-transparent opacity-90" />

                <div className="relative z-10 max-w-lg px-12 text-center text-white">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl mx-auto mb-8 flex items-center justify-center border border-white/20 shadow-2xl"
                    >
                        <img src="/untitled_design_43.png" alt="Logo" className="w-14 h-14 object-contain" />
                    </motion.div>

                    <h1 className="text-4xl font-extrabold mb-6 leading-tight tracking-tight">
                        Rekrutmen Aman <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200">
                            Tanpa Batasan
                        </span>
                    </h1>
                    <p className="text-lg text-slate-300 font-light leading-relaxed">
                        Revolusikan proses perekrutan Anda dengan deteksi fraud berbasis AI dan penyaringan kandidat otomatis.
                    </p>

                    {/* Testimonial / Social Proof */}
                    <div className="mt-12 pt-8 border-t border-white/10">
                        <div className="flex items-center justify-center gap-4 opacity-80">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-brand-slate-900" />
                                ))}
                            </div>
                            <p className="text-sm font-medium">Dipercaya oleh 500+ Perusahaan</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* CONTENT SIDE (Right) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="w-full max-w-md space-y-8"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <img src="/untitled_design_43.png" alt="Logo" className="w-12 h-12 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">FraudGuard</h2>
                    </div>

                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            {title}
                        </h2>
                        <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                            {subtitle}
                        </p>
                    </div>

                    {children}

                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-gray-400">
                            Dilindungi oleh reCAPTCHA dan tunduk pada Kebijakan Privasi dan Ketentuan Layanan.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default AuthLayout;
