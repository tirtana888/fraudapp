// Email templates module
const EMAIL_SENDERS = {
    business: "no-reply@hiregood.one",
    interview: "interview@hiregood.one"
};

module.exports = {
    businessInvitation: (companyName, adminEmail, tier, password) => ({
        from: EMAIL_SENDERS.business,
        subject: `Undangan Bergabung - ${companyName}`,
        html: `<h2>Selamat Datang, ${companyName}!</h2><p>Tier: ${tier}</p><p>Email: ${adminEmail}</p><p>Password: ${password}</p>`
    }),

    candidateInvitation: (candidateName, candidateEmail, companyName, accessCode, assessmentLink, role = "") => ({
        from: EMAIL_SENDERS.interview,
        subject: `Undangan Assessment - ${companyName}`,
        html: `<h2>Halo, ${candidateName}!</h2><p>Kode Akses: ${accessCode}</p><a href="${assessmentLink}">Mulai Assessment</a>`
    }),

    interviewInvitation: (candidateName, candidateEmail, companyName, role, interviewDate, interviewTime, interviewLocation, interviewType = "online") => ({
        from: EMAIL_SENDERS.interview,
        subject: `Undangan Wawancara - ${companyName}`,
        html: `<h2>Selamat! ${candidateName}</h2><p>Tanggal: ${interviewDate}</p><p>Waktu: ${interviewTime}</p><p>Lokasi: ${interviewLocation}</p>`
    }),

    backgroundCheckInvitation: (candidateName, candidateEmail, companyName, verificationLink, role = "") => ({
        from: EMAIL_SENDERS.interview,
        subject: `Background Check - ${companyName}`,
        html: `<h2>Halo ${candidateName}</h2><a href="${verificationLink}">Mulai Verifikasi</a>`
    }),

    rejectionEmail: (candidateName, companyName, role = "", customMessage = "") => ({
        from: EMAIL_SENDERS.interview,
        subject: `Update Aplikasi - ${companyName}`,
        html: `<h2>Halo, ${candidateName}</h2><p>Terima kasih atas minat Anda untuk posisi ${role}.</p><p>${customMessage}</p>`
    }),

    hireEmail: (candidateName, companyName, role = "", startDate = "", startTime = "", contactPerson = "", contactPhone = "", additionalInfo = "") => ({
        from: EMAIL_SENDERS.interview,
        subject: `Selamat! Anda Diterima di ${companyName}`,
        html: `<h2>SELAMAT ${candidateName}!</h2><p>Posisi: ${role}</p><p>Mulai: ${startDate} ${startTime}</p><p>Contact: ${contactPerson} ${contactPhone}</p>`
    })
};
