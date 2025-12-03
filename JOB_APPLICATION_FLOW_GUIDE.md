# Job Application to Interview Flow - User Guide

## 🎯 Overview

Fitur baru ini **otomatis membuat interview session** ketika kandidat submit lamaran via Job Portal. HR dapat langsung melihat dan mengelola kandidat dalam satu dashboard yang user-friendly.

---

## ✨ Fitur Baru

### 1. **Otomatis Create Interview Session**
Setiap kali kandidat submit lamaran:
- ✅ Application tersimpan di database
- ✅ Interview session otomatis dibuat
- ✅ CV ter-upload ke Firebase Storage
- ✅ Data kandidat (email, WhatsApp) tersimpan lengkap

### 2. **HR Dashboard yang User-Friendly**
Menu baru: **"Aplikasi Lowongan"** di sidebar dengan fitur:
- 📊 View semua aplikasi dalam satu halaman
- 🔍 Filter by Job Position
- 🎯 Filter by Status (Pending, Reviewed, Shortlisted, Rejected)
- 📱 Kontak kandidat via email/WhatsApp langsung
- 📄 Download CV kandidat
- 👁️ View detail kandidat & mulai AI interview

---

## 🚀 How It Works

### User Flow (Kandidat)

1. **Kandidat mengakses Job Portal**
   ```
   https://your-domain.com/careers/company-slug/job-slug
   ```

2. **Kandidat mengisi form aplikasi:**
   - Full Name
   - Email
   - WhatsApp
   - Upload CV (PDF, max 5MB)

3. **Submit Application**
   - CV di-upload ke Firebase Storage
   - Application tersimpan di Firestore
   - **Interview session otomatis dibuat**
   - Kandidat melihat success message

---

### HR Flow

#### Step 1: Akses Dashboard

1. Login ke FraudGuard
2. Sidebar → Klik **"Aplikasi Lowongan"**
3. Dashboard menampilkan semua aplikasi

#### Step 2: Filter & Browse

**Filter Options:**
- **Semua Posisi** → Lihat semua aplikasi
- **Pilih Posisi Tertentu** → Filter by job title
- **Semua Status** → Lihat semua
- **Pending** → Aplikasi baru yang belum direview
- **Reviewed** → Sudah dilihat HR
- **Shortlisted** → Kandidat masuk shortlist
- **Rejected** → Aplikasi ditolak

**Application Card Shows:**
- ✅ Nama kandidat
- ✅ Status aplikasi (dengan color coding)
- ✅ Job position & location
- ✅ Tanggal aplikasi
- ✅ Email & WhatsApp (clickable)
- ✅ Button: Download CV & View Detail

#### Step 3: Review Kandidat

**Option A: Download CV**
- Klik button **"CV"** (biru)
- CV akan download/open di tab baru
- Review offline

**Option B: View Detail & AI Interview**
- Klik button **"Detail"** (orange)
- Opens **Interview Session** page
- Data kandidat sudah ter-populate:
  - Name
  - Email
  - Role: "Applicant"
  - CV URL tersimpan di transcript
  - WhatsApp number tersimpan
- Mulai AI Interview jika diperlukan

**Option C: Kontak Kandidat**
- Klik **email** → Opens email client
- Klik **WhatsApp** → Opens WhatsApp Web
- Langsung kontak tanpa copy-paste

---

## 📊 Dashboard Features

### Overview Stats
```
┌─────────────────────────────────────┐
│  📊 Aplikasi Lowongan               │
│  👥 15 Aplikasi                     │
└─────────────────────────────────────┘
```

### Filters
```
┌─ Filter ─────────────────────────────┐
│ [Semua Posisi ▼] [Semua Status ▼]   │
└──────────────────────────────────────┘
```

### Application Card Layout
```
┌────────────────────────────────────────────┐
│ John Doe                  [Pending ⏱️]     │
│ 📋 Software Engineer | 📍 Jakarta         │
│ 📅 1 Des 2025                              │
│                                            │
│ ✉️ john@email.com                          │
│ 📱 +62812-3456-7890                        │
│                                            │
│                      [📄 CV]  [👁️ Detail] │
└────────────────────────────────────────────┘
```

---

## 🎨 UI/UX Highlights

### Color Coding (Status)
- 🟡 **Pending** → Yellow badge
- 🔵 **Reviewed** → Blue badge
- 🟢 **Shortlisted** → Green badge
- 🔴 **Rejected** → Red badge

### Interactive Elements
- **Hover Effects** → Cards elevate on hover
- **Clickable Contacts** → Email & WhatsApp links
- **Icon-based Actions** → Clear visual cues
- **Responsive Design** → Works on desktop & tablet

### Empty State
```
┌──────────────────────────────┐
│                              │
│        💼                    │
│   Belum Ada Aplikasi         │
│                              │
│ Aplikasi dari kandidat akan  │
│    muncul di sini            │
└──────────────────────────────┘
```

---

## 💡 Tips & Best Practices

### For HR Team

1. **Check Regularly**
   - Set reminder untuk cek dashboard setiap hari
   - Aplikasi baru langsung kelihatan di top

2. **Use Filters Effectively**
   - Filter by Position saat recruiting specific role
   - Filter "Pending" untuk review aplikasi baru

3. **Quick Actions**
   - Download CV untuk offline review
   - Contact via WhatsApp untuk quick response
   - Use email untuk formal communication

4. **Interview Workflow**
   - View Detail → Opens Interview Session
   - Session sudah ada CV & contact info
   - Langsung start AI interview jika perlu
   - Add manual notes di transcript

5. **Status Management**
   - Update status di Application document (Firestore)
   - Status akan auto-sync ke dashboard
   - Keep candidates informed

---

## 🔧 Technical Details

### Database Structure

**Collections:**
1. **applications**
   ```typescript
   {
     id: "app_123",
     jobId: "job_456",
     companyId: "comp_789",
     fullName: "John Doe",
     email: "john@email.com",
     whatsapp: "+628123456789",
     cvUrl: "https://storage.../cv.pdf",
     status: "Pending",
     sessionId: "session_abc",
     appliedAt: "2025-12-03T10:00:00Z"
   }
   ```

2. **interview_sessions**
   ```typescript
   {
     id: "session_abc",
     candidate: {
       id: "app_123",
       name: "John Doe",
       email: "john@email.com",
       role: "Applicant"
     },
     date: "2025-12-03T10:00:00Z",
     status: "pending_review",
     companyId: "comp_789",
     source: "job_application",
     jobId: "job_456",
     applicationId: "app_123",
     cvUrl: "https://storage.../cv.pdf",
     whatsapp: "+628123456789",
     transcript: [
       {
         speaker: "ai",
         text: "Aplikasi diterima dari John Doe via Job Portal..."
       }
     ]
   }
   ```

### Auto-Creation Flow

```typescript
// services/firebase.ts

export const createApplication = async (data) => {
  // 1. Create application document
  const appRef = await addDoc(collection(db, 'applications'), data);

  // 2. Auto-create interview session
  const sessionId = await createInterviewSessionFromApplication(
    appRef.id,
    data
  );

  // 3. Link session to application
  await updateDoc(appRef, { sessionId });

  return appRef.id;
};
```

### Query Optimization

Dashboard uses optimized queries:
```typescript
// Only fetch sessions from job applications
const sessionsQuery = query(
  collection(db, 'interview_sessions'),
  where('companyId', '==', companyId),
  where('source', '==', 'job_application'),
  orderBy('date', 'desc')
);
```

---

## 📱 Mobile Responsive

Dashboard responsive untuk:
- ✅ Desktop (1920px+)
- ✅ Laptop (1280px - 1920px)
- ✅ Tablet (768px - 1280px)
- ⚠️ Mobile (< 768px) → Sidebar collapses

**Note:** Best experience pada Desktop/Laptop untuk HR operations.

---

## 🎯 Success Metrics

Track effectiveness with:
1. **Application Response Time** → Time between submit & first contact
2. **Conversion Rate** → Applications → Interviews → Hired
3. **Filter Usage** → Most used filters (position vs status)
4. **Action Clicks** → CV downloads vs Detail views

---

## 🐛 Troubleshooting

### Issue 1: No Applications Showing

**Possible Causes:**
- No submissions yet
- Wrong company filter
- Firestore query error

**Solution:**
1. Check Firestore Console → `interview_sessions` collection
2. Verify `source: "job_application"` field exists
3. Check browser console for errors

---

### Issue 2: CV Download Not Working

**Possible Causes:**
- Firebase Storage CORS issue
- Storage rules not deployed
- Invalid CV URL

**Solution:**
1. Check Storage rules deployed: `firebase deploy --only storage`
2. Verify CORS configured in Google Cloud Console
3. Check `cvUrl` field in Firestore document

---

### Issue 3: Cannot View Detail

**Possible Causes:**
- Session not found
- Missing sessionId in application
- Navigation state error

**Solution:**
1. Check `sessionId` field in application document
2. Verify session exists in `interview_sessions` collection
3. Check browser console for navigation errors

---

## 🚀 Future Enhancements

Planned features:
- [ ] Bulk actions (Shortlist multiple, Send email blast)
- [ ] Export candidates to CSV/Excel
- [ ] Advanced filters (date range, qualification match)
- [ ] Status transition automation (Email on status change)
- [ ] Candidate scoring/ranking
- [ ] Interview scheduling integration
- [ ] Automated screening questions before AI interview

---

## 📞 Support

**Questions?**
- Check Firestore Console for data verification
- Browser Console for frontend errors
- Firebase Functions logs for backend issues

**Need Help?**
- Review this guide
- Check code comments in `JobApplicationsView.tsx`
- Contact dev team

---

## ✅ Quick Start Checklist

For HR Team:
- [ ] Login to FraudGuard
- [ ] Navigate to **"Aplikasi Lowongan"** in sidebar
- [ ] Verify dashboard loads applications
- [ ] Test filter by position
- [ ] Test filter by status
- [ ] Click "CV" to download CV
- [ ] Click "Detail" to view interview session
- [ ] Test email & WhatsApp links
- [ ] Verify no errors in browser console

For Admin/Dev:
- [ ] Storage rules deployed
- [ ] CORS configured
- [ ] Firestore indexes created (if needed)
- [ ] Test job submission flow end-to-end
- [ ] Verify auto-session creation works
- [ ] Monitor Firebase usage/quotas

---

## 🎉 Summary

**What Changed:**
1. ✅ Auto-create interview sessions from job applications
2. ✅ New "Aplikasi Lowongan" menu in sidebar
3. ✅ HR-friendly dashboard with filters & actions
4. ✅ One-click access to CV, email, WhatsApp
5. ✅ Seamless integration with existing interview system

**Benefits:**
- ⚡ Faster candidate processing
- 📊 Centralized application management
- 🎯 Better candidate tracking
- 💼 Professional recruitment workflow
- 🚀 Improved HR productivity

**Next Steps:**
1. Test the complete flow (candidate submit → HR view)
2. Train HR team on new dashboard
3. Monitor usage & gather feedback
4. Plan future enhancements

---

**Happy Recruiting! 🎊**
