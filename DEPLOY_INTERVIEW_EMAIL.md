# Deploy Interview Email Function

Template email untuk undangan wawancara sudah ditambahkan, tapi perlu di-deploy ke Firebase Functions agar aktif.

## Langkah Deploy:

### Option 1: Deploy via Terminal (Recommended)

```bash
# Pastikan Anda sudah login ke Firebase
firebase login

# Deploy functions
firebase deploy --only functions
```

### Option 2: Deploy Specific Function

Jika ingin deploy hanya function tertentu:

```bash
firebase deploy --only functions:sendEmail
```

### Option 3: Deploy via Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project Anda
3. Pergi ke **Functions** di menu kiri
4. Upload file `functions/index.js` yang sudah diupdate
5. Deploy function

## Verifikasi Deployment

Setelah deploy, cek di Firebase Console:
1. Pergi ke **Functions**
2. Pastikan function `sendEmail` sudah ter-update
3. Cek logs untuk memastikan tidak ada error

## Test Email Template

Untuk test apakah email template sudah aktif:
1. Login ke dashboard
2. Buka detail kandidat
3. Klik button "Wawancara"
4. Konfirmasi pengiriman email
5. Cek email kandidat

## Template Email yang Ditambahkan

✅ **interview_invitation** - Template undangan wawancara dengan:
- Header ucapan selamat
- Detail wawancara (tanggal, waktu, lokasi)
- Persiapan dan tips wawancara
- Konfirmasi kehadiran
- Design professional dan responsive

## Troubleshooting

**Error: "Email type 'interview_invitation' tidak dikenal"**
- Solusi: Deploy Firebase Functions dengan command di atas

**Error: "Firebase CLI not found"**
- Solusi: Install Firebase CLI dengan `npm install -g firebase-tools`

**Error: "Permission denied"**
- Solusi: Login ulang dengan `firebase login`

## Files yang Diupdate

- ✅ `functions/index.js` - Menambahkan template dan handler
- ✅ `components/CandidateDetail.tsx` - Menambahkan modal dan fungsi kirim email
- ✅ `index.html` - Menambahkan CSS animation

## Next Steps

Setelah deploy berhasil, fitur undangan wawancara akan langsung aktif dan siap digunakan!
