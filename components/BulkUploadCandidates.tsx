import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

interface BulkUploadCandidatesProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CandidateRow {
  email: string;
  name: string;
  role: string;
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function BulkUploadCandidates({ companyId, onClose, onSuccess }: BulkUploadCandidatesProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CandidateRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateRow = (row: CandidateRow, index: number): ValidationError[] => {
    const rowErrors: ValidationError[] = [];

    if (!row.email || !row.email.trim()) {
      rowErrors.push({ row: index + 2, field: 'email', message: 'Email wajib diisi' });
    } else if (!validateEmail(row.email.trim())) {
      rowErrors.push({ row: index + 2, field: 'email', message: 'Format email tidak valid' });
    }

    if (!row.name || !row.name.trim()) {
      rowErrors.push({ row: index + 2, field: 'name', message: 'Nama wajib diisi' });
    }

    if (!row.role || !row.role.trim()) {
      rowErrors.push({ row: index + 2, field: 'role', message: 'Role/Posisi wajib diisi' });
    }

    return rowErrors;
  };

  const parseFile = (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data as CandidateRow[]);
        },
        error: (error) => {
          alert('Error parsing CSV: ' + error.message);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as CandidateRow[];
          processData(jsonData);
        } catch (error) {
          alert('Error parsing Excel: ' + (error as Error).message);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      alert('Format file tidak didukung. Gunakan CSV atau Excel (.xlsx, .xls)');
    }
  };

  const processData = (data: CandidateRow[]) => {
    const allErrors: ValidationError[] = [];

    data.forEach((row, index) => {
      const rowErrors = validateRow(row, index);
      allErrors.push(...rowErrors);
    });

    setErrors(allErrors);
    setPreview(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus('idle');
      setErrors([]);
      setPreview([]);
      parseFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (preview.length === 0 || errors.length > 0) return;

    setLoading(true);
    setUploadedCount(0);

    try {
      let successCount = 0;

      for (const candidate of preview) {
        try {
          await addDoc(collection(db, 'candidates'), {
            email: candidate.email.trim().toLowerCase(),
            name: candidate.name.trim(),
            role: candidate.role.trim(),
            companyId,
            status: 'invited',
            invitedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
          successCount++;
          setUploadedCount(successCount);
        } catch (error) {
          console.error('Error adding candidate:', candidate.email, error);
        }
      }

      setUploadStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error bulk upload:', error);
      setUploadStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { email: 'john.doe@example.com', name: 'John Doe', role: 'Accounting Staff' },
      { email: 'jane.smith@example.com', name: 'Jane Smith', role: 'Finance Manager' },
      { email: 'bob.wilson@example.com', name: 'Bob Wilson', role: 'Auditor' }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');

    const colWidths = [
      { wch: 30 },
      { wch: 25 },
      { wch: 25 }
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'template_kandidat.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Upload Bulk Kandidat</h2>
            <p className="text-sm text-gray-600 mt-1">Upload file Excel atau CSV dengan data kandidat</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="mb-6">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Template Excel
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Download template untuk melihat format yang benar. Kolom yang wajib diisi: <strong>email</strong>, <strong>name</strong>, <strong>role</strong>
            </p>
          </div>

          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet className="w-12 h-12 text-gray-400" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-700">
                    {file ? file.name : 'Pilih File Excel atau CSV'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Klik untuk upload atau drag & drop
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Format yang didukung: .csv, .xlsx, .xls
                  </p>
                </div>
              </div>
            </button>
          </div>

          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">
                    Ditemukan {errors.length} error:
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {errors.slice(0, 10).map((error, index) => (
                      <p key={index} className="text-sm text-red-700">
                        Baris {error.row}, kolom <strong>{error.field}</strong>: {error.message}
                      </p>
                    ))}
                    {errors.length > 10 && (
                      <p className="text-sm text-red-600 font-medium">
                        ... dan {errors.length - 10} error lainnya
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {preview.length > 0 && errors.length === 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">
                  Preview Data ({preview.length} kandidat)
                </h3>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role/Posisi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.slice(0, 50).map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                      ... dan {preview.length - 50} kandidat lainnya
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">
                  Berhasil upload {uploadedCount} kandidat!
                </p>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800 font-medium">
                  Terjadi error saat upload. Silakan coba lagi.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {preview.length > 0 && (
              <span>
                {errors.length === 0 ? (
                  <span className="text-green-600 font-medium">
                    ✓ Siap upload {preview.length} kandidat
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">
                    ✗ Perbaiki {errors.length} error terlebih dahulu
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              Batal
            </button>
            <button
              onClick={handleUpload}
              disabled={preview.length === 0 || errors.length > 0 || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Uploading... {uploadedCount}/{preview.length}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {preview.length} Kandidat
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
