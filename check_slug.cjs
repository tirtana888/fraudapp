// Quick script to check companySlug field
const https = require('https');

const FIREBASE_API_KEY = "AIzaSyDy8aNvFa3syJAKnwIOZQaT87PI_GC8lmo";
const PROJECT_ID = "gen-lang-client-0226679970";
const SUPERADMIN_EMAIL = "superadmin@hiregood.com";
const SUPERADMIN_PASSWORD = "SuperAdmin123!";

console.log("🔍 Checking companySlug field in Firestore...\n");

// Step 1: Login to get ID token
function loginUser() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            email: SUPERADMIN_EMAIL,
            password: SUPERADMIN_PASSWORD,
            returnSecureToken: true
        });

        const options = {
            hostname: 'identitytoolkit.googleapis.com',
            port: 443,
            path: `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const response = JSON.parse(body);
                if (response.error) {
                    reject(response.error);
                } else {
                    console.log('✅ Login successful\n');
                    resolve(response);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Step 2: Query Firestore companies collection
function queryCompanies(authData) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'firestore.googleapis.com',
            port: 443,
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/companies`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authData.idToken}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    console.log('📋 Companies with companySlug field:\n');

                    if (response.documents) {
                        response.documents.forEach((doc, index) => {
                            const name = doc.fields?.name?.stringValue || 'No name';
                            const slug = doc.fields?.companySlug?.stringValue || 'NOT SET';
                            const id = doc.name.split('/').pop();

                            console.log(`${index + 1}. ${name}`);
                            console.log(`   ID: ${id}`);
                            console.log(`   companySlug: ${slug}`);
                            console.log('');
                        });
                    } else {
                        console.log('❌ No companies found');
                    }

                    resolve(response);
                } catch (error) {
                    console.error('Error:', error);
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function main() {
    try {
        const authData = await loginUser();
        await queryCompanies(authData);
    } catch (error) {
        console.error('❌ Error:', error.message || error);
    }
}

main();
