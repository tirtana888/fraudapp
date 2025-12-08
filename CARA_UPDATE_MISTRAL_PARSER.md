# 📝 Cara Update Mistral Document Parser

## 🎯 Yang Harus Dilakukan:

### Step 1: Backup File Lama (Opsional)
```bash
cd functions
cp index.js index.js.backup
```

### Step 2: Edit `functions/index.js`

#### A. Cari dan HAPUS function lama `parseCVWithMistral`

Cari block code ini (sekitar line 1800-1900):
```javascript
// ==========================================
// FUNGSI 7: CV PARSER WITH MISTRAL AI (FAIL-SAFE VERSION)
// ==========================================
exports.parseCVWithMistral = onCall({
  ...
  const pdfParser = new PDFParser(null, 1);
  ...
});
```

**HAPUS SELURUH BLOCK** dari `exports.parseCVWithMistral` sampai closing bracket `});`

#### B. ATAU Comment Out (Safer)
```javascript
/*
exports.parseCVWithMistral = onCall({
  ... semua code ...
});
*/
```

### Step 3: Pastikan Import Ada di Bagian Atas

Di bagian atas `functions/index.js` (sekitar line 20-30), pastikan ada:
```javascript
const axios = require('axios');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
```

**HAPUS atau COMMENT** line ini jika ada:
```javascript
// const PDFParser = require("pdf2json");  // ❌ HAPUS INI
```

### Step 4: Function Baru Sudah Ada

Function `parseDocumentWithMistral` yang benar SUDAH ADA di file Anda (line terakhir).

**Pastikan function ini ADA dan LENGKAP:**
```javascript
exports.parseDocumentWithMistral = onCall({
  region: 'europe-west1',
  cors: true,
  timeoutSeconds: 300,
  memory: '2GiB',
  secrets: [mistralApiKey]
}, async (request) => {
  ...
});
```

### Step 5: Reinstall Dependencies

```bash
cd functions
rm -rf node_modules package-lock.json
npm install
```

Verify:
```bash
npm list pdf-parse mammoth axios
```

Expected output:
```
functions@...
├── axios@1.6.x
├── mammoth@1.7.x
└── pdf-parse@1.1.x
```

### Step 6: Deploy

```bash
firebase deploy --only functions:parseDocumentWithMistral
```

Expected output:
```
✔  functions[parseDocumentWithMistral(europe-west1)] Successful update operation.
✔  Deploy complete!
```

---

## ✅ Verification Checklist:

- [ ] Function lama `parseCVWithMistral` sudah dihapus/di-comment
- [ ] Import `pdf-parse`, `mammoth`, `axios` ada di bagian atas
- [ ] Import `PDFParser` atau `pdf2json` sudah dihapus
- [ ] Function baru `parseDocumentWithMistral` lengkap dengan helper functions
- [ ] Dependencies terinstall dengan benar
- [ ] Deploy sukses tanpa error

---

## 🧪 Test After Deploy:

1. Clear browser cache (Ctrl+Shift+R)
2. Upload CV baru
3. Check Firebase logs:
```bash
firebase functions:log --only parseDocumentWithMistral
```

Expected log:
```
[DOC-PARSE] 🚀 Starting Universal Document Parser...
[DOC-PARSE] 📥 Downloading document...
[DOC-PARSE] 📄 File type: application/pdf
[DOC-PARSE] ✅ Downloaded XXX bytes
[DOC-PARSE] 🔍 Detected file type: pdf
[DOC-PARSE] 📊 Extracted XXX characters
[DOC-PARSE] 🤖 Calling Mistral AI...
[DOC-PARSE] ✅ Success
```

---

## 🔧 Quick Fix (If Still Error):

Kalau masih ada error `pdf is not a function`, jalankan:

```bash
cd functions
npm uninstall pdf-parse
npm install pdf-parse@1.1.1 --save
npm list pdf-parse
firebase deploy --only functions:parseDocumentWithMistral
```

---

## 📞 Need Help?

Jika masih error, share:
1. Output dari `npm list pdf-parse mammoth`
2. Firebase function logs
3. Error message yang muncul
