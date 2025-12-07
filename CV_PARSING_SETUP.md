# Setup CV Parsing dengan Mistral AI

## Fitur CV Parsing Otomatis

Sistem ini menggunakan **Mistral AI** untuk secara otomatis mengekstrak informasi terstruktur dari CV kandidat yang diunggah dalam format PDF.

### Apa yang Diparsing?

Mistral AI akan mengekstrak:
- **Informasi Personal**: Nama lengkap, email, telepon, alamat
- **Ringkasan Profesional**: Summary atau objective statement
- **Pengalaman Kerja**: Posisi, perusahaan, durasi, deskripsi
- **Pendidikan**: Gelar, institusi, tahun
- **Keahlian**: Daftar skills
- **Sertifikasi**: Sertifikat profesional
- **Bahasa**: Bahasa yang dikuasai

### Flow Kerja

1. **Kandidat Upload CV** → CV disimpan di Firebase Storage
2. **HR Klik "Parse CV"** → Memanggil Firebase Function
3. **Function Download CV** → Mengambil PDF dari Storage
4. **Mistral AI Parsing** → Mengekstrak data terstruktur
5. **Save to Firestore** → Menyimpan hasil parsing ke session document
6. **Tampilkan di UI** → Hasil parsing muncul di Candidate Profile

### 1. Dapatkan API Key Mistral AI

1. Kunjungi [https://console.mistral.ai/](https://console.mistral.ai/)
2. Login atau buat akun baru
3. Navigasi ke **API Keys**
4. Klik **Create new key**
5. Copy API key yang dihasilkan (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

⚠️ **PENTING**: Simpan API key dengan aman, jangan pernah commit ke Git!

### 2. Set API Key di Firebase Functions

Jalankan command ini di terminal (ganti `YOUR_API_KEY` dengan API key Mistral AI Anda):

\`\`\`bash
firebase functions:config:set mistral.api_key="YOUR_API_KEY"
\`\`\`

Contoh:
\`\`\`bash
firebase functions:config:set mistral.api_key="sk_test_1234567890abcdefghijklmnop"
\`\`\`

### 3. Verify Konfigurasi

Untuk memastikan API key sudah tersimpan:

\`\`\`bash
firebase functions:config:get
\`\`\`

Output yang benar:
\`\`\`json
{
  "mistral": {
    "api_key": "sk_test_1234567890abcdefghijklmnop"
  },
  "resend": {
    "api_key": "re_xxxxxxxxxxxxx"
  }
}
\`\`\`

### 4. Deploy Firebase Functions

Deploy function CV parsing ke production:

\`\`\`bash
cd functions
npm install
cd ..
firebase deploy --only functions:parseCVWithMistral
\`\`\`

Atau deploy semua functions sekaligus:

\`\`\`bash
firebase deploy --only functions
\`\`\`

### 5. Cara Menggunakan

#### Di Candidate Detail Page:

1. Buka **Kandidat Detail** dari list kandidat
2. Jika CV sudah diupload, akan muncul tombol **"Parse CV"**
3. Klik tombol tersebut
4. Tunggu 5-10 detik hingga parsing selesai
5. Hasil parsing akan muncul otomatis di:
   - Tab **"Ringkasan"** → Profil kandidat (menggantikan tampilan PDF)
   - Tab **"CV & Dokumen"** → Bagian "Data Kandidat (AI Parsed)"

#### Tab CV & Dokumen:

Tab ini memiliki 2 section:
1. **Data Kandidat (AI Parsed)** → Hasil parsing yang terstruktur dan mudah dibaca
2. **CV Original** → PDF viewer untuk melihat CV asli + tombol download

### 6. Troubleshooting

#### Error: "Mistral AI API key not configured"
**Solusi**: Pastikan API key sudah di-set dengan benar di Firebase Functions config

#### Error: "Failed to parse CV: Invalid AI response format"
**Solusi**:
- CV mungkin dalam format yang sulit dibaca (scan quality rendah)
- Coba upload ulang CV dengan quality lebih baik
- Format PDF harus text-based, bukan image-based

#### Error: "Firebase Functions not available"
**Solusi**:
- Pastikan Firebase Functions sudah di-deploy
- Cek Firebase Console → Functions → pastikan `parseCVWithMistral` ada

#### Parsing Terlalu Lama
**Solusi**:
- Timeout default adalah 540 detik (9 menit)
- Untuk CV yang panjang, bisa memakan waktu 30-60 detik
- Jika lebih dari 2 menit, coba refresh page dan parse ulang

### 7. Biaya Mistral AI

Model yang digunakan: **mistral-large-latest**

Estimasi biaya per parsing:
- Input tokens: ~2000 (CV + prompt) = $0.008
- Output tokens: ~500 (structured data) = $0.012
- **Total per CV: ~$0.02 (Rp 300)**

Untuk 100 kandidat per bulan: **~$2 atau Rp 30.000**

Sangat affordable! 🎉

### 8. Security & Privacy

✅ **Aman**:
- CV tidak pernah meninggalkan infrastruktur terkontrol
- Data hanya dikirim ke Mistral AI via HTTPS
- Hasil parsing disimpan encrypted di Firestore
- Hanya HR yang authorized bisa akses

❌ **Tidak disimpan di Mistral AI**:
- Mistral AI tidak menyimpan CV
- Data hanya diproses on-the-fly
- Setelah parsing selesai, data tidak tersimpan di Mistral

### 9. Future Enhancements

Fitur yang bisa ditambahkan:
- ✨ Auto-parse saat upload CV
- ✨ Batch parsing untuk multiple kandidat
- ✨ Export parsed data ke Excel/CSV
- ✨ AI matching dengan job requirements
- ✨ Auto-fill form dengan data parsed

---

## Quick Start Commands

\`\`\`bash
# 1. Set API Key
firebase functions:config:set mistral.api_key="YOUR_API_KEY"

# 2. Deploy Function
firebase deploy --only functions:parseCVWithMistral

# 3. Test
# Go to Candidate Detail → Click "Parse CV" button

# 4. Check Logs (optional)
firebase functions:log --only parseCVWithMistral
\`\`\`

---

**Selesai! 🎉**

CV Parsing sekarang aktif dan siap digunakan!
