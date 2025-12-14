// Email templates module with HireGood.one branding
const EMAIL_SENDERS = {
    business: "no-reply@hiregood.one",
    interview: "interview@hiregood.one"
};

const BRAND_COLORS = {
    primary: '#CC5500', // Brand Orange
    secondary: '#1e293b', // Brand Dark
    background: '#f8fafc',
    white: '#ffffff',
    text: '#334155',
    textLight: '#64748b'
};

/**
 * Wraps content in a responsive, branded HTML email layout
 * @param {string} title - The email title used in the header or subject context
 * @param {string} content - The HTML content of the email body
 * @returns {string} - The complete HTML email string
 */
const createEmailLayout = (title, content) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0; padding: 0; width: 100% !important; font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.background};">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND_COLORS.background}; padding: 20px 0;">
        <tr>
            <td align="center">
                <!-- Wrapper -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${BRAND_COLORS.white}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" style="background-color: ${BRAND_COLORS.secondary}; padding: 30px 20px;">
                           <h1 style="color: ${BRAND_COLORS.white}; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                               HireGood<span style="color: ${BRAND_COLORS.primary};">.one</span>
                           </h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.textLight}; font-weight: 500;">
                                Powered by <strong style="color: ${BRAND_COLORS.primary};">HireGood.one</strong>
                            </p>
                            <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">
                                &copy; ${new Date().getFullYear()} HireGood.one. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};

/**
 * Helper to create a call-to-action button
 */
const createButton = (text, url) => {
    return `
    <table border="0" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
        <tr>
            <td align="center" bgcolor="${BRAND_COLORS.primary}" style="border-radius: 6px;">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: inherit; font-size: 16px; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 6px; background-color: ${BRAND_COLORS.primary};">
                    ${text}
                </a>
            </td>
        </tr>
    </table>
    `;
};

module.exports = {
    businessInvitation: (companyName, adminEmail, tier, password) => {
        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.secondary}; font-size: 22px;">Selamat Datang, ${companyName}!</h2>
            <p>Akun bisnis Anda telah berhasil dibuat. Berikut adalah detail login Anda:</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Tier Paket</td>
                        <td style="padding: 5px 0; font-weight: 600; color: ${BRAND_COLORS.secondary};">${tier}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Email Admin</td>
                        <td style="padding: 5px 0; font-weight: 600; color: ${BRAND_COLORS.secondary};">${adminEmail}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #64748b; font-size: 14px;">Password Sementara</td>
                        <td style="padding: 5px 0; font-weight: 600; color: ${BRAND_COLORS.secondary}; font-family: monospace; font-size: 16px;">${password}</td>
                    </tr>
                </table>
            </div>

            <p>Silakan login dan segera ubah password Anda untuk keamanan.</p>
            
            ${createButton('Login ke Dashboard', 'https://hiregood.one/login')}
        `;
        return {
            from: EMAIL_SENDERS.business,
            subject: `Undangan Bergabung - ${companyName}`,
            html: createEmailLayout(`Welcome to Hiregood.one`, content)
        };
    },

    candidateInvitation: (candidateName, candidateEmail, companyName, accessCode, assessmentLink, role = "") => {
        const roleText = role ? ` untuk posisi <strong>${role}</strong>` : '';
        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.secondary}; font-size: 22px;">Halo, ${candidateName}!</h2>
            <p>Anda diundang oleh <strong>${companyName}</strong> untuk mengikuti assessment online${roleText}.</p>
            
            <p style="margin-bottom: 5px;">Kode Akses Anda:</p>
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; font-size: 24px; letter-spacing: 2px; font-weight: 700; color: ${BRAND_COLORS.primary}; margin-bottom: 20px; border: 1px dashed ${BRAND_COLORS.primary};">
                ${accessCode}
            </div>

            <p>Silakan klik tombol di bawah ini untuk memulai assessment Anda.</p>
            
            ${createButton('Mulai Assessment', assessmentLink)}

            <p style="font-size: 13px; color: #94a3b8;">Link ini akan kadaluarsa dalam waktu yang ditentukan oleh perusahaan. Mohon kerjakan secepatnya.</p>
        `;
        return {
            from: EMAIL_SENDERS.interview,
            subject: `Undangan Assessment - ${companyName}`,
            html: createEmailLayout(`Assessment Invitation`, content)
        };
    },

    interviewInvitation: (candidateName, candidateEmail, companyName, role, interviewDate, interviewTime, interviewLocation, interviewType = "online") => {
        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.secondary}; font-size: 22px;">Undangan Wawancara</h2>
            <p>Halo <strong>${candidateName}</strong>,</p>
            <p>Selamat! <strong>${companyName}</strong> mengundang Anda untuk tahap wawancara posisi <strong>${role}</strong>.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid ${BRAND_COLORS.primary}; padding: 20px; margin: 25px 0;">
                <p style="margin: 5px 0;"><strong>📅 Tanggal:</strong> ${interviewDate}</p>
                <p style="margin: 5px 0;"><strong>⏰ Waktu:</strong> ${interviewTime}</p>
                <p style="margin: 5px 0;"><strong>📍 Lokasi/Link:</strong> ${interviewLocation}</p>
                <p style="margin: 5px 0;"><strong>💻 Tipe:</strong> ${interviewType}</p>
            </div>

            <p>Mohon konfirmasi atau hadir tepat waktu. Semoga sukses!</p>
        `;
        return {
            from: EMAIL_SENDERS.interview,
            subject: `Undangan Wawancara - ${companyName}`,
            html: createEmailLayout(`Interview Invitation`, content)
        };
    },

    backgroundCheckInvitation: (candidateName, candidateEmail, companyName, verificationLink, role = "") => {
        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.secondary}; font-size: 22px;">Permintaan Verifikasi Data</h2>
            <p>Halo <strong>${candidateName}</strong>,</p>
            <p>Sebagai bagian dari proses rekrutmen di <strong>${companyName}</strong>, kami memerlukan verifikasi data (background check) Anda.</p>
            
            <p>Proses ini aman, rahasia, dan hanya membutuhkan waktu beberapa menit. Silakan lengkapi data yang diminta melalui tombol di bawah ini.</p>
            
            ${createButton('Mulai Verifikasi', verificationLink)}
            
            <p style="font-size: 13px; color: #94a3b8;">Pastikan Anda mempersiapkan dokumen identitas yang diperlukan.</p>
        `;
        return {
            from: EMAIL_SENDERS.interview,
            subject: `Background Check - ${companyName}`,
            html: createEmailLayout(`Background Check Request`, content)
        };
    },

    rejectionEmail: (candidateName, companyName, role = "", customMessage = "") => {
        const defaultMsg = "Terima kasih telah meluangkan waktu untuk mengikuti proses seleksi kami. Meskipun kualifikasi Anda mengesankan, kami memutuskan untuk melanjut ke kandidat lain yang lebih sesuai dengan kebutuhan kami saat ini.";
        const msg = customMessage || defaultMsg;

        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.secondary}; font-size: 22px;">Update Aplikasi Anda</h2>
            <p>Halo <strong>${candidateName}</strong>,</p>
            <p>Terima kasih atas minat Anda untuk posisi <strong>${role}</strong> di <strong>${companyName}</strong>.</p>
            
            <p style="line-height: 1.6;">${msg}</p>
            
            <p>Kami mendoakan yang terbaik untuk karir Anda kedepannya.</p>
        `;
        return {
            from: EMAIL_SENDERS.interview,
            subject: `Update Aplikasi - ${companyName}`,
            html: createEmailLayout(`Application Update`, content)
        };
    },

    hireEmail: (candidateName, companyName, role = "", startDate = "", startTime = "", contactPerson = "", contactPhone = "", additionalInfo = "") => {
        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.primary}; font-size: 24px;">Selamat Bergabung! 🎉</h2>
            <p>Halo <strong>${candidateName}</strong>,</p>
            <p>Kami sangat senang memberitahukan bahwa Anda <strong>DITERIMA</strong> untuk posisi <strong>${role}</strong> di <strong>${companyName}</strong>!</p>
            
            <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; color: #065f46; font-weight: 600; margin-bottom: 10px;">Detail Mulai Kerja:</p>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 3px 0; color: #047857;"><strong>Tanggal:</strong></td>
                        <td style="padding: 3px 0; color: #065f46;">${startDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 0; color: #047857;"><strong>Waktu:</strong></td>
                        <td style="padding: 3px 0; color: #065f46;">${startTime}</td>
                    </tr>
                    <tr>
                        <td style="padding: 3px 0; color: #047857;"><strong>Kontak:</strong></td>
                        <td style="padding: 3px 0; color: #065f46;">${contactPerson} (${contactPhone})</td>
                    </tr>
                </table>
            </div>

            ${additionalInfo ? `<p><strong>Info Tambahan:</strong><br>${additionalInfo}</p>` : ''}
            
            <p>Kami tidak sabar untuk bekerja sama dengan Anda!</p>
        `;
        return {
            from: EMAIL_SENDERS.interview,
            subject: `Selamat! Anda Diterima di ${companyName}`,
            html: createEmailLayout(`Welcome Aboard!`, content)
        };
    },

    candidateWelcomeEmail: (candidateName, candidateEmail, companyName, role = "", workflowSteps = [], currentStep = "") => {
        const roleText = role ? ` untuk posisi <strong>${role}</strong>` : '';

        // Build workflow steps HTML
        let stepsHTML = '';
        if (workflowSteps.length > 0) {
            stepsHTML = workflowSteps.map((step, index) => {
                const isCurrent = step.id === currentStep || (index === 0 && !currentStep);
                const stepNumber = index + 1;

                // Icon mapping
                const iconMap = {
                    'integrity_assessment': '🛡️',
                    'skill_interview': '🧠',
                    'live_proctoring': '📹',
                    'face_to_face_interview': '👥',
                    'background_check': '🔍',
                    'document_forgery': '📄',
                    'social_media_screening': '📱',
                    'hire_decision': '✅',
                    'reject_decision': '❌'
                };

                const icon = iconMap[step.id] || '📋';
                // Modern clean card design
                const bgColor = '#FFFFFF';
                const borderColor = '#E5E7EB';
                const numberBg = '#F3F4F6';
                const numberColor = '#6B7280';
                const titleColor = '#111827';
                const descColor = '#6B7280';

                return `
                <tr>
                    <td style="padding: 0 0 16px 0;">
                        <div style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td width="56" style="vertical-align: top; padding-right: 16px;">
                                        <div style="width: 48px; height: 48px; background-color: ${numberBg}; border-radius: 50%; text-align: center; line-height: 48px;">
                                            <span style="font-size: 18px; font-weight: 600; color: ${numberColor};">${stepNumber}</span>
                                        </div>
                                    </td>
                                    <td style="vertical-align: top;">
                                        <div style="font-size: 16px; font-weight: 600; color: ${titleColor}; margin-bottom: 6px; line-height: 1.4;">
                                            ${icon} ${step.name}
                                        </div>
                                        <div style="font-size: 14px; color: ${descColor}; line-height: 1.6;">
                                            ${step.description}
                                        </div>

                                    </td>
                                </tr>
                            </table>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            // Default workflow if no custom workflow
            stepsHTML = `
                <tr>
                    <td style="padding: 20px; text-align: center; color: #64748b; font-size: 14px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                        Workflow akan dikomunikasikan oleh tim HR
                    </td>
                </tr>
            `;
        }

        const content = `
            <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 26px; font-weight: 700; line-height: 1.3;">Selamat Datang, ${candidateName}! 🎉</h2>
            <p style="font-size: 15px; line-height: 1.7; color: #4B5563; margin: 0 0 12px 0;">Terima kasih telah melamar${roleText} di <strong style="color: #111827;">${companyName}</strong>.</p>
            
            <p style="font-size: 15px; line-height: 1.7; color: #4B5563; margin: 0 0 30px 0;">Kami sangat senang dengan minat Anda untuk bergabung dengan tim kami. Aplikasi Anda telah kami terima dan akan segera diproses.</p>

            ${workflowSteps.length > 0 ? `
            <div style="background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%); border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 24px; margin-right: 8px;">📋</span>
                    <h3 style="color: white; margin: 0; font-size: 18px; font-weight: 700;">Proses Rekrutmen</h3>
                </div>
                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 14px; line-height: 1.6;">
                    Berikut adalah tahapan yang akan Anda lalui dalam proses seleksi kami:
                </p>
            </div>

            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px 0;">
                ${stepsHTML}
            </table>

            <div style="background-color: #ECFDF5; border-left: 4px solid #10B981; padding: 18px; margin: 0 0 16px 0; border-radius: 8px;">
                <p style="margin: 0; color: #065F46; font-size: 14px; line-height: 1.7;">
                    <strong style="font-weight: 600;">💡 Tips:</strong> Pastikan Anda memeriksa email secara berkala untuk update terkait proses rekrutmen Anda. Jika ada pertanyaan, jangan ragu untuk menghubungi kami.
                </p>
            </div>
            
            <div style="background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 18px; margin: 0 0 30px 0; border-radius: 8px;">
                <p style="margin: 0; color: #1E40AF; font-size: 14px; line-height: 1.7;">
                    <strong style="font-weight: 600;">📧 Assessment Link:</strong> Anda akan menerima email berisi link assessment dalam waktu maksimal <strong>5 menit</strong> setelah email ini. Mohon periksa inbox dan folder spam Anda.
                </p>
            </div>
            ` : `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                    Tim HR kami akan segera menghubungi Anda untuk informasi lebih lanjut mengenai tahapan seleksi.
                </p>
            </div>
            
            <div style="background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 18px; margin: 0 0 30px 0; border-radius: 8px;">
                <p style="margin: 0; color: #1E40AF; font-size: 14px; line-height: 1.7;">
                    <strong style="font-weight: 600;">📧 Assessment Link:</strong> Anda akan menerima email berisi link assessment dalam waktu maksimal <strong>5 menit</strong> setelah email ini. Mohon periksa inbox dan folder spam Anda.
                </p>
            </div>
            `}

            <p style="font-size: 16px; line-height: 1.6; margin-top: 30px;">
                Kami berharap dapat segera bertemu dengan Anda dalam proses seleksi ini!
            </p>

            <p style="font-size: 16px; line-height: 1.6;">
                Salam hangat,<br>
                <strong>${companyName}</strong>
            </p>
        `;

        return {
            from: EMAIL_SENDERS.interview,
            subject: `Selamat Datang di ${companyName} - Aplikasi Anda Diterima`,
            html: createEmailLayout(`Welcome to ${companyName}`, content)
        };
    },

    dailyDigest: (companyName, adminEmail, date, newCandidates = [], completedAssessments = [], dashboardUrl = 'https://hiregood.one/candidates') => {
        const totalNew = newCandidates.length;
        const totalCompleted = completedAssessments.length;

        // Format date in Indonesian
        const formattedDate = new Date(date).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Build candidates list HTML
        let candidatesHTML = '';
        if (totalNew > 0) {
            candidatesHTML = newCandidates.slice(0, 10).map(candidate => `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                        <strong style="color: ${BRAND_COLORS.secondary};">${candidate.name}</strong>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${candidate.jobTitle || 'Position not specified'}</div>
                    </td>
                </tr>
            `).join('');
        } else {
            candidatesHTML = `
                <tr>
                    <td style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">
                        Tidak ada kandidat baru hari ini
                    </td>
                </tr>
            `;
        }

        // Build assessments list HTML
        let assessmentsHTML = '';
        if (totalCompleted > 0) {
            assessmentsHTML = completedAssessments.slice(0, 10).map(assessment => {
                const riskEmoji = {
                    'Low': '🟢',
                    'Medium': '🟡',
                    'High': '🟠',
                    'Critical': '🔴'
                }[assessment.riskLevel] || '⚪';

                const riskColor = {
                    'Low': '#10b981',
                    'Medium': '#f59e0b',
                    'High': '#f97316',
                    'Critical': '#ef4444'
                }[assessment.riskLevel] || '#94a3b8';

                return `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: ${BRAND_COLORS.secondary};">${assessment.name}</strong>
                                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${assessment.jobTitle || 'Position not specified'}</div>
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 20px;">${riskEmoji}</span>
                                <div style="font-size: 12px; color: ${riskColor}; font-weight: 600; margin-top: 2px;">${assessment.riskLevel} Risk</div>
                            </div>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        } else {
            assessmentsHTML = `
                <tr>
                    <td style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">
                        Tidak ada assessment yang diselesaikan hari ini
                    </td>
                </tr>
            `;
        }

        const content = `
            <h2 style="margin-top: 0; color: ${BRAND_COLORS.secondary}; font-size: 22px;">Selamat Pagi! ☀️</h2>
            <p>Berikut adalah ringkasan aktivitas rekrutmen Anda untuk <strong>${formattedDate}</strong>:</p>
            
            <!-- Summary Stats -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0;">
                <tr>
                    <td width="48%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; text-align: center;">
                        <div style="font-size: 36px; font-weight: 700; color: white; margin-bottom: 5px;">${totalNew}</div>
                        <div style="font-size: 14px; color: rgba(255,255,255,0.9);">Kandidat Baru</div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; padding: 20px; text-align: center;">
                        <div style="font-size: 36px; font-weight: 700; color: white; margin-bottom: 5px;">${totalCompleted}</div>
                        <div style="font-size: 14px; color: rgba(255,255,255,0.9);">Assessment Selesai</div>
                    </td>
                </tr>
            </table>

            ${totalNew > 0 ? `
            <!-- New Candidates Section -->
            <div style="margin: 30px 0;">
                <h3 style="color: ${BRAND_COLORS.secondary}; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid ${BRAND_COLORS.primary}; padding-bottom: 8px;">
                    👤 Kandidat Baru
                </h3>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
                    ${candidatesHTML}
                </table>
                ${totalNew > 10 ? `<p style="font-size: 13px; color: #64748b; margin-top: 10px;">Dan ${totalNew - 10} kandidat lainnya...</p>` : ''}
            </div>
            ` : ''}

            ${totalCompleted > 0 ? `
            <!-- Completed Assessments Section -->
            <div style="margin: 30px 0;">
                <h3 style="color: ${BRAND_COLORS.secondary}; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid ${BRAND_COLORS.primary}; padding-bottom: 8px;">
                    ✅ Assessment Selesai
                </h3>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
                    ${assessmentsHTML}
                </table>
                ${totalCompleted > 10 ? `<p style="font-size: 13px; color: #64748b; margin-top: 10px;">Dan ${totalCompleted - 10} assessment lainnya...</p>` : ''}
            </div>
            ` : ''}

            ${totalNew === 0 && totalCompleted === 0 ? `
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 30px; text-align: center; margin: 25px 0;">
                <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                <p style="color: #64748b; margin: 0;">Tidak ada aktivitas baru hari ini</p>
            </div>
            ` : ''}

            ${createButton('Lihat Dashboard Lengkap', dashboardUrl)}

            <p style="font-size: 13px; color: #94a3b8; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                Anda menerima email ini karena Anda mengaktifkan Daily Digest di pengaturan notifikasi. 
                <a href="https://hiregood.one/settings" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">Kelola preferensi</a>
            </p>
        `;

        return {
            from: EMAIL_SENDERS.business,
            subject: `📊 Daily Digest - ${companyName} (${formattedDate})`,
            html: createEmailLayout(`Daily Digest - ${companyName}`, content)
        };
    }
};
