# Background Check Modal - Panduan Lengkap

Popup konfirmasi untuk Background Check dengan informasi kredit KYC dan deadline 48 jam.

## ✅ Fitur yang Diimplementasikan

### 1. **Popup Modal Background Check**
Modal konfirmasi dengan design professional:
- Header gradient purple dengan icon Shield
- Judul "Background Check Verification"
- Subtitle "Pemeriksaan Latar Belakang via Didit"
- Animasi fade-in smooth

### 2. **Informasi Email**
Box biru dengan border kiri:
- Menampilkan email kandidat yang akan menerima link verifikasi
- Format: "Email verifikasi akan dikirim ke: [email]"
- Font mono untuk email (mudah dibaca)

### 3. **Detail Kandidat**
Card abu-abu dengan info:
- Icon User warna purple
- Grid 2 kolom menampilkan:
  - Nama kandidat
  - Posisi yang dilamar

### 4. **Informasi Kredit KYC**
Box purple dengan icon DollarSign:
- **Biaya**: 3 Kredit KYC per verifikasi
- **Kredit Tersisa**: ∞ (infinity)
- Note: "*Konfigurasi sistem kredit akan datang"
- Design: Card dalam card dengan border

### 5. **Info Box Kuning - Yang Akan Dilakukan**
Box kuning dengan icon Info berisi:
- List 4 aksi yang akan terjadi:
  1. Mengirim email verifikasi ke kandidat
  2. Kandidat melakukan verifikasi identitas via Didit
  3. Status berubah menjadi "Background Check"
  4. Menggunakan 3 Kredit KYC dari akun

- **Sub-box Deadline** (background kuning gelap):
  - Icon Clock
  - Judul: "Batas Waktu Verifikasi"
  - Text: "Kandidat memiliki waktu **maksimal 2 x 24 jam (48 jam)** untuk menyelesaikan proses verifikasi KYC sejak email dikirim"

### 6. **Verifikasi yang Akan Dilakukan**
Box hijau dengan border kiri:
- Icon CheckCircle2
- List 4 jenis verifikasi:
  1. Verifikasi Identitas (KTP/SIM/Paspor)
  2. Liveness Detection (Foto Selfie)
  3. Face Matching dengan Dokumen ID
  4. AML Screening & Watchlist Check

### 7. **Action Buttons**
Dua tombol di bottom:
- **Batal**: Border gray, hover bg-gray-50
- **Kirim Verifikasi**:
  - Gradient purple (from-purple-600 to-purple-700)
  - Icon Shield
  - Loading state dengan spinner saat kirim
  - Disabled saat proses berlangsung

## 📧 Email Template Update

Email Background Check sudah diupdate dengan:

### **Deadline Warning Box Merah**
- Background: #FEF2F2
- Border kiri: merah (#DC2626)
- Icon: ⏰
- Judul: "Batas Waktu Verifikasi"
- Pesan:
  > "Anda memiliki waktu **maksimal 48 jam** untuk menyelesaikan proses verifikasi KYC ini. Jika melewati batas waktu, link verifikasi akan expired dan Anda perlu menghubungi tim HR untuk link baru."

### **Info List Update**
Item terakhir di list informasi penting diupdate menjadi:
- Warna: merah (#DC2626)
- Text: "Selesaikan dalam **maksimal 2 x 24 jam (48 jam)** sejak email ini dikirim"
- Font weight: 600 (bold)

## 🎨 Visual Design

### Color Scheme:
- **Primary**: Purple gradient (600-700)
- **Accent**: DollarSign purple (#9333EA)
- **Info**: Blue (#3B82F6)
- **Warning**: Yellow (#F59E0B)
- **Success**: Green (#10B981)
- **Danger**: Red (#DC2626)

### Spacing & Layout:
- Modal max-width: 32rem (lg)
- Padding: 1.5rem (p-6)
- Gap between sections: 1.5rem (mb-6)
- Border radius: 1rem (rounded-2xl)

### Typography:
- Title: text-xl font-bold
- Subtitle: text-sm opacity-90
- Body: text-sm / text-xs
- Headers: font-semibold / font-bold

## 🔄 User Flow

1. HR klik button "Cek Latar" di detail kandidat
2. Sistem cek tier (Premium/Enterprise only)
3. Modal muncul dengan animasi fade-in
4. HR review informasi:
   - Email kandidat yang akan dihubungi
   - Detail kandidat
   - Biaya kredit (3 KYC)
   - Deadline 48 jam
   - Jenis verifikasi
5. HR klik "Kirim Verifikasi"
6. Loading state aktif (button disabled)
7. Firebase Functions `initiateBackgroundCheck` dipanggil
8. Didit session dibuat
9. Email terkirim ke kandidat dengan:
   - Link verifikasi Didit
   - Instruksi lengkap
   - Deadline 48 jam warning
10. Status kandidat update ke "Background Check"
11. Modal close otomatis
12. Toast success muncul
13. Data refresh

## 💾 Data yang Tersimpan

```javascript
{
  recruitmentStage: 'bc_check',
  backgroundCheck: {
    diditSessionId: 'xxx-xxx-xxx',
    status: 'pending',
    createdAt: '2024-12-06T10:00:00.000Z',
    verificationLink: 'https://verification.didit.me/xxx',
    deadlineAt: '2024-12-08T10:00:00.000Z' // createdAt + 48 hours
  },
  timeline: [
    // ... previous events
    {
      stage: 'bc_check',
      status: 'current',
      date: '2024-12-06T10:00:00.000Z',
      note: 'Background check dimulai untuk John Doe'
    }
  ]
}
```

## 🔒 Security & Validation

### Frontend:
- Tier check (Premium/Enterprise only)
- Button disabled saat loading
- Modal tidak bisa ditutup saat proses kirim
- Error handling dengan toast

### Backend (Firebase Functions):
- Session validation
- Didit API authentication
- Webhook signature verification
- RLS policies untuk data access

## ⚙️ Konfigurasi Kredit (Coming Soon)

Sistem kredit KYC akan dikonfigurasi dengan:
- Database schema untuk tracking kredit
- Deduct 3 kredit per background check
- Alert saat kredit rendah
- Top-up kredit flow
- History penggunaan kredit

## 📊 Tracking & Metrics

Data yang bisa dilacak:
- Total background check initiated
- Success rate verification
- Average completion time
- Kredit usage per company
- Deadline compliance rate

## 🚀 Deployment Requirements

**Frontend**: ✅ Build berhasil

**Backend**: ⚠️ Perlu deploy Firebase Functions

```bash
firebase deploy --only functions
```

### Functions yang Perlu Aktif:
1. `initiateBackgroundCheck` - Create Didit session & send email
2. `diditWebhook` - Handle verification status updates
3. `sendEmail` - Dengan template `backgroundCheckInvitation`

## 📱 Responsive Design

Modal sudah responsive:
- Desktop: max-width 32rem
- Tablet: Full width dengan padding
- Mobile: Scrollable jika content panjang

## 🎯 Benefits

### Untuk HR:
- Informasi jelas sebelum kirim
- Visual deadline warning yang jelas
- Tracking kredit usage
- Konfirmasi sebelum action

### Untuk Kandidat:
- Email dengan instruksi lengkap
- Deadline jelas (48 jam)
- Step-by-step guide
- Support contact tersedia

### Untuk System:
- Credit tracking ready
- Deadline enforcement
- Audit trail lengkap
- Integration dengan Didit seamless

---

**Version**: 1.0
**Last Updated**: December 2024
**Status**: Production Ready ✅
**Credit System**: Coming Soon 🔜
