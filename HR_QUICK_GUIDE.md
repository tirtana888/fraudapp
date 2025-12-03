# HR Quick Guide - Job Applications Dashboard

## 📍 Lokasi Menu

```
FraudGuard Dashboard
├─ 📊 Ringkasan Eksekutif
├─ 💼 Kelola Lowongan
├─ 👥 Aplikasi Lowongan ← **MENU BARU INI!**
├─ ✉️ Undang Kandidat
└─ ...
```

---

## 🎯 3 Actions Utama

### 1️⃣ Download CV
```
[📄 CV]  ← Klik ini untuk download/view CV kandidat
```

### 2️⃣ View Detail & Interview
```
[👁️ Detail]  ← Klik ini untuk:
                - Lihat profil lengkap
                - Mulai AI interview
                - Add notes
```

### 3️⃣ Kontak Kandidat
```
✉️ john@email.com     ← Klik untuk kirim email
📱 +62812-3456-7890   ← Klik untuk WhatsApp
```

---

## 🔍 Cara Filter

### Filter by Position
```
[Semua Posisi ▼]
  ├─ Software Engineer (5)
  ├─ Product Manager (3)
  └─ UI Designer (2)
```

### Filter by Status
```
[Semua Status ▼]
  ├─ Pending (8)      ← Aplikasi baru
  ├─ Reviewed (4)     ← Sudah dilihat
  ├─ Shortlisted (2)  ← Masuk shortlist
  └─ Rejected (1)     ← Ditolak
```

---

## 📊 Status Indicators

| Badge | Meaning | Action Required |
|-------|---------|-----------------|
| 🟡 Pending | Aplikasi baru | Review CV & contact |
| 🔵 Reviewed | Sudah direview | Schedule interview |
| 🟢 Shortlisted | Kandidat bagus | Process lebih lanjut |
| 🔴 Rejected | Ditolak | No action needed |

---

## ⚡ Workflow Cepat

### Scenario 1: Review Aplikasi Baru (5 menit)
```
1. Filter: [Pending]
2. Klik [CV] → Quick scan CV
3. Jika menarik:
   - Klik [Detail]
   - Start AI interview
4. Update status di Firestore (manual for now)
```

### Scenario 2: Shortlist Best Candidates
```
1. Filter: [Reviewed]
2. Compare CVs
3. Klik [Detail] untuk kandidat terbaik
4. Add detailed notes di interview session
5. Contact via WhatsApp untuk next step
```

### Scenario 3: Bulk Contact Candidates
```
1. Filter by Position
2. Collect emails from dashboard
3. Use email client untuk send bulk
   (Future: Built-in bulk email feature)
```

---

## 💡 Pro Tips

1. **Check Daily**
   - Aplikasi baru langsung muncul di top
   - Sort by date (newest first)

2. **Use Both Buttons**
   - CV → Quick screening
   - Detail → Deep dive interview

3. **Keep Notes**
   - Add notes di interview transcript
   - Track interview progress

4. **Fast Response**
   - WhatsApp = faster response
   - Email = more formal

5. **Filter Smart**
   - Position filter saat hiring spree
   - Status filter untuk follow-up

---

## 🚨 Common Questions

**Q: Aplikasi tidak muncul?**
A: Cek filter, pastikan "Semua Posisi" & "Semua Status"

**Q: CV tidak bisa download?**
A: Storage rules belum deploy. Contact admin.

**Q: Bagaimana update status?**
A: Manual via Firestore Console (Auto-update coming soon)

**Q: Bisa export ke Excel?**
A: Coming soon! For now, manual copy data.

---

## 📱 Mobile?

- **Desktop** ✅ Full features
- **Tablet** ✅ Good experience
- **Phone** ⚠️ Limited (sidebar collapsed)

**Recommendation:** Use desktop untuk HR operations.

---

## 🎯 Daily Routine

### Morning (9:00 AM)
```
□ Login FraudGuard
□ Check "Aplikasi Lowongan"
□ Filter: [Pending]
□ Review new applications (10-15 min)
```

### Midday (1:00 PM)
```
□ Follow up yesterday's reviews
□ Schedule interviews with shortlisted
□ Update status
```

### Afternoon (4:00 PM)
```
□ Final check for new applications
□ Send responses to candidates
□ Prepare tomorrow's interview list
```

---

## ✅ Quick Checklist

**Before Using:**
- [ ] Logged in to FraudGuard
- [ ] "Aplikasi Lowongan" menu visible
- [ ] Dashboard loads (no errors)

**Daily Tasks:**
- [ ] Check new applications
- [ ] Download & review CVs
- [ ] Contact promising candidates
- [ ] Update status

**Weekly Review:**
- [ ] Track response time
- [ ] Conversion rate (app → interview)
- [ ] Identify bottlenecks

---

**Need Help?** Check `JOB_APPLICATION_FLOW_GUIDE.md` for detailed documentation.

**Happy Hiring! 🚀**
