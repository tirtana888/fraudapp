import { AssessmentItem, SJTItem } from "../types";

// PART 1: A. FRAUD TRIANGLE (12 Questions)
export const FRAUD_TRIANGLE_QUESTIONS: AssessmentItem[] = [
  // --- PRESSURE ---
  { id: 'ft_p1', category: 'pressure', question: 'Saya merasa gaji saya saat ini tidak cukup untuk membiayai gaya hidup saya.', response: null },
  { id: 'ft_p2', category: 'pressure', question: 'Saya memiliki hutang atau cicilan yang membuat saya cemas setiap bulan.', response: null },
  { id: 'ft_p3', category: 'pressure', question: 'Saya sering merasa iri dengan pencapaian finansial rekan kerja saya.', response: null },
  { id: 'ft_p4', category: 'pressure', question: 'Saya adalah tulang punggung keluarga yang menanggung beban biaya tak terduga.', response: null },
  
  // --- OPPORTUNITY ---
  { id: 'ft_o1', category: 'opportunity', question: 'Di tempat kerja lama, sistem pengawasan sangat longgar sehingga mudah dimanipulasi.', response: null },
  { id: 'ft_o2', category: 'opportunity', question: 'Saya lebih suka bekerja sendiri tanpa ada yang memeriksa hasil kerja saya secara detail.', response: null },
  { id: 'ft_o3', category: 'opportunity', question: 'Saya tahu cara membypass prosedur IT/Administrasi jika sedang terburu-buru.', response: null },
  { id: 'ft_o4', category: 'opportunity', question: 'Persetujuan ganda (dual approval) hanya memperlambat kerja dan bisa diabaikan dalam keadaan darurat.', response: null },

  // --- RATIONALIZATION ---
  { id: 'ft_r1', category: 'rationalization', question: 'Mengambil sedikit aset kantor (kertas/pulpen) adalah hal wajar sebagai kompensasi lembur.', response: null },
  { id: 'ft_r2', category: 'rationalization', question: 'Perusahaan besar sudah punya asuransi, jadi kerugian kecil tidak akan menyakiti mereka.', response: null },
  { id: 'ft_r3', category: 'rationalization', question: 'Aturan dibuat untuk dipatuhi, tapi ada situasi di mana kita harus fleksibel melanggarnya demi hasil.', response: null },
  { id: 'ft_r4', category: 'rationalization', question: 'Jika atasan melakukan pelanggaran, maka wajar jika bawahan juga melakukannya.', response: null },
];

// PART 1: B. SJT - SITUATIONAL JUDGMENT TEST (3 Scenarios)
export const SJT_SCENARIOS: SJTItem[] = [
  {
    id: 'sjt_1',
    scenario: 'Anda melihat atasan langsung Anda memanipulasi laporan biaya perjalanan dinas sebesar Rp 500.000 untuk keperluan pribadi. Apa yang Anda lakukan?',
    options: [
      { label: 'Diam saja karena nominalnya kecil dan tidak ingin cari masalah.', riskWeight: 'high' }, // Passive
      { label: 'Melaporkan secara anonim melalui Whistleblowing System perusahaan.', riskWeight: 'low' }, // Integrity
      { label: 'Menegur atasan secara langsung dan memintanya mengoreksi.', riskWeight: 'medium' }, // Confrontational but risky
      { label: 'Meminta bagian dari uang tersebut untuk tutup mulut.', riskWeight: 'critical' } // Fraud
    ],
    selectedOptionIndex: null
  },
  {
    id: 'sjt_2',
    scenario: 'Akhir bulan target belum tercapai. Rekan sales menyarankan untuk melakukan "Booking Fiktif" agar bonus cair, lalu dibatalkan bulan depan. Sikap Anda?',
    options: [
      { label: 'Menolak tegas dan siap jika tidak menerima bonus bulan ini.', riskWeight: 'low' },
      { label: 'Setuju melakukan, tapi hanya kali ini saja karena kepepet.', riskWeight: 'high' },
      { label: 'Melaporkan rekan tersebut ke manajer penjualan.', riskWeight: 'low' },
      { label: 'Pura-pura tidak tahu dan membiarkan dia melakukannya.', riskWeight: 'medium' }
    ],
    selectedOptionIndex: null
  },
  {
    id: 'sjt_3',
    scenario: 'Anda menemukan celah keamanan di sistem gudang yang memungkinkan barang keluar tanpa dicatat. Apa tindakan Anda?',
    options: [
      { label: 'Segera mendokumentasikan celah tersebut dan lapor ke IT/Audit.', riskWeight: 'low' },
      { label: 'Diam saja, mungkin suatu hari nanti berguna.', riskWeight: 'critical' },
      { label: 'Mencoba mengambil satu barang untuk membuktikan celahnya, lalu lapor.', riskWeight: 'medium' }, // Good intent, bad execution
      { label: 'Menceritakan ke teman dekat saja.', riskWeight: 'high' }
    ],
    selectedOptionIndex: null
  }
];

// PART 1: C. FINANCIAL STRAIN SCALE (5 Questions)
// Scale: 1 (Tidak Pernah) - 5 (Sangat Sering)
export const FINANCIAL_STRAIN_QUESTIONS: AssessmentItem[] = [
  { id: 'fs_1', category: 'financial_strain', question: 'Seberapa sering Anda merasa cemas memikirkan tagihan bulan depan?', response: null },
  { id: 'fs_2', category: 'financial_strain', question: 'Apakah Anda memiliki cicilan (Paylater/Pinjol/Bank) yang melebihi 30% pendapatan bulanan?', response: null },
  { id: 'fs_3', category: 'financial_strain', question: 'Seberapa sering Anda meminjam uang dari teman/keluarga untuk kebutuhan sehari-hari?', response: null },
  { id: 'fs_4', category: 'financial_strain', question: 'Apakah Anda pernah terlambat membayar tagihan penting dalam 3 bulan terakhir?', response: null },
  { id: 'fs_5', category: 'financial_strain', question: 'Apakah Anda merasa penghasilan saat ini sangat kurang untuk gaya hidup Anda?', response: null },
];