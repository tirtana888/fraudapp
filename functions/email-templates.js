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
    }
};
