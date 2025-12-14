/**
 * FIREBASE DATA SEEDER
 * Script to populate Firebase with sample data for testing SuperAdmin Dashboard
 * 
 * Usage:
 * 1. Make sure you're in the project root
 * 2. Run: node scripts/seedFirebaseData.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (menggunakan existing service account)
// Pastikan GOOGLE_APPLICATION_CREDENTIALS sudah di-set atau gunakan serviceAccountKey.json

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

// Sample Data
const sampleCompanies = [
    {
        name: "PT Teknologi Maju",
        adminEmail: "admin@teknologimaju.com",
        tier: "Enterprise",
        status: "Active",
        credits: 5000,
        creditsUsed: 3500,
        joinedDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15T08:00:00Z')),
        usersCount: 25,
        lastActivity: admin.firestore.Timestamp.fromDate(new Date('2024-12-14T10:00:00Z'))
    },
    {
        name: "PT Digital Solutions",
        adminEmail: "hr@digitalsolutions.id",
        tier: "Premium",
        status: "Active",
        credits: 2000,
        creditsUsed: 1200,
        joinedDate: admin.firestore.Timestamp.fromDate(new Date('2024-03-20T09:30:00Z')),
        usersCount: 15,
        lastActivity: admin.firestore.Timestamp.fromDate(new Date('2024-12-13T15:00:00Z'))
    },
    {
        name: "PT Inovasi Bisnis",
        adminEmail: "contact@inovasibisnis.com",
        tier: "Basic",
        status: "Active",
        credits: 500,
        creditsUsed: 300,
        joinedDate: admin.firestore.Timestamp.fromDate(new Date('2024-06-10T10:00:00Z')),
        usersCount: 8,
        lastActivity: admin.firestore.Timestamp.fromDate(new Date('2024-12-12T11:00:00Z'))
    },
    {
        name: "PT Startup Indonesia",
        adminEmail: "team@startupid.com",
        tier: "Freemium",
        status: "Active",
        credits: 100,
        creditsUsed: 80,
        joinedDate: admin.firestore.Timestamp.fromDate(new Date('2024-11-01T14:00:00Z')),
        usersCount: 3,
        lastActivity: admin.firestore.Timestamp.fromDate(new Date('2024-12-14T09:00:00Z'))
    },
    {
        name: "PT Global Tech",
        adminEmail: "hr@globaltech.co.id",
        tier: "Premium",
        status: "Suspended",
        credits: 1000,
        creditsUsed: 800,
        joinedDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-28T11:00:00Z')),
        usersCount: 12,
        lastActivity: admin.firestore.Timestamp.fromDate(new Date('2024-12-10T16:00:00Z'))
    }
];

async function seedData() {
    try {
        console.log('🚀 Starting Firebase data seeding...\n');

        // 1. Create Companies
        console.log('📊 Creating companies...');
        const companyIds = [];

        for (const company of sampleCompanies) {
            const docRef = await db.collection('companies').add(company);
            companyIds.push(docRef.id);
            console.log(`✅ Created company: ${company.name} (ID: ${docRef.id})`);
        }

        console.log(`\n✅ Created ${companyIds.length} companies\n`);

        // 2. Create Payment Transactions
        console.log('💰 Creating payment transactions...');

        const transactions = [
            {
                companyId: companyIds[0],
                amount: 5000000,
                status: 'success',
                method: 'xendit',
                timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-12-01T10:00:00Z')),
                invoiceId: 'INV-2024-001'
            },
            {
                companyId: companyIds[1],
                amount: 2500000,
                status: 'success',
                method: 'xendit',
                timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-12-05T14:30:00Z')),
                invoiceId: 'INV-2024-002'
            },
            {
                companyId: companyIds[0],
                amount: 3000000,
                status: 'success',
                method: 'xendit',
                timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-12-10T09:15:00Z')),
                invoiceId: 'INV-2024-003'
            },
            {
                companyId: companyIds[2],
                amount: 1000000,
                status: 'success',
                method: 'xendit',
                timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-12-12T16:00:00Z')),
                invoiceId: 'INV-2024-004'
            },
            {
                companyId: companyIds[3],
                amount: 500000,
                status: 'pending',
                method: 'xendit',
                timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-12-14T08:00:00Z')),
                invoiceId: 'INV-2024-005'
            }
        ];

        for (const tx of transactions) {
            await db.collection('payment-transactions').add(tx);
            console.log(`✅ Created transaction: ${tx.invoiceId} - Rp ${tx.amount.toLocaleString()}`);
        }

        console.log(`\n✅ Created ${transactions.length} transactions\n`);

        // 3. Create Interview Sessions
        console.log('📝 Creating interview sessions...');

        const sessions = [
            {
                companyId: companyIds[0],
                candidateName: "Budi Santoso",
                candidateEmail: "budi.santoso@email.com",
                role: "Software Engineer",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-10T09:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-10T09:25:00Z')),
                fraudAnalysis: {
                    riskLevel: "Low",
                    scores: { pressure: 25, opportunity: 30, rationalization: 20 }
                },
                aiUsage: { gemini: 1500 },
                aiCost: { gemini: 1.5 },
                tokenUsage: { assessment: 1000, fraudAnalysis: 500 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[1],
                candidateName: "Siti Nurhaliza",
                candidateEmail: "siti.n@email.com",
                role: "Accountant",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-11T10:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-11T10:30:00Z')),
                fraudAnalysis: {
                    riskLevel: "Medium",
                    scores: { pressure: 55, opportunity: 50, rationalization: 45 }
                },
                aiUsage: { gemini: 1800, mistral: 2000 },
                aiCost: { gemini: 1.8, mistral: 3 },
                tokenUsage: { assessment: 1200, fraudAnalysis: 600, cvParsing: 2000 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[0],
                candidateName: "Ahmad Hidayat",
                candidateEmail: "ahmad.h@email.com",
                role: "Finance Manager",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-12T14:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-12T14:35:00Z')),
                fraudAnalysis: {
                    riskLevel: "High",
                    scores: { pressure: 75, opportunity: 80, rationalization: 70 }
                },
                aiUsage: { gemini: 2000 },
                aiCost: { gemini: 2 },
                tokenUsage: { assessment: 1500, fraudAnalysis: 500 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[2],
                candidateName: "Rina Wijaya",
                candidateEmail: "rina.w@email.com",
                role: "HR Specialist",
                status: "IN_PROGRESS",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-14T09:00:00Z'))
            },
            {
                companyId: companyIds[1],
                candidateName: "Doni Prasetyo",
                candidateEmail: "doni.p@email.com",
                role: "Sales Manager",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-13T11:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-13T11:20:00Z')),
                fraudAnalysis: {
                    riskLevel: "Low",
                    scores: { pressure: 30, opportunity: 25, rationalization: 28 }
                },
                aiUsage: { gemini: 1200, openai: 800 },
                aiCost: { gemini: 1.2, openai: 1.6 },
                tokenUsage: { assessment: 1000, fraudAnalysis: 1000 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            // Add 5 more sessions for better stats
            {
                companyId: companyIds[2],
                candidateName: "Lisa Permata",
                candidateEmail: "lisa.p@email.com",
                role: "Marketing Manager",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-09T13:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-09T13:22:00Z')),
                fraudAnalysis: {
                    riskLevel: "Low",
                    scores: { pressure: 22, opportunity: 28, rationalization: 25 }
                },
                aiUsage: { gemini: 1400 },
                aiCost: { gemini: 1.4 },
                tokenUsage: { assessment: 900, fraudAnalysis: 500 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[3],
                candidateName: "Rudi Hartono",
                candidateEmail: "rudi.h@email.com",
                role: "Data Analyst",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-08T15:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-08T15:28:00Z')),
                fraudAnalysis: {
                    riskLevel: "Medium",
                    scores: { pressure: 48, opportunity: 52, rationalization: 50 }
                },
                aiUsage: { gemini: 1600, mistral: 1800 },
                aiCost: { gemini: 1.6, mistral: 2.7 },
                tokenUsage: { assessment: 1100, fraudAnalysis: 500, cvParsing: 1800 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[0],
                candidateName: "Dewi Lestari",
                candidateEmail: "dewi.l@email.com",
                role: "Product Manager",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-07T10:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-07T10:18:00Z')),
                fraudAnalysis: {
                    riskLevel: "Low",
                    scores: { pressure: 20, opportunity: 22, rationalization: 18 }
                },
                aiUsage: { gemini: 1100 },
                aiCost: { gemini: 1.1 },
                tokenUsage: { assessment: 800, fraudAnalysis: 300 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[1],
                candidateName: "Eko Prasetyo",
                candidateEmail: "eko.p@email.com",
                role: "Operations Manager",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-06T14:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-06T14:32:00Z')),
                fraudAnalysis: {
                    riskLevel: "High",
                    scores: { pressure: 78, opportunity: 82, rationalization: 75 }
                },
                aiUsage: { gemini: 2200 },
                aiCost: { gemini: 2.2 },
                tokenUsage: { assessment: 1600, fraudAnalysis: 600 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            },
            {
                companyId: companyIds[2],
                candidateName: "Fitri Handayani",
                candidateEmail: "fitri.h@email.com",
                role: "Customer Success",
                status: "COMPLETED",
                createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-05T11:00:00Z')),
                completedAt: admin.firestore.Timestamp.fromDate(new Date('2024-12-05T11:24:00Z')),
                fraudAnalysis: {
                    riskLevel: "Medium",
                    scores: { pressure: 50, opportunity: 48, rationalization: 52 }
                },
                aiUsage: { gemini: 1500, openai: 700 },
                aiCost: { gemini: 1.5, openai: 1.4 },
                tokenUsage: { assessment: 1200, fraudAnalysis: 1000 },
                lastTokenUpdate: admin.firestore.Timestamp.now()
            }
        ];

        for (const session of sessions) {
            await db.collection('interview-sessions').add(session);
            console.log(`✅ Created session: ${session.candidateName} - ${session.role} (${session.status})`);
        }

        console.log(`\n✅ Created ${sessions.length} interview sessions\n`);

        console.log('🎉 Data seeding completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   - Companies: ${companyIds.length}`);
        console.log(`   - Transactions: ${transactions.length}`);
        console.log(`   - Interview Sessions: ${sessions.length}`);
        console.log('\n✅ You can now refresh the SuperAdmin Dashboard to see the data!');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}

// Run the seeder
seedData()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
