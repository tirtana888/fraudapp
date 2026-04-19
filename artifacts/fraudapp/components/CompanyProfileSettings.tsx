import React, { useState, useEffect } from 'react';
import { Building2, Mail, Phone, MapPin, Save, ExternalLink } from 'lucide-react';
import { CompanyProfile } from '../types';
import { updateCompany, generateSlug } from '../services/supabase';
import { useToast } from './Toast';

interface CompanyProfileSettingsProps {
  company: CompanyProfile;
  onUpdate: () => void;
}

const CompanyProfileSettings: React.FC<CompanyProfileSettingsProps> = ({ company, onUpdate }) => {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: company.name || '',
    whatsapp: company.whatsapp || '',
    address: company.address || '',
    companySlug: company.companySlug || generateSlug(company.name || 'company')
  });

  useEffect(() => {
    setFormData({
      name: company.name || '',
      whatsapp: company.whatsapp || '',
      address: company.address || '',
      companySlug: company.companySlug || generateSlug(company.name || 'company')
    });
  }, [company]);

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      companySlug: generateSlug(name || 'company')
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nama perusahaan wajib diisi');
      return;
    }

    if (formData.whatsapp && !/^(\+)?[0-9]{10,15}$/.test(formData.whatsapp.replace(/\s/g, ''))) {
      toast.error('Format nomor WhatsApp tidak valid');
      return;
    }

    try {
      setIsSaving(true);
      await updateCompany(company.id, {
        name: formData.name.trim(),
        whatsapp: formData.whatsapp.trim(),
        address: formData.address.trim(),
        companySlug: formData.companySlug
      });

      toast.success('Informasi perusahaan berhasil diperbarui');
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: company.name || '',
      whatsapp: company.whatsapp || '',
      address: company.address || '',
      companySlug: company.companySlug || generateSlug(company.name || 'company')
    });
    setIsEditing(false);
  };

  const getCareerPageUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/jobs/${formData.companySlug}`;
  };

  if (!isEditing) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Informasi Perusahaan</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors text-sm font-medium"
          >
            Edit Profil
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Building2 size={20} className="text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Nama Perusahaan</div>
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                {company.name || '-'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail size={20} className="text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Email</div>
              <div className="text-sm font-medium text-gray-700 dark:text-slate-200">
                {company.adminEmail || '-'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone size={20} className="text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">WhatsApp</div>
              <div className="text-sm font-medium text-gray-700 dark:text-slate-200">
                {company.whatsapp || '-'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin size={20} className="text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Alamat Kantor</div>
              <div className="text-sm font-medium text-gray-700 dark:text-slate-200">
                {company.address || '-'}
              </div>
            </div>
          </div>

          {/* Logo Preview */}
          <div className="flex items-start gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <Building2 size={20} className="text-gray-400 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">Logo Perusahaan (Public Page)</div>
              {company.logoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={company.logoUrl} alt="Company Logo" className="h-12 w-auto object-contain rounded border border-gray-200 dark:border-slate-600 p-1" />
                  <div className="text-xs text-green-600 dark:text-green-400">✓ Logo aktif</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-slate-400 italic">Belum ada logo</div>
              )}
            </div>
          </div>

          {/* Header Title */}
          <div className="flex items-start gap-3">
            <Building2 size={20} className="text-gray-400 mt-0.5" />
            <div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">Judul Halaman Public</div>
              <div className="text-sm font-medium text-gray-700 dark:text-slate-200">
                {company.headerTitle || company.name || '-'}
              </div>
            </div>
          </div>

          {company.companySlug && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-2">URL Job Career Page</div>
              <a
                href={getCareerPageUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#D95D00] hover:text-[#B84D00] font-medium"
              >
                {getCareerPageUrl()}
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Edit Informasi Perusahaan</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Perbarui profil perusahaan Anda
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Nama Perusahaan <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
              placeholder="PT Nama Perusahaan"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Nomor WhatsApp
          </label>
          <div className="relative">
            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
              placeholder="+62812345678"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Format: +62xxx atau 08xxx
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Alamat Kantor
          </label>
          <div className="relative">
            <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent dark:bg-slate-700 dark:text-slate-100"
              placeholder="Jl. Contoh No. 123, Jakarta"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-[#D95D00] text-white rounded-lg hover:bg-[#B84D00] transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={16} />
                Simpan Perubahan
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfileSettings;
