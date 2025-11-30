
# FraudGuard SaaS 🛡️

**FraudGuard** adalah platform SaaS (Software as a Service) berbasis AI yang dirancang untuk membantu perusahaan melakukan deteksi dini risiko fraud pada kandidat karyawan menggunakan kerangka kerja *Fraud Triangle* (Pressure, Opportunity, Rationalization).

## 🚀 Fitur Utama

- **Multi-Tenant SaaS**: Mendukung multiple perusahaan dengan isolasi data yang aman.
- **AI Forensic Interview**: Wawancara otomatis menggunakan Google Gemini AI dengan teknik investigasi bertahap.
- **Fraud Triangle Analysis**: Visualisasi risiko kandidat dalam grafik radar.
- **Situational Judgment Test (SJT)**: Tes psikometri untuk mengukur integritas bawah sadar (Tier Premium/Enterprise).
- **Enterprise Features**: Deteksi eufemisme, analisis sentimen, dan benchmarking industri.
- **Real-time Database**: Terintegrasi penuh dengan Firebase Firestore.

## 🛠️ Teknologi yang Digunakan

- **Frontend**: React, TypeScript, Tailwind CSS, Vite.
- **AI Engine**: Google Gemini API (via `@google/genai`).
- **Database**: Firebase Firestore.
- **Backend Logic**: Firebase Cloud Functions.
- **Visualization**: Recharts.

## 📦 Cara Menjalankan (Local Development)

1.  **Clone Repositori**
    ```bash
    git clone https://github.com/username-anda/fraudguard-saas.git
    cd fraudguard-saas
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment Variables**
    Buat file `.env` di root folder dan tambahkan API Key Gemini Anda:
    ```bash
    API_KEY=YOUR_GEMINI_API_KEY
    ```

4.  **Jalankan Aplikasi**
    ```bash
    npm run dev
    ```

## 🚢 Deployment

Aplikasi ini dikonfigurasi untuk siap deploy ke **Google Cloud Run** atau **Firebase Hosting**.

**Build untuk Production:**
```bash
npm run build
```

**Preview Production Build (Port 8080):**
```bash
npm run start
```

## 📄 Struktur Folder

- `/src/components`: Komponen UI React (Dashboard, Interview, Reports).
- `/src/services`: Logika integrasi API (Firebase, Gemini AI).
- `/functions`: Kode backend untuk Firebase Cloud Functions.

---

*Dikembangkan untuk demo Fraud Detection System.*
