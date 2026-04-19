
import React from 'react';
import {
    BookOpen,
    Briefcase,
    Users,
    History,
    Settings,
    ClipboardCheck,
    ChevronDown,
    ChevronRight,
    Search,
    Lightbulb,
    CheckCircle2,
    AlertCircle,
    Mail,
    Link as LinkIcon,
    Upload,
    Eye,
    BarChart3,
    Globe
} from 'lucide-react';

export interface DocContent {
    id: string;
    subtitle: string;
    description: string;
    steps?: string[];
    tips?: string[];
    warnings?: string[];
}

export interface DocSection {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: DocContent[];
}

export const DOCUMENTATION_DATA: DocSection[] = [
    {
        id: 'jobs',
        title: 'Kelola Lowongan',
        icon: <Briefcase className="w-5 h-5" />,
        content: [
            {
                id: 'create-job',
                subtitle: 'Membuat Lowongan Baru',
                description: 'Cara membuat dan mempublikasikan lowongan pekerjaan baru di platform HireGood.',
                steps: [
                    'Klik tombol "Buat Lowongan Baru" di halaman Kelola Lowongan',
                    'Isi informasi lowongan: Judul, Lokasi, Tipe Pekerjaan (Full-time/Part-time/Contract/Internship)',
                    'Tulis deskripsi lengkap menggunakan rich text editor. Gunakan Bold untuk kata penting seperti "Requirements", "Responsibilities"',
                    'Aktifkan "Enable Instant Integrity Assessment" jika ingin kandidat langsung mengikuti AI assessment setelah melamar',
                    'Pilih status lowongan: Active atau Closed',
                    'Klik "Buat Lowongan" untuk mempublikasikan'
                ],
                tips: [
                    'Gunakan formatting (Bold, List) untuk membuat deskripsi lebih mudah dibaca',
                    'Aktifkan Auto-Screen untuk otomasi proses seleksi kandidat',
                    'Setiap lowongan memiliki URL unik yang bisa dibagikan langsung'
                ]
            },
            {
                id: 'manage-jobs',
                subtitle: 'Mengelola Lowongan Aktif',
                description: 'Cara mengedit, menonaktifkan, atau melihat detail lowongan yang sudah dibuat.',
                steps: [
                    'Di tabel lowongan, klik icon Edit (pensil) untuk mengubah detail lowongan',
                    'Klik icon Copy (salin) untuk menyalin link lowongan ke clipboard',
                    'Klik icon External Link untuk melihat tampilan publik lowongan',
                    'Ubah status menjadi "Closed" untuk menonaktifkan lowongan'
                ],
                tips: [
                    'Link lowongan tetap valid meskipun lowongan di-edit',
                    'Kandidat tidak bisa melamar ke lowongan dengan status "Closed"'
                ]
            },
            {
                id: 'career-page',
                subtitle: 'Laman Karir Perusahaan',
                description: 'Halaman khusus yang menampilkan semua lowongan aktif perusahaan dalam satu link.',
                steps: [
                    'Link laman karir otomatis tersedia di bagian atas halaman Kelola Lowongan',
                    'Klik "Salin Link" untuk menyalin URL laman karir',
                    'Klik "Preview" untuk melihat tampilan laman karir',
                    'Bagikan link ini di Bio Instagram, LinkedIn, atau website perusahaan'
                ],
                tips: [
                    'Laman karir otomatis menampilkan semua lowongan dengan status Active',
                    'Tambahkan logo perusahaan di Pengaturan → Profil Perusahaan untuk tampilan lebih profesional',
                    'Laman karir responsive dan mobile-friendly'
                ]
            }
        ]
    },
    {
        id: 'assessment',
        title: 'Link Assessment',
        icon: <ClipboardCheck className="w-5 h-5" />,
        content: [
            {
                id: 'how-it-works',
                subtitle: 'Cara Kerja Assessment',
                description: 'Platform HireGood menggunakan AI Integrity Assessment untuk screening kandidat secara otomatis.',
                steps: [
                    'Kandidat mengisi survei self-assessment (Fraud Triangle, Financial Strain, SJT Scenarios)',
                    'Kandidat melakukan wawancara AI singkat (10-15 menit)',
                    'Sistem menganalisis jawaban dan memberikan skor risiko integritas',
                    'HR mendapat laporan lengkap dengan rekomendasi'
                ]
            },
            {
                id: 'manual-invite',
                subtitle: 'Mengundang Kandidat (Manual Invite)',
                description: 'Cara mengundang kandidat secara manual untuk mengikuti assessment.',
                steps: [
                    'Buka menu "Kandidat" → Tab "Review & Invite"',
                    'Klik "Undang Kandidat" atau "Bulk Invite"',
                    'Isi data kandidat: Nama, Email, Posisi',
                    'Sistem akan generate kode akses unik dan mengirim email undangan',
                    'Kandidat menggunakan kode akses untuk memulai assessment'
                ],
                tips: [
                    'Satu kode akses hanya bisa digunakan sekali',
                    'Email undangan dikirim otomatis berisi link dan kode akses',
                    'Kandidat bisa mengakses assessment dari device apapun'
                ]
            },
            {
                id: 'auto-screen',
                subtitle: 'Auto-Screen via Lowongan',
                description: 'Kandidat yang melamar lewat lowongan dengan Auto-Screen aktif akan langsung mendapat assessment.',
                steps: [
                    'Pastikan lowongan memiliki "Enable Instant Integrity Assessment" aktif',
                    'Kandidat submit aplikasi (CV + data diri)',
                    'Sistem otomatis mengirim email dengan kode akses assessment',
                    'Kandidat langsung bisa mengikuti assessment tanpa menunggu HR'
                ],
                tips: [
                    'Proses ini sepenuhnya otomatis, menghemat waktu HR',
                    'Hasil assessment langsung masuk ke dashboard "Kandidat → Auto View"',
                    'CV kandidat tersimpan dan bisa didownload dari detail kandidat'
                ]
            },
            {
                id: 'reading-results',
                subtitle: 'Membaca Hasil Assessment',
                description: 'Cara melihat dan menginterpretasi hasil assessment kandidat.',
                steps: [
                    'Buka menu "Kandidat" → Tab yang sesuai (Auto View/Review & Invite)',
                    'Klik nama kandidat untuk melihat detail',
                    'Review skor risiko: Low, Medium, High, Critical',
                    'Baca red flags dan rekomendasi AI',
                    'Lihat transkrip wawancara lengkap untuk verifikasi manual'
                ],
                warnings: [
                    'Hasil assessment adalah rekomendasi, bukan keputusan final',
                    'Selalu lakukan verifikasi tambahan untuk posisi sensitif',
                    'Pertimbangkan konteks bisnis dan budaya perusahaan'
                ]
            }
        ]
    },
    {
        id: 'candidates',
        title: 'Kandidat',
        icon: <Users className="w-5 h-5" />,
        content: [
            {
                id: 'auto-view',
                subtitle: 'Tab Auto View',
                description: 'Kandidat yang melamar via lowongan dengan Auto-Screen aktif akan muncul di sini.',
                steps: [
                    'Klik tab "Auto View" di menu Kandidat',
                    'Lihat daftar kandidat yang sudah menyelesaikan assessment',
                    'Filter berdasarkan Risk Level: All/Low/Medium/High/Critical',
                    'Klik kandidat untuk melihat detail lengkap dan laporan assessment'
                ],
                tips: [
                    'Kandidat diurutkan berdasarkan tanggal assessment terbaru',
                    'Badge warna menunjukkan level risiko dengan jelas',
                    'CV kandidat bisa didownload langsung dari detail'
                ]
            },
            {
                id: 'review-invite',
                subtitle: 'Tab Review & Invite',
                description: 'Kandidat yang diundang manual atau belum mengikuti assessment.',
                steps: [
                    'Klik tab "Review & Invite"',
                    'Lihat daftar kandidat dengan status: Pending/Completed',
                    'Kandidat dengan status Pending belum menyelesaikan assessment',
                    'Klik "Undang Kandidat" untuk menambah kandidat baru',
                    'Gunakan "Bulk Invite" untuk mengundang banyak kandidat sekaligus'
                ],
                tips: [
                    'Kirim reminder ke kandidat yang belum menyelesaikan assessment',
                    'Status akan otomatis berubah setelah kandidat selesai assessment'
                ]
            },
            {
                id: 'candidate-detail',
                subtitle: 'Detail Kandidat',
                description: 'Informasi lengkap tentang kandidat dan hasil assessment-nya.',
                steps: [
                    'Klik nama kandidat dari daftar untuk membuka detail',
                    'Lihat informasi dasar: Nama, Email, Posisi, Tanggal Assessment',
                    'Review skor Fraud Triangle: Pressure, Opportunity, Rationalization',
                    'Baca summary analisis dan red flags yang terdeteksi',
                    'Scroll ke bawah untuk melihat transkrip wawancara lengkap',
                    'Download CV kandidat jika tersedia'
                ],
                tips: [
                    'Transkrip wawancara sangat berguna untuk memahami konteks jawaban kandidat',
                    'Perhatikan konsistensi antara jawaban survei dan wawancara',
                    'Red flags yang sama muncul berkali-kali perlu perhatian khusus'
                ]
            },
            {
                id: 'candidate-timeline',
                subtitle: 'Timeline Kandidat',
                description: 'Pelacakan otomatis perjalanan kandidat dari aplikasi hingga interview.',
                steps: [
                    'Buka detail kandidat',
                    'Lihat bagian "Timeline" di samping kanan',
                    'Timeline menampilkan semua tahapan yang dilalui kandidat',
                    'Status saat ini ditandai dengan warna highlight'
                ],
                tips: [
                    'Timeline otomatis terupdate saat kandidat menyelesaikan tahapan',
                    'Berguna untuk tracking progress kandidat dalam proses rekrutmen'
                ]
            }
        ]
    },
    {
        id: 'history',
        title: 'Riwayat',
        icon: <History className="w-5 h-5" />,
        content: [
            {
                id: 'view-history',
                subtitle: 'Melihat Riwayat Assessment',
                description: 'Semua assessment yang pernah dilakukan tersimpan di menu Riwayat.',
                steps: [
                    'Klik menu "Riwayat" di sidebar',
                    'Lihat daftar semua assessment yang sudah selesai',
                    'Filter berdasarkan status atau risk level',
                    'Klik kandidat untuk membuka laporan lengkap'
                ],
                tips: [
                    'Riwayat mencakup kandidat dari Auto View dan Manual Invite',
                    'Data tersimpan permanen dan bisa diakses kapan saja',
                    'Berguna untuk membandingkan kandidat atau audit rekrutmen'
                ]
            },
            {
                id: 'export-report',
                subtitle: 'Export dan Laporan',
                description: 'Cara mengekspor data kandidat untuk keperluan reporting.',
                steps: [
                    'Buka detail kandidat yang ingin di-export',
                    'Klik tombol "Export Report" atau "Download CV"',
                    'Data kandidat bisa di-copy atau di-screenshot untuk dokumentasi'
                ],
                tips: [
                    'Screenshot laporan untuk dokumentasi internal',
                    'Simpan CV kandidat yang lolos untuk arsip perusahaan'
                ]
            }
        ]
    },
    {
        id: 'settings',
        title: 'Pengaturan',
        icon: <Settings className="w-5 h-5" />,
        content: [
            {
                id: 'company-profile',
                subtitle: 'Profil Perusahaan',
                description: 'Kustomisasi tampilan dan branding perusahaan di halaman publik.',
                steps: [
                    'Buka menu "Pengaturan"',
                    'Klik tab "Profil Perusahaan"',
                    'Upload logo perusahaan (PNG/JPG, max 5MB)',
                    'Pilih warna brand untuk konsistensi visual',
                    'Edit header title dan welcome message untuk laman karir',
                    'Klik "Simpan Perubahan"'
                ],
                tips: [
                    'Logo akan muncul di laman karir dan halaman assessment',
                    'Warna brand diterapkan di semua halaman publik',
                    'Welcome message muncul di laman karir untuk menarik kandidat'
                ]
            },
            {
                id: 'assessment-settings',
                subtitle: 'Pengaturan Assessment',
                description: 'Kustomisasi pertanyaan dan bobot assessment sesuai kebutuhan perusahaan.',
                steps: [
                    'Buka tab "Pengaturan Assessment"',
                    'Lihat daftar pertanyaan Fraud Triangle dan SJT Scenarios',
                    'Edit pertanyaan atau tambah pertanyaan baru (fitur Premium/Enterprise)',
                    'Sesuaikan bobot pertanyaan berdasarkan prioritas perusahaan',
                    'Klik "Simpan Pengaturan"'
                ],
                warnings: [
                    'Perubahan pengaturan hanya berlaku untuk assessment baru',
                    'Assessment yang sudah selesai tidak terpengaruh perubahan'
                ]
            },
            {
                id: 'background-check',
                subtitle: 'Background Check Integration',
                description: 'Integrasi dengan layanan background check pihak ketiga (tersedia untuk tier tertentu).',
                steps: [
                    'Buka tab "Background Check"',
                    'Hubungkan akun Didit atau layanan lainnya',
                    'Pilih kandidat yang ingin di-background check',
                    'Sistem akan mengirim permintaan otomatis',
                    'Hasil akan muncul di detail kandidat'
                ],
                tips: [
                    'Background check membantu verifikasi identitas dan riwayat kandidat',
                    'Berguna untuk posisi yang memerlukan tingkat kepercayaan tinggi'
                ]
            }
        ]
    }
];
