import React, { useState, useRef, useEffect } from 'react';
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

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: DocContent[];
}

interface DocContent {
  subtitle: string;
  description: string;
  steps?: string[];
  tips?: string[];
  warnings?: string[];
}

const Documentation: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string>('jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const sections: DocSection[] = [
    {
      id: 'jobs',
      title: 'Kelola Lowongan',
      icon: <Briefcase className="w-5 h-5" />,
      content: [
        {
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

  const toggleSection = (sectionId: string) => {
    if (expandedSection === sectionId) {
      setExpandedSection('');
    } else {
      setExpandedSection(sectionId);
      setTimeout(() => {
        const element = sectionRefs.current[sectionId];
        if (element) {
          const yOffset = -20;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const filteredSections = sections.filter(section => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.content.some(c =>
        c.subtitle.toLowerCase().includes(searchLower) ||
        c.description.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#0F172A] flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8" style={{ color: '#D95D00' }} />
          Dokumentasi
        </h2>
        <p className="text-gray-600">
          Panduan lengkap menggunakan platform HireGood untuk proses rekrutmen yang lebih efisien
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari topik atau kata kunci..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D95D00] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="bg-gradient-to-br from-orange-50 to-blue-50 rounded-2xl p-6 mb-8 border-2 border-[#D95D00]">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm flex-shrink-0">
            <Lightbulb className="w-6 h-6 text-[#D95D00]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Quick Start Guide</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Langkah 1:</strong> Setup profil perusahaan di menu Pengaturan (logo, warna, welcome message)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Langkah 2:</strong> Buat lowongan pertama Anda di menu Kelola Lowongan</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Langkah 3:</strong> Aktifkan Auto-Screen untuk otomasi atau undang kandidat manual</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Langkah 4:</strong> Review hasil assessment di menu Kandidat</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => (
          <div
            key={section.id}
            ref={(el) => (sectionRefs.current[section.id] = el)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
          >
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg text-[#D95D00] flex-shrink-0">
                  {section.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-left">{section.title}</h3>
              </div>
              {expandedSection === section.id ? (
                <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
            </button>

            {/* Section Content */}
            {expandedSection === section.id && (
              <div className="px-4 sm:px-6 pb-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                {section.content.map((content, idx) => (
                  <div key={idx} className="border-l-4 border-[#D95D00] pl-4 sm:pl-6 py-2">
                    <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-2">
                      {content.subtitle}
                    </h4>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 leading-relaxed">
                      {content.description}
                    </p>

                    {/* Steps */}
                    {content.steps && content.steps.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Langkah-langkah:</p>
                        <ol className="space-y-2">
                          {content.steps.map((step, stepIdx) => (
                            <li key={stepIdx} className="flex items-start gap-3 text-sm text-gray-700">
                              <span className="flex-shrink-0 w-6 h-6 bg-[#D95D00] text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {stepIdx + 1}
                              </span>
                              <span className="flex-1 pt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Tips */}
                    {content.tips && content.tips.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 flex-shrink-0" />
                          Tips:
                        </p>
                        <ul className="space-y-1">
                          {content.tips.map((tip, tipIdx) => (
                            <li key={tipIdx} className="text-sm text-blue-800 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span className="flex-1">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {content.warnings && content.warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          Perhatian:
                        </p>
                        <ul className="space-y-1">
                          {content.warnings.map((warning, warnIdx) => (
                            <li key={warnIdx} className="text-sm text-amber-800 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span className="flex-1">{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Support Section */}
      <div className="mt-8 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl sm:text-2xl font-bold mb-2">Butuh Bantuan Lebih Lanjut?</h3>
            <p className="text-gray-300 text-sm sm:text-base">
              Tim support kami siap membantu Anda 24/7
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <a
              href="mailto:support@hiregood.one"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <Mail className="w-5 h-5 flex-shrink-0" />
              <span>Email Support</span>
            </a>
            <a
              href="https://hiregood.one"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#D95D00] text-white rounded-lg font-semibold hover:bg-[#B14D00] transition-colors"
            >
              <Globe className="w-5 h-5 flex-shrink-0" />
              <span>Visit Website</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
