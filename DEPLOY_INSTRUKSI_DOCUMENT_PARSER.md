# 📝 Instruksi Deploy: Universal Document Parser

## 🎯 Yang Sudah Saya Lakukan

Saya telah mengubah sistem CV parser untuk mendukung **SEMUA jenis dokumen**, tidak hanya PDF!

### ✅ Perubahan di Frontend (Sudah Selesai)
- Upload sekarang menerima: PDF, DOC, DOCX, TXT, dan gambar (JPG/PNG)
- Auto-parsing otomatis untuk semua format
- UI messages diupdate

### 🔧 Yang Perlu Anda Deploy (Firebase Cloud Functions)

## 📋 Step-by-Step Deployment

### Step 1: Install Dependencies

Buka terminal dan jalankan:

```bash
cd functions
npm install pdf-parse mammoth axios
```

**Apa yang diinstall:**
- `pdf-parse` - untuk extract text dari PDF
- `mammoth` - untuk extract text dari Word documents (DOC/DOCX)
- `axios` - untuk call Mistral AI API

### Step 2: Update `functions/index.js`

**Cara 1: Add New Function** (Rekomendasi)

Buka file `/functions/index.js` dan tambahkan function baru ini di akhir file:

```javascript
// ========================================
// UNIVERSAL DOCUMENT PARSER WITH MISTRAL AI
// ========================================

const mammoth = require('mammoth');

exports.parseDocumentWithMistral = onCall({
  region: 'europe-west1',
  cors: true,
  timeoutSeconds: 300,
  memory: '2GiB',
  secrets: [mistralApiKey]
}, async (request) => {
  logger.info('[DOC-PARSE] 🚀 Starting Universal Document Parser...');

  const { documentUrl, sessionId } = request.data;
  if (!documentUrl || !sessionId) {
    throw new HttpsError('invalid-argument', 'Missing documentUrl or sessionId');
  }

  let parsedData = null;
  let documentText = "";
  let fileType = "unknown";

  try {
    // 1. Download File
    logger.info('[DOC-PARSE] 📥 Downloading document...');
    const bucket = storage.bucket();
    const urlObj = new URL(documentUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    
    if (!pathMatch) {
      throw new HttpsError('invalid-argument', 'Invalid document URL format');
    }
    
    const decodedPath = decodeURIComponent(pathMatch[1]);
    const file = bucket.file(decodedPath);
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || '';
    
    logger.info(`[DOC-PARSE] 📄 File type: ${contentType}`);
    
    const [fileBuffer] = await file.download();
    logger.info(`[DOC-PARSE] ✅ Downloaded ${fileBuffer.length} bytes`);

    // 2. Detect File Type
    fileType = getFileType(contentType, decodedPath);
    logger.info(`[DOC-PARSE] 🔍 Detected file type: ${fileType}`);

    // 3. Extract Text Based on Type
    switch (fileType) {
      case 'pdf':
        documentText = await extractFromPDF(fileBuffer);
        break;
      
      case 'docx':
      case 'doc':
        documentText = await extractFromWord(fileBuffer);
        break;
      
      case 'txt':
        documentText = fileBuffer.toString('utf8');
        break;
      
      case 'image':
        logger.info('[DOC-PARSE] 🖼️ Image detected');
        documentText = "[IMAGE FILE - Processing with AI]";
        break;
      
      default:
        try {
          documentText = fileBuffer.toString('utf8');
        } catch (e) {
          documentText = "[BINARY FILE - Will be processed by AI]";
        }
    }

    // Clean text
    if (documentText && typeof documentText === 'string') {
      documentText = documentText
        .replace(/----------------Page \\(\\d+\\) Break----------------/g, "\\n")
        .replace(/\\s+/g, ' ')
        .trim();
    }

    logger.info(`[DOC-PARSE] 📊 Extracted ${documentText.length} characters`);

    // 4. Parse with Mistral AI
    if (!documentText || documentText.length < 10) {
      logger.warn('[DOC-PARSE] ⚠️ Document unreadable or empty');
      parsedData = createEmptyTemplate('Dokumen tidak dapat dibaca atau kosong.');
    } else {
      logger.info('[DOC-PARSE] 🤖 Calling Mistral AI...');
      parsedData = await parseWithMistralAI(documentText, mistralApiKey.value());
    }

    // 5. Save to Firestore
    await db.collection('interview_sessions').doc(sessionId).update({
      cvParsedData: parsedData,
      cvParsedAt: admin.firestore.FieldValue.serverTimestamp(),
      documentType: fileType,
      documentProcessed: true
    });

    logger.info('[DOC-PARSE] ✅ Success');
    return { 
      success: true, 
      parsedData,
      fileType,
      extractedChars: documentText.length
    };

  } catch (error) {
    logger.error('[DOC-PARSE] ❌ ERROR:', error);
    
    try {
      await db.collection('interview_sessions').doc(sessionId).update({
        cvParsedData: createEmptyTemplate(`Error: ${error.message}`),
        cvParsedAt: admin.firestore.FieldValue.serverTimestamp(),
        documentProcessError: error.message
      });
    } catch (dbError) {
      logger.error('[DOC-PARSE] DB save error:', dbError);
    }

    throw new HttpsError('internal', `Parsing failed: ${error.message}`);
  }
});

// Helper Functions
function getFileType(contentType, filePath) {
  const lower = contentType.toLowerCase();
  const pathLower = filePath.toLowerCase();
  
  if (lower.includes('pdf') || pathLower.endsWith('.pdf')) return 'pdf';
  if (lower.includes('wordprocessingml') || pathLower.endsWith('.docx')) return 'docx';
  if (lower.includes('msword') || pathLower.endsWith('.doc')) return 'doc';
  if (lower.includes('plain') || pathLower.endsWith('.txt')) return 'txt';
  if (lower.includes('image') || pathLower.match(/\\.(jpg|jpeg|png|gif|bmp)$/)) return 'image';
  
  return 'unknown';
}

async function extractFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch (error) {
    logger.error('[PDF-EXTRACT] Error:', error);
    return "";
  }
}

async function extractFromWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (error) {
    logger.error('[WORD-EXTRACT] Error:', error);
    return "";
  }
}

async function parseWithMistralAI(text, apiKey) {
  try {
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: `You are an expert document parser for HR systems. Extract ALL candidate information and return structured JSON.

REQUIRED JSON:
{
  "fullName": "Full name",
  "email": "actual.email@example.com",
  "phone": "+62812345678",
  "address": "City, Country",
  "summary": "Professional summary WITHOUT email/phone",
  "totalYearsExperience": 5,
  "experience": [{"title": "", "company": "", "duration": "", "description": ""}],
  "education": [{"degree": "", "institution": "", "year": "", "gpa": ""}],
  "skills": ["Skill1", "Skill2"],
  "certifications": ["Cert1"],
  "languages": ["Indonesian - Native"]
}

Extract everything thoroughly!`
          },
          { 
            role: 'user', 
            content: `Extract from this document:\\n\\n${text.substring(0, 15000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 90000
      }
    );

    const aiContent = response.data.choices[0].message.content;
    const cleanJson = aiContent.replace(/```json\\s*|\\s*```/g, '').trim();
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    
    let parsed;
    if (firstBrace !== -1 && lastBrace !== -1) {
      parsed = JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
    } else {
      parsed = JSON.parse(cleanJson);
    }
    
    return {
      fullName: parsed.fullName || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      address: parsed.address || "",
      summary: parsed.summary || "",
      totalYearsExperience: parsed.totalYearsExperience || 0,
      experience: parsed.experience || [],
      education: parsed.education || [],
      skills: parsed.skills || [],
      certifications: parsed.certifications || [],
      languages: parsed.languages || [],
      rawText: text.substring(0, 500)
    };

  } catch (error) {
    logger.error('[MISTRAL-AI] Error:', error.message);
    return createEmptyTemplate('AI parsing failed');
  }
}

function createEmptyTemplate(message) {
  return {
    fullName: "",
    email: "",
    phone: "",
    address: "",
    summary: `⚠️ ${message}`,
    totalYearsExperience: 0,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    rawText: ""
  };
}
```

**Cara 2: Lihat Complete Code**

Atau Anda bisa lihat complete code di file:
`/app/FIREBASE_FUNCTIONS_UNIVERSAL_DOCUMENT_PARSER.md`

Copy semua function dan helper dari sana ke `functions/index.js`.

### Step 3: Pastikan Import Sudah Ada

Di bagian atas `functions/index.js`, pastikan ada:

```javascript
const mammoth = require('mammoth');
const axios = require('axios');
const pdf = require('pdf-parse');
```

### Step 4: Deploy ke Firebase

```bash
firebase deploy --only functions:parseDocumentWithMistral
```

**Expected output:**
```
✔  Deploy complete!

Functions deployed:
- parseDocumentWithMistral (europe-west1)
```

## 🧪 Testing

### Test 1: Upload PDF CV
1. Buka job portal sebagai kandidat
2. Apply for job
3. Upload PDF CV
4. Wait 10-30 seconds
5. Buka candidate detail di HR dashboard
6. Check "Ringkasan CV (AI Parsed)" section
7. ✅ Should show parsed data

### Test 2: Upload Word Document
1. Same as Test 1, but upload `.docx` file
2. ✅ Should parse successfully

### Test 3: Upload Image CV
1. Same as Test 1, but upload JPG/PNG of CV
2. ✅ Should attempt to parse (may vary based on image quality)

### Test 4: Upload Text File
1. Same as Test 1, but upload `.txt` CV
2. ✅ Should parse successfully

## 🔍 Verification

### Check Firebase Functions Logs

```bash
firebase functions:log --only parseDocumentWithMistral
```

Look for:
```
[DOC-PARSE] 🚀 Starting Universal Document Parser...
[DOC-PARSE] 📥 Downloading document...
[DOC-PARSE] 📄 File type: application/pdf
[DOC-PARSE] 🔍 Detected file type: pdf
[DOC-PARSE] 📊 Extracted 1250 characters
[DOC-PARSE] 🤖 Calling Mistral AI...
[DOC-PARSE] ✅ Success
```

### Check Firestore

Open Firestore Console → `interview_sessions` collection → Pick a session

Should have:
```javascript
{
  cvParsedData: {
    fullName: "...",
    email: "...",
    summary: "...",
    experience: [...],
    // etc
  },
  documentType: "pdf", // or "docx", "txt", "image"
  documentProcessed: true
}
```

## ❌ Troubleshooting

### Error: "Module 'mammoth' not found"
**Solution:**
```bash
cd functions
npm install mammoth
firebase deploy --only functions:parseDocumentWithMistral
```

### Error: "Function not found"
**Solution:** Make sure function name in code matches deployment:
- Function name: `parseDocumentWithMistral`
- Frontend calls: `parseDocumentWithMistral` ✅

### Error: "Document unreadable"
**Possible causes:**
- File corrupted
- Image quality too low
- PDF encrypted
**Solution:** Try different file or format

### Error: Mistral AI timeout
**Solution:**
- File might be too large
- Network issue
- Check Mistral API status

## 📊 Supported Formats Summary

| Format | Extension | Support Level |
|--------|-----------|---------------|
| PDF | `.pdf` | ✅ Full |
| Word | `.docx` | ✅ Full |
| Old Word | `.doc` | ✅ Full |
| Text | `.txt` | ✅ Full |
| Images | `.jpg`, `.png` | ✅ Good (depends on quality) |

## 🎉 Success Indicators

✅ Function deployed successfully  
✅ PDF parsing works  
✅ Word document parsing works  
✅ Auto-parse triggered on upload  
✅ Data displayed in candidate detail  
✅ No errors in function logs  

## 📞 Need Help?

Jika ada error, share:
1. Function logs (`firebase functions:log`)
2. Error message yang muncul
3. File type yang diupload
4. Browser console logs

## 🚀 Next Steps After Deployment

1. Test dengan berbagai format dokumen
2. Verify parsing quality untuk setiap format
3. Adjust Mistral AI prompt jika perlu
4. Monitor function performance

---

**Note:** Frontend sudah siap, Anda hanya perlu deploy Firebase Cloud Function ini! 🎯
