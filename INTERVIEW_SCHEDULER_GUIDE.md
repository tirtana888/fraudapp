# Interview Scheduler - Panduan Lengkap

Fitur jadwal wawancara dengan form yang user-friendly dan informatif untuk HR.

## ✅ Fitur yang Sudah Diimplementasikan

### 1. **Popup Modal Jadwal Wawancara**
Modal modern dengan design yang clean dan informatif:
- Header gradient orange dengan icon email
- Judul "Jadwalkan Wawancara"
- Scrollable content untuk form yang panjang
- Responsive design

### 2. **Pilihan Tipe Wawancara**
Dua tombol card besar untuk pilih tipe:

#### **Online (Video Call)**
- Icon Globe dengan background orange saat aktif
- Form fields yang muncul:
  - **Tanggal Wawancara** (required) - date picker dengan min date = today
  - **Waktu** (required) - time picker
  - **Link Meeting** (required) - input URL untuk Google Meet/Zoom
  - Helper text: "Masukkan link lengkap untuk video call wawancara"

#### **Offline (Di Kantor)**
- Icon MapPin dengan background orange saat aktif
- Form fields yang muncul:
  - **Tanggal Wawancara** (required) - date picker dengan min date = today
  - **Waktu** (required) - time picker
  - **Alamat Kantor** (required) - textarea 3 rows
  - Helper text: "Alamat ini akan dikirim ke kandidat dalam email undangan"
  - **Auto-fill**: Otomatis mengambil alamat dari Company Profile saat modal dibuka

### 3. **Validasi Form**
Validasi lengkap sebelum kirim email:
- ✅ Tanggal wajib diisi
- ✅ Waktu wajib diisi
- ✅ Link meeting wajib diisi (untuk online)
- ✅ Alamat kantor wajib diisi (untuk offline)
- ✅ Toast error jika ada field kosong

### 4. **Email Template yang Dikirim**
Email professional dengan detail lengkap:
- Header ucapan selamat
- Detail wawancara:
  - 📅 Tanggal (format: Senin, 10 Desember 2024)
  - ⏰ Waktu (format: 14:00)
  - 📍 Lokasi:
    - Online: "Online via [link meeting]"
    - Offline: Alamat lengkap kantor
  - 👤 Pewawancara: Tim HR [Nama Company]
- Persiapan wawancara (5 tips)
- Tips wawancara (5 panduan)
- Konfirmasi kehadiran

### 5. **Data yang Tersimpan di Firestore**
Setelah kirim undangan, data disimpan di `interview_sessions`:

```javascript
{
  recruitmentStage: 'interview',
  interviewEmailSent: true,
  interviewEmailSentAt: '2024-12-06T10:00:00.000Z',
  interviewSchedule: {
    type: 'online' | 'offline',
    date: '2024-12-10',
    time: '14:00',
    location: 'Jl. Sudirman No. 123...' // untuk offline
    link: 'https://meet.google.com/xxx' // untuk online
    scheduledAt: '2024-12-06T10:00:00.000Z'
  },
  timeline: [
    // ... previous events
    {
      stage: 'interview',
      status: 'current',
      date: '2024-12-06T10:00:00.000Z',
      note: 'John Doe dipanggil untuk tahap wawancara online pada Senin, 10 Desember 2024 pukul 14:00'
    }
  ]
}
```

### 6. **Timeline Update**
Status kandidat otomatis update dengan note informatif:
- **Online**: "[Nama] dipanggil untuk tahap wawancara online pada [tanggal] pukul [waktu]"
- **Offline**: "[Nama] dipanggil untuk tahap wawancara offline pada [tanggal] pukul [waktu]"

## 🎨 User Experience

### Flow Lengkap:
1. HR klik button "Wawancara" di detail kandidat
2. Modal muncul dengan animasi fade-in
3. Alamat kantor otomatis terisi dari Company Profile (untuk offline)
4. HR pilih tipe: Online atau Offline
5. Card yang dipilih highlight dengan border orange dan background orange muda
6. Form fields muncul sesuai pilihan tipe
7. HR isi tanggal, waktu, dan link/alamat
8. Klik "Kirim Undangan"
9. Validasi form berjalan
10. Loading state muncul saat proses
11. Email terkirim ke kandidat
12. Status berubah ke "Interview"
13. Timeline ter-update
14. Modal close otomatis
15. Form reset
16. Toast success muncul

### Visual Design:
- ✅ Card selection dengan border orange
- ✅ Icon dengan background circular
- ✅ Required fields ditandai (*)
- ✅ Helper text untuk guidance
- ✅ Info box kuning untuk ringkasan aksi
- ✅ Button gradient orange untuk submit
- ✅ Loading spinner saat kirim
- ✅ Disabled state untuk semua button saat loading

## 📝 Contoh Penggunaan

### Jadwal Wawancara Online:
```
Tipe: Online ✓
Tanggal: 2024-12-10
Waktu: 14:00
Link Meeting: https://meet.google.com/abc-defg-hij
```

Email yang dikirim akan berisi link Google Meet di bagian lokasi.

### Jadwal Wawancara Offline:
```
Tipe: Offline ✓
Tanggal: 2024-12-15
Waktu: 09:00
Alamat: Jl. Sudirman No. 123, Jakarta Selatan 12190
```

Email yang dikirim akan berisi alamat lengkap kantor.

## ⚙️ Technical Details

### State Management:
- `interviewType`: 'online' | 'offline' (default: 'online')
- `interviewDate`: string (YYYY-MM-DD format)
- `interviewTime`: string (HH:MM format)
- `interviewLink`: string (URL untuk online)
- `interviewLocation`: string (alamat untuk offline)

### Auto-fill Alamat:
Function `handleOpenInterviewModal()` akan:
1. Fetch company data dari Firestore
2. Ambil `address` atau `location` dari company profile
3. Set ke `interviewLocation` state

### Date Format:
- Input: `2024-12-10`
- Output email: `Senin, 10 Desember 2024` (locale: id-ID)

## 🚀 Deployment Status

**Frontend**: ✅ Sudah terimplementasi dan build berhasil

**Backend (Firebase Functions)**: ⚠️ Perlu di-deploy

Untuk deploy Firebase Functions:
```bash
firebase deploy --only functions
```

Setelah deploy, fitur akan langsung aktif!

## 🎯 Benefits

### Untuk HR:
- Form yang jelas dan mudah digunakan
- Auto-fill alamat menghemat waktu
- Validasi mencegah error
- Preview detail sebelum kirim

### Untuk Kandidat:
- Email professional dengan detail lengkap
- Link meeting langsung bisa diklik (untuk online)
- Alamat jelas dengan Google Maps (untuk offline)
- Tips persiapan wawancara
- Konfirmasi kehadiran yang mudah

## 📊 Tracking & Analytics

Data yang bisa dilacak:
- Total undangan wawancara dikirim
- Ratio online vs offline
- Waktu rata-rata penjadwalan
- Timeline per kandidat lengkap

## 🔒 Security

- Validasi input di frontend
- Required fields enforcement
- URL validation untuk meeting link
- Firebase security rules apply
- Email via Resend API (secure)

## 📱 Responsive Design

Modal sudah responsive untuk:
- Desktop (max-width: 2xl)
- Tablet (scrollable content)
- Mobile (full width dengan padding)

---

**Version**: 1.0
**Last Updated**: December 2024
**Status**: Production Ready ✅
