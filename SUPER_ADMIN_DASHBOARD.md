# 🎯 Super Admin Dashboard - HireGood.one

## Overview

Super Admin Dashboard adalah fitur analytics real-time yang memungkinkan super admin untuk memonitor kesehatan bisnis dan tren fraud detection berdasarkan **DATA REAL** dari Firestore, bukan dummy data.

## ✨ Features Implemented

### 1. Backend Aggregation (Cloud Function Trigger)
**File**: `functions/index.js`
**Function**: `updateGlobalStats`

Cloud Function yang berjalan otomatis setiap kali ada perubahan di collection `interview-sessions`.

#### Trigger Behavior:
- **Event**: `onDocumentWritten` pada `interview-sessions/{sessionId}`
- **Region**: `europe-west1`

#### Data yang Di-track:
- ✅ **Total Assessments** - Jumlah assessment yang dibuat
- ✅ **Completed Assessments** - Assessment yang selesai (status: completed)
- ✅ **Risk Distribution** - Distribusi High/Medium/Low risk
- ✅ **Email Usage** - Jumlah email yang terkirim
- ✅ **KYC Usage** - Jumlah background check yang dilakukan

#### How It Works:

```javascript
// Increment ketika assessment baru dibuat
if (!beforeData) {
  updates.total_assessments = (currentStats.total_assessments || 0) + 1;
}

// Increment ketika assessment selesai
if (!wasCompleted && isNowCompleted) {
  updates.completed_assessments = (currentStats.completed_assessments || 0) + 1;
}

// Track perubahan risk level
if (afterRisk && afterRisk !== beforeRisk) {
  riskDistribution[afterRisk] = (riskDistribution[afterRisk] || 0) + 1;
}
```

#### Data Structure (`stats/global_metrics`):

```javascript
{
  total_assessments: 150,
  completed_assessments: 120,
  email_usage: 95,
  kyc_usage: 45,
  risk_distribution: {
    High: 12,
    Medium: 45,
    Low: 63
  },
  last_updated: "2025-12-05T10:30:00Z"
}
```

---

### 2. Super Admin Dashboard UI
**File**: `components/SuperAdminDashboard.tsx`

Dashboard modern dengan brand color Orange (`#C25E00`) yang menampilkan real-time metrics.

#### UI Components:

##### A. Top Metrics Cards (4 Cards)

**1. Total Assessments**
- Live counter dari Firestore
- Menampilkan jumlah completed assessments
- Icon: Activity
- Color: Orange

**2. High Risk Detected**
- Jumlah kandidat high risk
- Persentase terhadap total completed
- Icon: AlertTriangle
- Color: Red

**3. Companies Onboarded**
- Total perusahaan yang terdaftar
- Icon: Building2
- Color: Blue

**4. Estimated Revenue**
- Kalkulasi: `completed_assessments × $50`
- Icon: TrendingUp
- Color: Green

##### B. Charts Section (2 Charts)

**1. Risk Distribution Pie Chart**
- Data: Low, Medium, High risk
- Colors:
  - Low: Green (`#10B981`)
  - Medium: Orange (`#F59E0B`)
  - High: Red (`#EF4444`)
- Library: Recharts

**2. System Usage Bar Chart**
- Metrics:
  - Email Sent
  - KYC Checks
  - High Risk Count
- Color: Brand Orange
- Library: Recharts

##### C. Recent Companies Table

Displays 5 most recent companies dengan informasi:
- Company Name & Email
- Tier Badge (Basic/Premium/Enterprise)
- Joined Date
- Status Badge (Active/Pending/Suspended)
- Candidate Count

**Table Features:**
- Zebra striping
- Hover effects
- Responsive design
- Loading states

---

### 3. Integration with Admin Panel
**File**: `components/AdminDashboard.tsx`

Super Admin Dashboard terintegrasi dengan admin panel melalui **tab system**.

#### Tab Navigation:
1. **Company Management** (Default)
   - Existing company management features
   - Invite companies
   - Manage subscriptions

2. **Analytics Dashboard** (New)
   - Super Admin Dashboard
   - Real-time metrics
   - Charts & analytics

#### Implementation:

```typescript
const [activeTab, setActiveTab] = useState<'management' | 'analytics'>('management');

// Tab switching
<button onClick={() => setActiveTab('analytics')}>
  <BarChart3 /> Analytics Dashboard
</button>

// Conditional rendering
{activeTab === 'analytics' ? (
  <SuperAdminDashboard />
) : (
  <>{/* Existing company management UI */}</>
)}
```

---

## 🔄 Real-Time Data Flow

```
1. User melakukan assessment
   ↓
2. Session document di Firestore berubah
   ↓
3. Cloud Function "updateGlobalStats" triggered
   ↓
4. Stats document updated di "stats/global_metrics"
   ↓
5. Frontend listening via onSnapshot
   ↓
6. Dashboard UI auto-update (real-time)
```

---

## 📊 Data Sources

### Primary Data Source:
**Firestore Collection**: `stats/global_metrics`
- Real-time listener: `onSnapshot`
- Auto-updates when triggered by backend

### Secondary Data Source:
**Firestore Collection**: `companies`
- Query: `orderBy('joinedDate', 'desc').limit(5)`
- Fetched once on component mount

---

## 🎨 Design Specifications

### Brand Colors:
- **Primary Orange**: `#C25E00`
- **Chart Colors**:
  - High Risk: `#EF4444` (Red)
  - Medium Risk: `#F59E0B` (Orange)
  - Low Risk: `#10B981` (Green)

### Typography:
- **Headers**: Bold, 3xl
- **Metrics**: Extrabold, 3xl
- **Labels**: Small, gray-600

### Spacing:
- **Card Padding**: 6 (1.5rem)
- **Grid Gap**: 6 (1.5rem)
- **Section Margin**: 8 (2rem)

### Responsive:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 4 columns (metrics), 2 columns (charts)

---

## 🚀 Deployment

### Step 1: Deploy Cloud Function

```bash
# Deploy the stats aggregation trigger
firebase deploy --only functions:updateGlobalStats
```

### Step 2: Initialize Stats Document

If `stats/global_metrics` doesn't exist, it will be auto-created on first assessment. Or manually create:

```javascript
// In Firestore Console
Collection: stats
Document: global_metrics
Data: {
  total_assessments: 0,
  completed_assessments: 0,
  email_usage: 0,
  kyc_usage: 0,
  risk_distribution: {
    High: 0,
    Medium: 0,
    Low: 0
  },
  last_updated: "2025-12-05T00:00:00Z"
}
```

### Step 3: Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

---

## 🔍 Testing

### Manual Testing Steps:

1. **Access Dashboard**
   ```
   Login as admin → Navigate to Admin Panel → Click "Analytics Dashboard" tab
   ```

2. **Verify Real-Time Updates**
   - Create a new assessment
   - Complete an assessment
   - Check if metrics auto-update

3. **Test Charts**
   - Verify pie chart shows correct risk distribution
   - Verify bar chart shows email/KYC usage

4. **Test Companies Table**
   - Verify 5 most recent companies displayed
   - Check badges (tier, status) render correctly

### Expected Behavior:

✅ Dashboard loads without errors
✅ Metrics show real numbers from Firestore
✅ Charts render when data available
✅ Empty states show when no data
✅ Loading states appear during fetch
✅ Real-time updates when data changes

---

## 📈 Monitoring

### Cloud Function Logs

```bash
# View function execution logs
firebase functions:log --only updateGlobalStats

# Expected logs:
[STATS] New assessment created
[STATS] Assessment completed
[STATS] Risk level changed: null -> High
[STATS] Global metrics updated
```

### Frontend Console

Open browser DevTools and check for:
- Firestore connection logs
- Real-time listener updates
- Chart rendering logs

---

## 🐛 Troubleshooting

### Issue 1: Dashboard Shows All Zeros

**Cause**: No stats data in Firestore
**Solution**:
```bash
# Create some test assessments
# Or manually initialize stats document
```

### Issue 2: Charts Not Rendering

**Cause**: No risk data available yet
**Solution**:
- Check `risk_distribution` in Firestore
- Complete some assessments with fraud analysis
- Verify `fraudAnalysis.riskLevel` exists in sessions

### Issue 3: Real-Time Not Working

**Cause**: Firestore listener not connected
**Solution**:
```javascript
// Check browser console for errors
// Verify Firestore rules allow read access
// Check network tab for WebSocket connection
```

### Issue 4: Companies Table Empty

**Cause**: No companies in Firestore
**Solution**:
- Invite companies via Company Management tab
- Check `companies` collection in Firestore

---

## 🔒 Security Considerations

### Firestore Rules:

```javascript
// Only admins can read stats
match /stats/{document} {
  allow read: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// Only Cloud Functions can write stats
match /stats/{document} {
  allow write: if false; // Only backend can write
}
```

### Access Control:

Super Admin Dashboard currently accessible by all admins. To restrict to super admin only:

```typescript
// In AdminDashboard.tsx
const currentUser = auth.currentUser;
const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
const isSuperAdmin = userDoc.data()?.role === 'superadmin';

// Only show Analytics tab if super admin
{isSuperAdmin && (
  <button onClick={() => setActiveTab('analytics')}>
    Analytics Dashboard
  </button>
)}
```

---

## 📝 Future Enhancements

### Planned Features:
- [ ] Date range filter (last 7 days, 30 days, etc.)
- [ ] Export data to CSV/PDF
- [ ] Email alerts for high-risk spikes
- [ ] Comparison with previous period
- [ ] Drill-down to individual assessments
- [ ] Revenue breakdown by company tier
- [ ] Fraud trend prediction using ML

### Performance Optimizations:
- [ ] Cache stats data in localStorage
- [ ] Batch writes in Cloud Function
- [ ] Implement pagination for companies table
- [ ] Use Firestore aggregation queries (when available)

---

## 📚 Technical Stack

- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Firestore
- **Frontend**: React + TypeScript
- **UI Framework**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Real-time**: Firestore onSnapshot

---

## 🎉 Summary

Super Admin Dashboard sekarang live dengan:
✅ Real-time metrics dari Firestore
✅ Auto-aggregation via Cloud Function
✅ Beautiful charts dengan brand colors
✅ Responsive design
✅ No dummy data - 100% real data
✅ Integrated dengan existing admin panel

**Ready for production!** 🚀
