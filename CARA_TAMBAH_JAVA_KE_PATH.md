# Cara Menambahkan Java ke PATH Windows

## 🎯 Langkah-langkah Manual

### 1. Cari Lokasi Instalasi Java

Cek folder-folder berikut untuk menemukan Java:
- `C:\Program Files\Java`
- `C:\Program Files\Microsoft\jdk-17.x.x`
- `C:\Program Files\Eclipse Adoptium`
- `C:\Program Files\OpenJDK`

Atau jalankan command ini di PowerShell:
```powershell
Get-ChildItem "C:\Program Files" -Directory | Where-Object { $_.Name -like "*jdk*" -or $_.Name -like "*java*" }
```

### 2. Tambahkan ke PATH

**Cara GUI (Paling Mudah):**

1. **Buka Environment Variables:**
   - Tekan `Windows + R`
   - Ketik: `sysdm.cpl`
   - Enter

2. **Edit PATH:**
   - Klik tab "Advanced"
   - Klik "Environment Variables"
   - Di "System variables", cari "Path"
   - Klik "Edit"

3. **Tambahkan Java:**
   - Klik "New"
   - Masukkan path ke folder `bin` Java, contoh:
     ```
     C:\Program Files\Microsoft\jdk-17.0.9.8-hotspot\bin
     ```
     atau
     ```
     C:\Program Files\Java\jdk-17\bin
     ```
   - Klik "OK" di semua dialog

4. **Restart Terminal:**
   - Tutup semua PowerShell/Command Prompt
   - Buka baru

5. **Test:**
   ```bash
   java -version
   ```

---

## ⚡ Cara Cepat (PowerShell as Administrator)

**Jalankan PowerShell sebagai Administrator**, lalu:

```powershell
# Ganti path ini sesuai lokasi Java Anda
$javaPath = "C:\Program Files\Microsoft\jdk-17.0.9.8-hotspot\bin"

# Tambahkan ke PATH
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$javaPath", [EnvironmentVariableTarget]::Machine)

# Refresh PATH di session saat ini
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

**Lalu test:**
```bash
java -version
```

---

## 🔍 Menemukan Lokasi Java

Jika tidak tahu dimana Java terinstall, coba cari:

```powershell
# Cari di Program Files
Get-ChildItem "C:\Program Files" -Recurse -Filter "java.exe" -ErrorAction SilentlyContinue | Select-Object DirectoryName

# Cari di Program Files (x86)
Get-ChildItem "C:\Program Files (x86)" -Recurse -Filter "java.exe" -ErrorAction SilentlyContinue | Select-Object DirectoryName
```

Lokasi yang benar adalah folder yang berisi `java.exe`, biasanya di folder `bin`.

---

## ✅ Verifikasi Setelah Menambahkan PATH

1. **Restart terminal** (PENTING!)
2. Jalankan:
   ```bash
   java -version
   ```

3. Jika berhasil, Anda akan melihat:
   ```
   openjdk version "17.0.x" atau "java version 17.0.x"
   ```

---

## 🚀 Setelah Java di PATH

Langsung jalankan Firebase Emulator:

```bash
cd c:\Users\lenovo\Downloads\Fraudguard\fraudguard-tirtana888
firebase emulators:start
```

---

## 🆘 Troubleshooting

### Masih "java is not recognized" setelah restart
- Pastikan path yang ditambahkan adalah folder `bin` (bukan folder parent)
- Contoh BENAR: `C:\Program Files\Microsoft\jdk-17.0.9\bin`
- Contoh SALAH: `C:\Program Files\Microsoft\jdk-17.0.9`

### Tidak tahu lokasi Java
- Cek di "Add/Remove Programs" untuk melihat nama lengkap instalasi
- Atau gunakan command pencarian di atas

### PowerShell command gagal
- Pastikan menjalankan sebagai Administrator
- Ganti `$javaPath` dengan lokasi Java yang benar di sistem Anda
