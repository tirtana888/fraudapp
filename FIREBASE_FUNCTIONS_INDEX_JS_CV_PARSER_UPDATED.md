# Firebase Cloud Functions - CV Parser Updated

## Update yang Dilakukan:

### 1. parseCVWithMistral Function
Sudah ada di code Anda, tapi pastikan outputnya detailed!

### 2. Improved Prompt untuk Mistral AI

Replace bagian prompt di fungsi `parseCVWithMistral` dengan yang ini:

```javascript
exports.parseCVWithMistral = onCall({
  region: 'europe-west1',
  cors: true,
  timeoutSeconds: 300,
  memory: '1GiB',
  secrets: [mistralApiKey]
}, async (request) => {
  logger.info('[PARSE-CV] Starting Process (Fail-Safe Mode)...');

  const { cvUrl, sessionId } = request.data;
  if (!cvUrl || !sessionId) throw new HttpsError('invalid-argument', 'Missing Args');

  let parsedData = null;
  let rawTextInfo = "";

  try {
    // 1. Download File
    const bucket = storage.bucket();
    const urlObj = new URL(cvUrl);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch) throw new HttpsError('invalid-argument', 'Invalid URL');
    
    const decodedPath = decodeURIComponent(pathMatch[1]);
    const file = bucket.file(decodedPath);
    const [fileBuffer] = await file.download();
    
    logger.info(`[PARSE-CV] Downloaded. Size: ${fileBuffer.length} bytes`);

    // 2. PDF Parsing (Menggunakan pdf-parse)
    let cvText = "";
    
    try {
        const data = await pdf(fileBuffer);
        cvText = data.text || "";
        logger.info(`[PARSE-CV] Extracted ${cvText.length} characters from PDF`);
    } catch (e) {
        logger.error('[PARSE-CV] PDF Parsing Error:', e);
        cvText = "";
    }

    // Bersihkan teks
    if (cvText) {
        cvText = cvText.replace(/----------------Page \(\d+\) Break----------------/g, "\n");
        cvText = cvText.trim();
    }
    
    rawTextInfo = cvText ? cvText.substring(0, 100) + "..." : "EMPTY/UNREADABLE";
    logger.info(`[PARSE-CV] Text Content: ${rawTextInfo}`);

    // --- SAFETY CHECKPOINT ---
    if (!cvText || cvText.trim().length < 10) {
        logger.warn("[PARSE-CV] PDF Unreadable/Empty. Returning empty template.");
        
        parsedData = {
            fullName: "",
            email: "",
            phone: "",
            address: "",
            summary: "⚠️ Gagal membaca CV secara otomatis. PDF mungkin berupa gambar/scan atau terenkripsi. Silakan baca CV manual.",
            experience: [],
            education: [],
            skills: [],
            certifications: [],
            languages: [],
            rawText: "UNREADABLE PDF"
        };
    } else {
        // 3. AI Extraction (IMPROVED PROMPT)
        logger.info("[PARSE-CV] Calling Mistral AI with improved prompt...");
        try {
            const response = await axios.post(
              'https://api.mistral.ai/v1/chat/completions',
              {
                model: 'mistral-large-latest',
                messages: [
                  {
                    role: 'system',
                    content: `You are an expert CV/Resume parser for HR professionals. Your task is to extract ALL relevant information from the CV text and return a comprehensive, structured JSON.

CRITICAL RULES:
1. Extract EVERYTHING - be thorough and detailed
2. PRESERVE contact information (email, phone) AS-IS in their fields - do NOT summarize or hide them
3. For summary field: Create a professional overview of the candidate WITHOUT including contact details (no email, no phone in summary)
4. Calculate total years of experience from all job durations
5. List education from newest to oldest
6. Extract ALL skills mentioned
7. If data is missing, use empty strings or empty arrays

REQUIRED JSON STRUCTURE:
{
  "fullName": "Full name of candidate",
  "email": "actual.email@example.com",  // ACTUAL EMAIL, not summarized
  "phone": "+62812345678",  // ACTUAL PHONE, not summarized
  "address": "City, Country",
  "summary": "Professional summary paragraph describing candidate's expertise, strengths, and career highlights. DO NOT include email or phone here. Focus on professional profile only.",
  "totalYearsExperience": 5,  // Calculate from all job durations
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "2020 - 2023 (3 tahun)",
      "description": "Detailed responsibilities and achievements"
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Computer Science",
      "institution": "University Name",
      "year": "2015 - 2019",
      "gpa": "3.8/4.0"  // if available
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],  // ALL skills
  "certifications": ["Cert 1", "Cert 2"],  // if any
  "languages": ["Indonesian - Native", "English - Fluent"]  // if mentioned
}

IMPORTANT FOR SUMMARY FIELD:
- Write 2-3 paragraphs describing the candidate professionally
- Include: career level, years of experience, key expertise areas, notable achievements
- DO NOT write: "Email: xxx" or "Phone: xxx" or "Contact: xxx" in summary
- Contact info goes in their dedicated fields only
- Example good summary: "Experienced software engineer with 5+ years in full-stack development. Proven track record in building scalable web applications using React and Node.js. Led multiple projects resulting in 40% performance improvements."

Extract everything accurately and be thorough!`
                  },
                  { role: 'user', content: `Extract all information from this CV:\n\n${cvText}` }
                ],
                temperature: 0.1,
                max_tokens: 3000  // Increased for detailed output
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${mistralApiKey.value()}`
                },
                timeout: 60000
              }
            );

            const aiContent = response.data.choices[0].message.content;
            
            // JSON Cleaning Logic
            const cleanJson = aiContent.replace(/```json\s*|\s*```/g, '').trim();
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1) {
                 parsedData = JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
            } else {
                 parsedData = JSON.parse(cleanJson);
            }
            
            // Ensure all required fields exist
            parsedData.fullName = parsedData.fullName || "";
            parsedData.email = parsedData.email || "";
            parsedData.phone = parsedData.phone || "";
            parsedData.address = parsedData.address || "";
            parsedData.summary = parsedData.summary || "";
            parsedData.experience = parsedData.experience || [];
            parsedData.education = parsedData.education || [];
            parsedData.skills = parsedData.skills || [];
            parsedData.certifications = parsedData.certifications || [];
            parsedData.languages = parsedData.languages || [];
            parsedData.rawText = cvText.substring(0, 500); // First 500 chars for reference
            
            logger.info('[PARSE-CV] ✅ AI parsing successful');

        } catch (aiError) {
            logger.error("[PARSE-CV] AI Error:", aiError.message);
            // Fallback jika AI gagal
            parsedData = {
                fullName: "",
                email: "",
                phone: "",
                address: "",
                summary: "⚠️ Gagal memproses dengan AI. Silakan review CV manual. Text berhasil diekstrak tapi tidak bisa diparse.",
                experience: [],
                education: [],
                skills: [],
                certifications: [],
                languages: [],
                rawText: cvText.substring(0, 500)
            };
        }
    }

    // 4. Save to Firestore
    await db.collection('interview_sessions').doc(sessionId).update({
      cvParsedData: parsedData,
      cvParsedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info('[PARSE-CV] ✅ Success - Data saved to Firestore');
    return { success: true, parsedData };

  } catch (error) {
    logger.error('[PARSE-CV] CRITICAL SYSTEM ERROR:', error);
    throw new HttpsError('internal', `System Error: ${error.message}`);
  }
});
```

## Key Improvements:

### 1. **Detailed Extraction Prompt**
- Extract EVERYTHING dari CV
- Thorough and comprehensive
- Calculate total years experience
- List ALL skills

### 2. **Email & Phone Preservation**
```javascript
// ✅ CORRECT - Email & phone in dedicated fields
{
  "email": "actual.email@domain.com",  // Real email
  "phone": "+62812345678",             // Real phone
  "summary": "Professional overview..."  // NO email/phone here
}

// ❌ WRONG - Don't do this
{
  "summary": "Email: xxx@gmail.com, Phone: +62xxx..."
}
```

### 3. **Professional Summary**
- 2-3 paragraphs describing candidate
- Includes: expertise, experience, achievements
- NO contact info in summary
- Contact info only in dedicated fields

### 4. **Better Error Handling**
- Fallback with helpful message
- Non-blocking for session creation
- Better logging

### 5. **More Fields**
```javascript
{
  "totalYearsExperience": 5,  // NEW: Auto-calculated
  "certifications": [...],     // More detailed
  "languages": [...],          // Language proficiency
  "gpa": "3.8/4.0"            // If available
}
```

## Testing:

1. Upload CV via job application
2. Wait 10-30 seconds
3. Open candidate detail page
4. Check "Ringkasan CV (AI Parsed)" section
5. Verify:
   - ✅ Summary shows professional overview (no email/phone)
   - ✅ Email & phone shown in header
   - ✅ Total years experience calculated
   - ✅ All skills listed
   - ✅ Education detailed
   - ✅ Work experience comprehensive

## Deploy Command:

```bash
firebase deploy --only functions:parseCVWithMistral
```

## Package.json Dependencies:

Ensure these are in `/functions/package.json`:

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "axios": "^1.6.0"
  }
}
```

If not, install:
```bash
cd functions
npm install pdf-parse axios
```

## Expected Output Example:

```json
{
  "fullName": "John Doe",
  "email": "john.doe@email.com",
  "phone": "+62812345678",
  "address": "Jakarta, Indonesia",
  "summary": "Experienced software engineer with 7+ years in full-stack development. Specialized in building scalable web applications using modern JavaScript frameworks. Led multiple projects from conception to deployment, resulting in 40% performance improvements and enhanced user experience. Strong background in agile methodologies and team leadership.",
  "totalYearsExperience": 7,
  "experience": [
    {
      "title": "Senior Software Engineer",
      "company": "Tech Corp Indonesia",
      "duration": "2020 - Present (4 tahun)",
      "description": "Lead development of enterprise SaaS platform. Managed team of 5 developers. Implemented microservices architecture reducing response time by 50%."
    },
    {
      "title": "Software Engineer",
      "company": "Startup XYZ",
      "duration": "2017 - 2020 (3 tahun)",
      "description": "Developed frontend applications using React and Redux. Collaborated with design team to implement pixel-perfect UI."
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Computer Science",
      "institution": "University of Indonesia",
      "year": "2013 - 2017",
      "gpa": "3.75/4.0"
    }
  ],
  "skills": [
    "JavaScript", "TypeScript", "React", "Node.js", "Python", 
    "MongoDB", "PostgreSQL", "AWS", "Docker", "Kubernetes",
    "Git", "Agile/Scrum", "Team Leadership"
  ],
  "certifications": [
    "AWS Certified Solutions Architect",
    "Google Cloud Professional"
  ],
  "languages": [
    "Indonesian - Native",
    "English - Fluent",
    "Mandarin - Basic"
  ]
}
```

This detailed output helps HR understand the candidate fully without reading the entire CV!
