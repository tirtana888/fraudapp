# Professional Candidate Table - Kandidat → Otomatis 📊

## ✅ **TABLE LAYOUT SELESAI!**

### **Before vs After**

**BEFORE (Card Grid):**
```
┌────────────┐  ┌────────────┐
│ John Doe   │  │ Jane Smith │
│ Risk: Low  │  │ Risk: Med  │
│ Score: 85  │  │ Score: 65  │
│ [Detail]   │  │ [Detail]   │
└────────────┘  └────────────┘
```

**AFTER (Professional Table):**
```
┌──────────────────────────────────────────────────────────────────────┐
│ CANDIDATE        │ APPLIED FOR      │ STAGE        │ RISK   │ ACTION│
├──────────────────────────────────────────────────────────────────────┤
│ 🔷 John Doe      │ Marketing Mgr    │ Integrity   │ 🟢 85  │ [View]│
│    john@mail.com │ Jakarta          │ Check       │        │       │
├──────────────────────────────────────────────────────────────────────┤
│ 🔷 Jane Smith    │ Sales Executive  │ Awaiting    │ 🟡 65  │ [View]│
│    jane@mail.com │ Bandung          │ Review      │        │       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 **Table Structure**

### **Column 1: Candidate** (40% width)
```
┌───────────────────────────┐
│  🔷  John Doe             │
│      john.doe@email.com   │
└───────────────────────────┘
```

**Components:**
- ✅ **Avatar** - Gradient circle dengan initials (JD)
  - Colors: `from-brand-orange to-brand-blue`
  - Size: 40x40px
  - Font: Bold, white text
- ✅ **Name** - Bold, primary color
- ✅ **Email** - Small, secondary color

---

### **Column 2: Applied For** (25% width)
```
┌───────────────────────┐
│  Marketing Manager    │
│  📍 Jakarta           │
└───────────────────────┘
```

**Components:**
- ✅ **Job Title** - Bold, primary color
- ✅ **Location** - Small, with icon

---

### **Column 3: Stage** (15% width)
```
┌────────────────────┐
│  Integrity Check   │
└────────────────────┘
```

**Badge Types:**
1. **Integrity Check** (Blue badge)
   - `status === 'completed' && hasAnalysis`
   - Color: Blue (`bg-blue-100 text-blue-700`)

2. **Awaiting Review** (Purple badge)
   - `status === 'completed' && !hasAnalysis`
   - Color: Purple (`bg-purple-100 text-purple-700`)

3. **In Progress** (Gray badge)
   - `status !== 'completed'`
   - Color: Gray (`bg-gray-100 text-gray-600`)

---

### **Column 4: Risk Score** (12% width)
```
┌──────────┐
│  🟢 85   │
└──────────┘
```

**Score Badges:**
- 🟢 **Low Risk (0-20)** - Green badge
- 🟡 **Medium Risk (21-50)** - Yellow badge
- 🔴 **High Risk (>50)** - Red badge

**Visual:**
```javascript
if (score <= 20) {
  return "🟢 {score}" // Green
} else if (score <= 50) {
  return "🟡 {score}" // Yellow
} else {
  return "🔴 {score}" // Red
}
```

---

### **Column 5: Action** (8% width)
```
┌──────────┐
│  [View]  │
└──────────┘
```

**Button:**
- ✅ Orange background (`bg-brand-orange`)
- ✅ White text
- ✅ Eye icon
- ✅ Hover effect (`hover:bg-brand-orange/90`)
- ✅ Shadow (`shadow-sm`)

---

## 💻 **Implementation Details**

### **Helper Functions**

#### **1. getAvatarInitials()**
```typescript
const getAvatarInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Example:
// "John Doe" → "JD"
// "Jane Mary Smith" → "JM"
```

#### **2. getRiskScoreBadge()**
```typescript
const getRiskScoreBadge = (score: number) => {
  if (score <= 20) {
    return <span className="...green...">🟢 {score}</span>;
  } else if (score <= 50) {
    return <span className="...yellow...">🟡 {score}</span>;
  } else {
    return <span className="...red...">🔴 {score}</span>;
  }
};
```

#### **3. getStageBadge()**
```typescript
const getStageBadge = (status: string, hasAnalysis: boolean) => {
  if (status === 'completed' && hasAnalysis) {
    return <span className="...blue...">Integrity Check</span>;
  } else if (status === 'completed') {
    return <span className="...purple...">Awaiting Review</span>;
  } else {
    return <span className="...gray...">In Progress</span>;
  }
};
```

---

## 🎨 **Styling Details**

### **Table Container:**
```css
bg-white dark:bg-brand-slate-850
rounded-xl
border border-gray-200 dark:border-slate-700
overflow-hidden
shadow-sm
```

### **Table Header:**
```css
bg-gray-50 dark:bg-slate-800
border-b border-gray-200 dark:border-slate-700
text-xs font-bold uppercase tracking-wider
text-gray-600 dark:text-gray-300
px-6 py-4
```

### **Table Rows:**
```css
hover:bg-gray-50 dark:hover:bg-slate-800/50
transition-colors
divide-y divide-gray-200 dark:divide-slate-700
```

### **Avatar:**
```css
w-10 h-10
rounded-full
bg-gradient-to-br from-brand-orange to-brand-blue
flex items-center justify-center
text-white font-bold text-sm
shadow-sm
```

---

## 📱 **Responsive Design**

### **Desktop (>= 768px):**
- ✅ Full table layout
- ✅ All columns visible
- ✅ Horizontal scroll if needed

### **Mobile (< 768px):**
- ✅ Horizontal scroll enabled
- ✅ Table maintains structure
- ✅ Fixed column widths prevent breaking

```tsx
<div className="overflow-x-auto">
  <table className="w-full">
    {/* Table content */}
  </table>
</div>
```

---

## 🔍 **Filter System**

Already implemented in previous version:

```tsx
<select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
  <option value="all">Semua Posisi</option>
  {jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
</select>

<select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
  <option value="all">Semua Risk Level</option>
  <option value="low">Low Risk</option>
  <option value="medium">Medium Risk</option>
  <option value="high">High Risk</option>
  <option value="critical">Critical Risk</option>
</select>
```

---

## ✅ **What's Working**

### **1. Professional Table Layout**
- ✅ Clean, enterprise-grade design
- ✅ Clear column headers
- ✅ Proper spacing & padding
- ✅ Hover states
- ✅ Dark mode support

### **2. Avatar System**
- ✅ Auto-generate initials from name
- ✅ Gradient background (orange to blue)
- ✅ Circular design
- ✅ Consistent sizing

### **3. Badge System**
- ✅ **Stage badges** - Blue/Purple/Gray
- ✅ **Risk score badges** - Green/Yellow/Red with emoji
- ✅ Rounded pills
- ✅ Color-coded for quick scanning

### **4. Action Button**
- ✅ Orange brand color
- ✅ Clear "View" label
- ✅ Eye icon
- ✅ Smooth hover effect

---

## 🎯 **User Experience**

### **Quick Scanning:**
1. **Avatar** - Instant visual identification
2. **Risk Score** - Color-coded for priority (🟢🟡🔴)
3. **Stage Badge** - Current status at a glance
4. **View Button** - Clear call-to-action

### **Information Hierarchy:**
```
Primary:   Candidate Name, Risk Score
Secondary: Job Title, Email
Tertiary:  Location, Stage Badge
Action:    View Button
```

---

## 📊 **Comparison**

| Feature | Card Layout | Table Layout |
|---------|-------------|--------------|
| Density | Low (2 per row) | High (all in view) |
| Scanning | Slow | Fast |
| Professional | Good | Excellent |
| Mobile | Better | Good (scroll) |
| Data Visibility | Limited | Complete |
| Enterprise Ready | No | ✅ Yes |

---

## 🚀 **Next Steps**

The table layout is **COMPLETE**! 

Untuk Case File Detail Page dengan tabs, saya perlu membuat component terpisah yang complex dengan:
1. Sticky header dengan action buttons
2. Navigation tabs
3. Two-column layout (CV viewer + Forensic results)
4. Multiple tab content views

Apakah Anda ingin saya lanjutkan membuat Candidate Detail Page sekarang?

---

**Table Professional Sudah Siap Digunakan! ✅**
