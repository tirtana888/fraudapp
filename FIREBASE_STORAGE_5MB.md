# ✅ Logo Upload - Firebase Storage (5MB Support)

## 🎉 Upgrade: 1MB → 5MB Capacity

Logo sekarang menggunakan **Firebase Storage** dengan kapasitas hingga **5MB** (sebelumnya max 1MB karena Firestore document limit).

---

## 📊 Before vs After

| Feature | Before (Base64) | After (Storage) |
|---------|----------------|-----------------|
| **Max Size** | 1MB | **5MB** |
| **Storage** | Firestore document | Firebase Storage |
| **Reliability** | Logo hilang | ✅ Persists reliably |
| **Performance** | Slow (large strings) | ✅ Fast (CDN) |
| **Complexity** | High (compress, resize, encode) | ✅ Simple (direct upload) |

---

## 🚀 How It Works

### Upload Process

```
User uploads logo file (5MB max)
         ↓
Firebase Storage: logos/{companyId}/logo.png
         ↓
Get public download URL
         ↓
Save URL to Firestore: companies/{id}/logoUrl
         ↓
Logo loads via CDN in assessment page
```

### Storage Structure

```
Firebase Storage:
└─ logos/
    ├─ c1/logo.png
    └─ company123/logo.jpg

Firestore:
└─ companies/
    ├─ c1: { logoUrl: "https://firebasestorage.googleapis.com/..." }
    └─ company123: { logoUrl: "https://..." }
```

---

## 🧪 Testing

### Step 1: Upload Logo

1. Login → "Pengaturan Link Asesmen"
2. Upload logo (up to 5MB PNG/JPG)
3. **Console logs:**
   ```
   [LOGO-UPLOAD] Starting: 2.34MB
   [STORAGE] Uploading to: logos/c1/logo.png
   [STORAGE] ✅ Logo uploaded successfully
   ```
4. Alert: "✅ Logo berhasil di-upload (2.34MB)!"

### Step 2: Save & Verify

1. Click "Simpan Perubahan"
2. **Console logs:**
   ```
   Verified data: { logoUrlLength: 147 }
   ✅ Verification successful
   ```

### Step 3: Test Assessment Page

1. Open invite link
2. **Console logs:**
   ```
   [PUBLIC-ASSESSMENT] hasLogo: true
   [HEADER] ✅ Logo image loaded
   ```
3. Logo appears in header ✅

---

## 🔧 Technical Details

### New Functions

**Upload to Storage:**
```typescript
uploadCompanyLogo(companyId, file) → downloadURL
- Validates: type (PNG/JPG), size (5MB max)
- Uploads to: logos/{companyId}/logo.{ext}
- Returns: public CDN URL
```

**Delete from Storage:**
```typescript
deleteCompanyLogo(companyId)
- Deletes: logos/{companyId}/*
```

### Storage Rules

```javascript
match /logos/{companyId}/{fileName} {
  allow read: if true;  // Public (for assessment)
  allow write: if size <= 5MB && type matches image/*
  allow delete: if true;
}
```

---

## 🔍 Troubleshooting

### "File too large"
- **Error**: `❌ Ukuran file terlalu besar (6MB)!`
- **Fix**: Use logo ≤ 5MB

### "Permission denied"
- **Error**: `[STORAGE] ❌ Upload failed: Permission denied`
- **Fix**: Deploy storage rules: `firebase deploy --only storage`

### Logo not showing
- **Check**: `logoUrl` in Firestore
- **Expected**: `https://firebasestorage.googleapis.com/...`
- **NOT**: `data:image/png;base64,...`
- **Fix**: Re-upload logo

---

## 🚀 Deployment

```bash
# Deploy storage rules
firebase deploy --only storage

# Or deploy everything
firebase deploy
```

**Verify:**
1. Firebase Console → Storage → Rules
2. Check `logos/` folder exists
3. Test upload logo
4. Verify public access

---

## 📋 Migration (Base64 → Storage)

For existing companies with base64 logos:

**Option 1: Manual**
- Each company re-uploads logo via Settings

**Option 2: Automated**
```typescript
// Convert base64 to File → Upload to Storage → Update Firestore
```

---

## 🎯 Summary

**Changes:**
- ✅ Firebase Storage support added
- ✅ 5MB upload capacity (5x increase)
- ✅ CDN-backed download URLs
- ✅ Public read access configured
- ✅ Enhanced logging

**Files:**
- `services/firebase.ts` - Storage functions
- `components/AssessmentSettings.tsx` - Updated upload
- `storage.rules` - Security rules
- `firebase.json` - Storage config

**Benefits:**
- ✅ 5MB capacity (was 1MB)
- ✅ Reliable persistence
- ✅ Faster load times
- ✅ Simpler code

**Build:** ✅ SUCCESS
**Deploy:** `firebase deploy`
**Status:** Ready for production
