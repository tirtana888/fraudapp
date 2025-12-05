# 🔐 Setup Super Admin Access

## Masalah
Anda login dengan email `admin@fraudguard.id` tapi tidak melihat **Admin Panel** di sidebar.

## Penyebab
Admin Panel hanya terlihat untuk user dengan role **"System Admin"**. Kemungkinan akun Anda memiliki role berbeda atau belum diset.

---

## ✅ Solusi (3 Metode)

### **Metode 1: Update Role via Firestore Console** (PALING MUDAH)

1. **Buka Firebase Console**
   - Go to: https://console.firebase.google.com
   - Pilih project Anda
   - Klik **Firestore Database** di menu kiri

2. **Cari User Document**
   - Buka collection: `users`
   - Cari document dengan email: `admin@fraudguard.id`
   - Klik document tersebut

3. **Update Role Field**
   - Cari field `role`
   - Ubah nilainya menjadi: `System Admin` (PERSIS seperti ini, termasuk huruf kapital dan spasi)
   - Klik **Update**

4. **Logout dan Login Lagi**
   - Logout dari aplikasi
   - Login kembali dengan email yang sama
   - Sidebar sekarang akan menampilkan "Admin Panel"

---

### **Metode 2: Buat User Baru via Firestore Console**

Jika user `admin@fraudguard.id` belum ada di database:

1. **Buka Firestore Console**
   - Go to: https://console.firebase.google.com
   - Pilih project → Firestore Database

2. **Buka Collection `users`**
   - Jika belum ada, klik "Start collection" dan beri nama: `users`

3. **Tambah Document Baru**
   ```
   Document ID: (auto-generate atau custom)

   Fields:
   - name (string): "Super Admin"
   - email (string): "admin@fraudguard.id"
   - password (string): "admin123" (atau password pilihan Anda)
   - role (string): "System Admin"
   - companyId (string): "" (kosong untuk super admin)
   - avatar (string): "" (optional)
   ```

4. **Save Document**

5. **Login dengan Kredensial Baru**
   - Email: `admin@fraudguard.id`
   - Password: `admin123` (atau yang Anda set)

---

### **Metode 3: Script Otomatis (Advanced)**

Jika Anda familiar dengan Firebase Admin SDK:

**Create file**: `scripts/create-super-admin.js`

```javascript
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../path/to/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createSuperAdmin() {
  try {
    // Check if user exists
    const usersRef = db.collection('users');
    const query = await usersRef.where('email', '==', 'admin@fraudguard.id').get();

    if (query.empty) {
      // Create new super admin user
      await usersRef.add({
        name: 'Super Admin',
        email: 'admin@fraudguard.id',
        password: 'YourSecurePassword123!', // Change this!
        role: 'System Admin',
        companyId: '',
        avatar: '',
        createdAt: new Date().toISOString()
      });
      console.log('✅ Super Admin user created successfully!');
    } else {
      // Update existing user role
      const userId = query.docs[0].id;
      await usersRef.doc(userId).update({
        role: 'System Admin'
      });
      console.log('✅ User role updated to System Admin!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createSuperAdmin();
```

**Run script:**
```bash
node scripts/create-super-admin.js
```

---

## 🔍 Verifikasi

### Cek Role di Firestore:

1. Buka Firestore Console
2. Collection: `users`
3. Cari document dengan email: `admin@fraudguard.id`
4. Pastikan field `role` bernilai: **`System Admin`**

### Cek di Aplikasi:

1. Logout dari aplikasi
2. Login dengan email: `admin@fraudguard.id`
3. Periksa sidebar - harus ada section:
   ```
   SUPER ADMIN
   ├── 🛡️ Admin Panel
   ```
4. Klik **Admin Panel**
5. Anda akan melihat 2 tabs:
   - **Company Management**
   - **Analytics Dashboard** ← Super Admin Dashboard yang baru

---

## ⚠️ PENTING: Role Name

Role harus **PERSIS** seperti ini (case-sensitive):

✅ **Correct**: `System Admin`
❌ **Wrong**: `system admin`
❌ **Wrong**: `SystemAdmin`
❌ **Wrong**: `SYSTEM ADMIN`
❌ **Wrong**: `admin`

Jika role tidak persis, sidebar TIDAK akan menampilkan Admin Panel.

---

## 🎯 Role Types di Aplikasi

| Role Name | Access Level | Admin Panel? |
|-----------|--------------|--------------|
| `System Admin` | Full access + Admin Panel | ✅ YES |
| `Admin` | Company admin access | ❌ NO |
| `HR Manager` | HR operations | ❌ NO |
| `User` | Basic access | ❌ NO |

---

## 🐛 Troubleshooting

### Problem 1: "Admin Panel masih tidak muncul setelah update role"

**Solution:**
- Pastikan Anda sudah logout dan login lagi
- Clear browser cache (Ctrl+Shift+Delete)
- Periksa lagi role di Firestore (harus exact: `System Admin`)

### Problem 2: "User document tidak ditemukan di Firestore"

**Solution:**
- Buat user baru menggunakan Metode 2
- Atau seed database dengan data dummy

### Problem 3: "Setelah login, app crash atau loading forever"

**Solution:**
- Periksa field `companyId` di user document
- Untuk super admin, `companyId` harus kosong string: `""`
- Jangan null, jangan undefined, harus string kosong

### Problem 4: "Password tidak cocok"

**Solution:**
- Password di Firestore disimpan plain text (tidak ter-hash)
- Pastikan password yang Anda masukkan EXACT sama dengan di database
- Coba trim whitespace di awal/akhir password

---

## 📊 Cara Akses Super Admin Dashboard

Setelah role sudah benar:

1. **Login** sebagai super admin
2. **Sidebar** akan menampilkan section "SUPER ADMIN"
3. **Klik "Admin Panel"**
4. **Pilih tab "Analytics Dashboard"**
5. Dashboard akan menampilkan:
   - ✅ Total Assessments (live)
   - ✅ High Risk Detected (%)
   - ✅ Companies Onboarded
   - ✅ Estimated Revenue
   - ✅ Risk Distribution Chart
   - ✅ System Usage Chart
   - ✅ Recent Companies Table

---

## 🔒 Security Recommendations

### After Setting Up Super Admin:

1. **Change Default Password**
   ```
   - Don't use: "admin123"
   - Use strong password: Min 12 chars, mix of upper/lower/numbers/symbols
   ```

2. **Limit Super Admin Accounts**
   ```
   - Only create super admin for trusted personnel
   - Regular company admins should use role: "Admin"
   ```

3. **Enable Two-Factor Authentication** (Future Enhancement)
   ```
   - Implement 2FA for super admin accounts
   - Use Firebase Authentication with MFA
   ```

4. **Monitor Admin Activity**
   ```
   - Log all super admin actions
   - Regular audit of admin panel usage
   ```

---

## 🚀 Quick Setup Checklist

- [ ] Open Firebase Console
- [ ] Navigate to Firestore Database
- [ ] Open `users` collection
- [ ] Find/Create user with email `admin@fraudguard.id`
- [ ] Set field `role` to `System Admin` (exact)
- [ ] Set field `companyId` to `""` (empty string)
- [ ] Save changes
- [ ] Logout from app
- [ ] Login again
- [ ] Verify "Admin Panel" appears in sidebar
- [ ] Click Admin Panel → Analytics Dashboard
- [ ] Verify dashboard loads with real data

---

## 📞 Need Help?

If you still can't access Super Admin Dashboard after following these steps:

1. Check Firebase Console for any errors
2. Check browser console for JavaScript errors
3. Verify Firestore rules allow read access to `stats` collection
4. Ensure Cloud Function `updateGlobalStats` is deployed
5. Check that `stats/global_metrics` document exists

---

## 📝 Example: Complete Super Admin User Document

```json
{
  "name": "Super Admin",
  "email": "admin@fraudguard.id",
  "password": "YourSecurePassword123!",
  "role": "System Admin",
  "companyId": "",
  "avatar": "",
  "createdAt": "2025-12-05T10:00:00Z"
}
```

**Important Fields:**
- `role`: Must be exactly `"System Admin"`
- `companyId`: Must be empty string `""` (not null)
- `password`: Plain text (will be compared during login)

---

**Last Updated**: 2025-12-05
**Status**: ✅ Ready to Use
