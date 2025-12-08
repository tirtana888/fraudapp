// ========================================
// UNIVERSAL DOCUMENT PARSER WITH MISTRAL AI
// Copy code ini ke functions/index.js
// ========================================

// Pastikan import ini ada di bagian atas index.js:
// const pdf = require('pdf-parse');
// const mammoth = require('mammoth');
// const axios = require('axios');

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
          logger.info('[DOC-PARSE] 📝 Read as plain text');
        } catch (e) {
          logger.warn('[DOC-PARSE] ⚠️ Cannot read as text');
          documentText = "[BINARY FILE]";
        }
    }

    // Clean text
    if (documentText && typeof documentText === 'string') {
      documentText = documentText
        .replace(/----------------Page \(\d+\) Break----------------/g, "\n")
        .replace(/\s+/g, ' ')
        .trim();
    }

    logger.info(`[DOC-PARSE] 📊 Extracted ${documentText.length} characters`);

    // 4. Parse with Mistral AI
    if (!documentText || documentText.length < 10) {
      logger.warn('[DOC-PARSE] ⚠️ Document unreadable or empty');
      parsedData = createEmptyTemplate('Dokumen tidak dapat dibaca. Format file mungkin tidak didukung atau file rusak.');
    } else {
      logger.info('[DOC-PARSE] 🤖 Calling Mistral AI for intelligent extraction...');
      parsedData = await parseWithMistralAI(documentText, mistralApiKey.value());
    }

    // 5. Save to Firestore
    await db.collection('interview_sessions').doc(sessionId).update({
      cvParsedData: parsedData,
      cvParsedAt: admin.firestore.FieldValue.serverTimestamp(),
      documentType: fileType,
      documentProcessed: true
    });

    logger.info('[DOC-PARSE] ✅ Success - Data saved to Firestore');
    return { 
      success: true, 
      parsedData,
      fileType,
      extractedChars: documentText.length
    };

  } catch (error) {
    logger.error('[DOC-PARSE] ❌ ERROR:', error);
    
    // Save error info to session
    try {
      await db.collection('interview_sessions').doc(sessionId).update({
        cvParsedData: createEmptyTemplate(`Gagal memproses dokumen: ${error.message}`),
        cvParsedAt: admin.firestore.FieldValue.serverTimestamp(),
        documentProcessError: error.message
      });
    } catch (dbError) {
      logger.error('[DOC-PARSE] Failed to save error to DB:', dbError);
    }

    throw new HttpsError('internal', `Document parsing failed: ${error.message}`);
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

function getFileType(contentType, filePath) {
  const lower = contentType.toLowerCase();
  const pathLower = filePath.toLowerCase();
  
  if (lower.includes('pdf') || pathLower.endsWith('.pdf')) return 'pdf';
  if (lower.includes('wordprocessingml') || pathLower.endsWith('.docx')) return 'docx';
  if (lower.includes('msword') || pathLower.endsWith('.doc')) return 'doc';
  if (lower.includes('plain') || pathLower.endsWith('.txt')) return 'txt';
  if (lower.includes('image') || pathLower.match(/\.(jpg|jpeg|png|gif|bmp)$/)) return 'image';
  
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
            content: `You are an expert document parser and data extractor for HR systems. 

Your task: Extract ALL relevant candidate information from the provided document text and return structured JSON.

CRITICAL RULES:
1. Extract EVERYTHING comprehensively and thoroughly
2. PRESERVE contact information (email, phone) in dedicated fields
3. For summary: Write professional overview WITHOUT contact details
4. Calculate total years of experience accurately
5. List ALL skills, certifications, languages
6. If information is missing, use empty strings/arrays
7. Be intelligent - understand context and extract meaningful data

REQUIRED JSON STRUCTURE:
{
  "fullName": "Full name",
  "email": "actual.email@example.com",
  "phone": "+62812345678",
  "address": "City, Country",
  "summary": "Comprehensive professional summary WITHOUT email/phone. Include expertise, experience level, key strengths, achievements.",
  "totalYearsExperience": 5,
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
      "gpa": "3.8/4.0"
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": ["Cert 1", "Cert 2"],
  "languages": ["Indonesian - Native", "English - Fluent"]
}

Be thorough and extract everything!`
          },
          { 
            role: 'user', 
            content: `Extract all information from this document:\n\n${text.substring(0, 15000)}`
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
    
    // Clean JSON response
    const cleanJson = aiContent.replace(/```json\s*|\s*```/g, '').trim();
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    
    let parsed;
    if (firstBrace !== -1 && lastBrace !== -1) {
      parsed = JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
    } else {
      parsed = JSON.parse(cleanJson);
    }
    
    // Ensure all fields exist
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
    logger.error('[MISTRAL-AI] Parsing error:', error.message);
    return createEmptyTemplate('AI parsing gagal. Silakan review dokumen secara manual.');
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
