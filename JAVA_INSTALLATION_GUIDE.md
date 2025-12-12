# Java Installation Guide for Firebase Emulator

## ⚠️ Chocolatey Not Installed

Chocolatey package manager is not available on your system. Let's install Java manually instead.

## 🔽 Download Java (Easiest Method)

### Option 1: Microsoft OpenJDK (Recommended for Windows)
**Direct Download Link:**
https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-17

**Steps:**
1. Click the link above
2. Download **"OpenJDK 17 LTS - Windows x64 MSI"**
3. Run the installer
4. ✅ Check "Add to PATH" during installation
5. Restart your terminal

### Option 2: Oracle JDK
**Direct Download Link:**
https://www.oracle.com/java/technologies/downloads/#java17-windows

**Steps:**
1. Click the link above
2. Download **"Windows x64 Installer"**
3. Run the installer
4. Follow the installation wizard
5. Restart your terminal

### Option 3: Adoptium (Eclipse Temurin)
**Direct Download Link:**
https://adoptium.net/temurin/releases/?version=17

**Steps:**
1. Click the link above
2. Select **Operating System: Windows**
3. Select **Architecture: x64**
4. Download the **.msi** installer
5. Run and install
6. Restart your terminal

---

## ✅ Verify Installation

After installing Java, **restart your terminal** and run:

```bash
java -version
```

**Expected output:**
```
openjdk version "17.0.x" or "java version 17.0.x"
```

---

## 🚀 Next Steps (After Java Installation)

### 1. Restart Terminal
Close and reopen PowerShell/Command Prompt to refresh PATH

### 2. Verify Java
```bash
java -version
```

### 3. Start Firebase Emulator
```bash
cd c:\Users\lenovo\Downloads\Fraudguard\fraudguard-tirtana888
firebase emulators:start
```

### 4. Verify Emulator Running
You should see:
```
✔  All emulators ready! It is now safe to connect your app.
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! View status and logs at http://localhost:4000 │
└─────────────────────────────────────────────────────────────┘

┌───────────┬────────────────┬─────────────────────────────────┐
│ Emulator  │ Host:Port      │ View in Emulator UI             │
├───────────┼────────────────┼─────────────────────────────────┤
│ Functions │ localhost:5001 │ http://localhost:4000/functions │
│ Firestore │ localhost:8080 │ http://localhost:4000/firestore │
│ Auth      │ localhost:9099 │ http://localhost:4000/auth      │
│ Storage   │ localhost:9199 │ http://localhost:4000/storage   │
└───────────┴────────────────┴─────────────────────────────────┘
```

### 5. Access Emulator UI
Open browser: http://localhost:4000

---

## 🎯 Quick Reference

**Recommended:** Microsoft OpenJDK 17 (easiest for Windows)  
**Download:** https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-17  
**File:** `microsoft-jdk-17.x.x-windows-x64.msi`

**After Installation:**
1. Restart terminal
2. Run: `java -version`
3. Run: `firebase emulators:start`

---

## 🆘 Troubleshooting

### "java is not recognized" after installation
**Solution:** Restart your terminal (close and reopen)

### Still not working after restart
**Solution:** Manually add Java to PATH:
1. Search "Environment Variables" in Windows
2. Edit "Path" in System Variables
3. Add: `C:\Program Files\Microsoft\jdk-17.x.x\bin`
4. Click OK
5. Restart terminal

### Emulator fails to start
**Check:**
- Java version is 11 or higher: `java -version`
- Ports 4000, 5001, 8080, 9099, 9199 are not in use
- Run as Administrator if permission issues

---

## 📝 Current Status

- ❌ Chocolatey not installed
- ❌ Java not installed
- ✅ Firebase CLI installed (v14.27.0)
- ✅ firebase.json configured for emulator
- ⏸️ Waiting for Java installation

**Next Action:** Download and install Java from link above, then run `firebase emulators:start`
