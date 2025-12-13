import React, { useState } from 'react';
import { ChevronDown, ChevronUp, User, MapPin, FileText, CheckCircle2 } from 'lucide-react';

interface DataAccordionProps {
    data: {
        nik?: string;
        fullName?: string;
        dateOfBirth?: string;
        placeOfBirth?: string;
        gender?: string;
        address?: string;
        documentType?: string;
        status?: string;
    };
}

const DataField: React.FC<{ label: string; value?: string; icon?: React.ReactNode }> = ({
    label,
    value,
    icon
}) => (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
        {icon && <div className="text-gray-400 mt-0.5">{icon}</div>}
        <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{value || '-'}</p>
        </div>
        {value && <CheckCircle2 size={14} className="text-green-500 mt-1" />}
    </div>
);

const DataAccordion: React.FC<DataAccordionProps> = ({ data }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Accordion Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 transition-all"
            >
                <div className="flex items-center gap-3">
                    <FileText size={20} className="text-white" />
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-white">Data Hasil OCR</h3>
                        <p className="text-violet-100 text-sm">Informasi terverifikasi dari dokumen</p>
                    </div>
                </div>
                <div className="p-2 bg-white/20 rounded-full">
                    {isOpen ? (
                        <ChevronUp size={20} className="text-white" />
                    ) : (
                        <ChevronDown size={20} className="text-white" />
                    )}
                </div>
            </button>

            {/* Accordion Content */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        {/* Personal Info */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <User size={14} />
                                Informasi Pribadi
                            </h4>
                            <DataField label="NIK" value={data.nik} />
                            <DataField label="Nama Lengkap" value={data.fullName} />
                            <DataField label="Tanggal Lahir" value={data.dateOfBirth} />
                            <DataField label="Tempat Lahir" value={data.placeOfBirth} />
                            <DataField label="Jenis Kelamin" value={data.gender} />
                        </div>

                        {/* Document Info */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <MapPin size={14} />
                                Informasi Dokumen
                            </h4>
                            <DataField label="Tipe Dokumen" value={data.documentType || 'KTP'} />
                            <DataField label="Status Verifikasi" value={data.status} />
                            <div className="py-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Alamat</p>
                                <p className="text-sm font-semibold text-gray-800 dark:text-white leading-relaxed">
                                    {data.address || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Powered By Badge */}
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                        <p className="text-xs text-gray-400">
                            Data extracted by <span className="font-semibold text-indigo-500">Didit AI OCR</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataAccordion;
