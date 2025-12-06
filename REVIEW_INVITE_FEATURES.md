# Review & Invite - Fitur Lengkap

## Fitur yang Sudah Ditambahkan

### 1. Dashboard Kandidat (Yang Sudah Complete Test)
- **Lokasi**: Bagian atas halaman Review & Invite
- **Menampilkan**: Kandidat yang sudah selesai integrity test (`status: 'COMPLETED'`)
- **Fitur**:
  - Table profesional dengan kolom: Kandidat (avatar + nama + email), Posisi, Stage, Risk Score, Action
  - Filter berdasarkan Stage (screening, review, interview, bc_check, hired, rejected)
  - Filter berdasarkan Risk Level (low, medium, high, critical)
  - Button "Lihat Detail" → membuka Candidate Profile Report lengkap (sama seperti di Otomatis)

### 2. Kandidat Pending Review (Belum Test)
- **Menampilkan**: Kandidat dengan `status: 'pending_review'` dari job application
- **Fitur Baru**:
  - **Button "Kirim Undangan Test"** (Orange) - Mengirim email invitation otomatis dengan:
    - Access code unik
    - Link assessment langsung
    - Company name dan job title
    - Loading spinner saat proses pengiriman
  - **Button "Tandai: Undang Test"** (Purple) - Manual update stage tanpa email
  - Preview CV inline (PDF viewer)
  - Info kontak lengkap
  - Timeline progress recruitment

### 3. Email System
**Function**: `sendIntegrityTestInvitation()`
- Generate access code unik (5 karakter alphanumeric)
- Kirim email via Firebase Cloud Function (Resend)
- Simpan invite data ke `assessment_invites` collection
- Auto-update recruitment stage ke `integrity_test`
- Add timeline entry dengan note "Undangan test integritas telah dikirim via email"

### 4. Stage Management
**Recruitment Flow**:
1. Application (Aplikasi Masuk)
2. Integrity Test (Test Integritas) ← Email invitation dikirim di sini
3. Interview Office
4. KYC Process
5. Approved / Rejected

**Stage Actions**:
- Application → Integrity Test: Button "Kirim Undangan Test" + Email
- Integrity Test → Interview Office: Manual button
- Interview Office → KYC: Manual button
- KYC → Approved: Manual button
- Any Stage → Rejected: Manual button

### 5. Candidate Detail Report
Saat klik "Lihat Detail" dari Dashboard, akan membuka CandidateDetail component yang sama seperti di Otomatis, menampilkan:
- Overview lengkap
- Documents & CV
- Integrity Analysis
- Interview Results
- Background Check
- Activity Timeline

## Query Database

### Pending Review Candidates
```javascript
where('companyId', '==', companyId)
where('source', '==', 'job_application')
where('status', '==', 'pending_review')
```

### Completed Candidates
```javascript
where('companyId', '==', companyId)
where('source', '==', 'job_application')
where('status', '==', 'COMPLETED')
```

## Cara Menggunakan

1. Buka tab "Review & Invite" di sidebar
2. **Dashboard Kandidat** (atas): Lihat kandidat yang sudah complete test, filter, dan klik "Lihat Detail"
3. **Kandidat Pending** (bawah): Review CV kandidat baru, klik "Kirim Undangan Test"
4. Email otomatis terkirim ke kandidat dengan access code dan link assessment
5. Setelah kandidat complete test, mereka muncul di Dashboard Kandidat
6. Track progress melalui stage dan timeline

## Troubleshooting

Jika tidak melihat perubahan:
1. **Hard refresh browser**: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
2. **Clear browser cache** dan reload
3. **Check console** untuk error logs
4. **Verifikasi data** kandidat di Firestore:
   - Apakah ada kandidat dengan status yang sesuai?
   - Apakah source = 'job_application'?
5. **Check email logs** di Firebase Functions untuk tracking email delivery

## Build Info
- Last build: Success
- All TypeScript compiled successfully
- Production build ready
- Files: dist/index.html, dist/assets/*
