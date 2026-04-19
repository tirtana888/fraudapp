import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Calendar, Clock, MapPin, Globe } from 'lucide-react';
import { supabase, COLLECTIONS } from '../services/supabase';

interface InterviewConfirmationPageProps { }

const InterviewConfirmationPage: React.FC<InterviewConfirmationPageProps> = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
    const [message, setMessage] = useState('');
    const [interviewDetails, setInterviewDetails] = useState<any>(null);

    useEffect(() => {
        const confirmInterview = async () => {
            try {
                // Parse URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const sessionId = urlParams.get('session');
                const email = urlParams.get('email');
                const confirmStatus = urlParams.get('status');

                // Validate parameters
                if (!sessionId || !email || confirmStatus !== 'confirmed') {
                    setStatus('invalid');
                    setMessage('Link konfirmasi tidak valid. Silakan hubungi HR untuk bantuan.');
                    return;
                }

                const { data: sessionData, error: sessionErr } = await supabase
                    .from(COLLECTIONS.SESSIONS)
                    .select('*')
                    .eq('id', sessionId)
                    .single();

                if (sessionErr || !sessionData) {
                    setStatus('invalid');
                    setMessage('Sesi wawancara tidak ditemukan. Link mungkin sudah tidak valid.');
                    return;
                }

                // SECURITY: Validate email matches candidate email
                if (sessionData.candidate?.email?.toLowerCase() !== email.toLowerCase()) {
                    setStatus('error');
                    setMessage('Email tidak sesuai dengan data kandidat. Anda tidak dapat mengkonfirmasi wawancara ini.');
                    console.error('[SECURITY] Email mismatch:', {
                        provided: email,
                        expected: sessionData.candidate?.email
                    });
                    return;
                }

                // Check if interview schedule exists
                if (!sessionData.interviewSchedule) {
                    setStatus('invalid');
                    setMessage('Jadwal wawancara tidak ditemukan untuk sesi ini.');
                    return;
                }

                // Check if already confirmed
                if (sessionData.interviewSchedule.confirmationStatus === 'confirmed') {
                    setStatus('success');
                    setMessage('Wawancara Anda sudah dikonfirmasi sebelumnya.');
                    setInterviewDetails(sessionData);
                    return;
                }

                const updatedSchedule = {
                    ...sessionData.interviewSchedule,
                    confirmationStatus: 'confirmed',
                    confirmedAt: new Date().toISOString(),
                    confirmationMethod: 'email_link',
                };
                await supabase.from(COLLECTIONS.SESSIONS).update({
                    interviewSchedule: updatedSchedule,
                    updatedAt: new Date().toISOString()
                }).eq('id', sessionId);

                // Success
                setStatus('success');
                setMessage('Terima kasih! Kehadiran Anda telah dikonfirmasi.');
                setInterviewDetails(sessionData);

                console.log('[CONFIRMATION] Interview confirmed:', {
                    sessionId,
                    candidateName: sessionData.candidate?.name,
                    email: sessionData.candidate?.email
                });

            } catch (error) {
                console.error('[CONFIRMATION] Error:', error);
                setStatus('error');
                setMessage('Terjadi kesalahan saat mengkonfirmasi. Silakan coba lagi atau hubungi HR.');
            }
        };

        confirmInterview();
    }, []);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Main Card */}
                <div className="bg-white dark:bg-brand-slate-850 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    {/* Status Content */}
                    <div className="p-10 text-center">
                        {status === 'loading' && (
                            <>
                                <Loader2 size={72} className="text-brand-orange mx-auto mb-6 animate-spin" />
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    Memproses Konfirmasi...
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Mohon tunggu sebentar
                                </p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 size={48} className="text-green-600 dark:text-green-400" />
                                    </div>
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                                    Terima Kasih!
                                </h2>
                                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                                    Kehadiran Anda telah dikonfirmasi
                                </p>

                                {/* Interview Details - Simplified */}
                                {interviewDetails && interviewDetails.interviewSchedule && (
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
                                                <Calendar size={18} className="text-brand-orange" />
                                                <span className="font-semibold">{formatDate(interviewDetails.interviewSchedule.date)}</span>
                                            </div>
                                            <div className="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
                                                <Clock size={18} className="text-brand-orange" />
                                                <span className="font-semibold">{interviewDetails.interviewSchedule.time} WIB</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    Kami menantikan kehadiran Anda! 🤝
                                </p>
                            </>
                        )}

                        {(status === 'error' || status === 'invalid') && (
                            <>
                                <div className="mb-6">
                                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <XCircle size={48} className="text-red-600 dark:text-red-400" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    {status === 'error' ? 'Konfirmasi Gagal' : 'Link Tidak Valid'}
                                </h2>
                                <p className="text-gray-700 dark:text-gray-300 mb-6">
                                    {message}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Silakan hubungi tim HR untuk bantuan
                                </p>
                            </>
                        )}
                    </div>

                    {/* Simple Footer */}
                    <div className="bg-gray-50 dark:bg-slate-800 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                            Powered by <strong className="text-brand-orange">HireGood.one</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterviewConfirmationPage;
