# ✅ Java PATH Setup - Quick Guide

## 📍 Java Location Found
```
C:\Program Files\Java\jdk-25\bin
```

## ⚡ Cara Cepat - Tambahkan ke PATH

### Opsi 1: PowerShell (Administrator) - Otomatis
Buka PowerShell **sebagai Administrator**, lalu jalankan:

```powershell
$javaPath = "C:\Program Files\Java\jdk-25\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$javaPath", [EnvironmentVariableTarget]::Machine)
```

Lalu **restart terminal** dan test:
```bash
java -version
```

### Opsi 2: Manual (GUI) - Lebih Aman
1. Tekan `Windows + R`
2. Ketik: `sysdm.cpl` → Enter
3. Tab "Advanced" → "Environment Variables"
4. Di "System variables", pilih "Path" → "Edit"
5. Klik "New"
6. Paste: `C:\Program Files\Java\jdk-25\bin`
7. OK semua dialog
8. **Restart terminal**
9. Test: `java -version`

## 🚀 Setelah PATH Ditambahkan

1. **RESTART TERMINAL** (wajib!)
2. Test Java:
   ```bash
   java -version
   ```
   
3. Start Firebase Emulator:
   ```bash
   cd c:\Users\lenovo\Downloads\Fraudguard\fraudguard-tirtana888
   firebase emulators:start
   ```

## ✅ Expected Output
```
openjdk version "25.0.x" atau "java version 25.0.x"
```

---

**Path Java Anda:** `C:\Program Files\Java\jdk-25\bin`  
**Next:** Tambahkan ke PATH → Restart terminal → `firebase emulators:start`
