import React from 'react';
import { CheckCircle2, XCircle, Shield, AlertTriangle } from 'lucide-react';

interface IdentityVerificationCardProps {
    ktpUrl?: string; // URL to Front ID Image
    selfieUrl?: string; // URL to Portrait Image
    faceMatchScore?: number;
    data: {
        nik?: string;
        name?: string;
        dob?: string;
        pob?: string;
        address?: string;
    };
}

// Helper function to get image source - handles both URL and base64
const getImageSrc = (imageData: string | undefined): string | undefined => {
    if (!imageData) return undefined;
    // Check if it's already a URL (starts with http/https)
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        return imageData;
    }
    // Check if it's already a data URL
    if (imageData.startsWith('data:')) {
        return imageData;
    }
    // Assume it's base64 and add prefix
    return `data:image/jpeg;base64,${imageData}`;
};

const IdentityVerificationCard: React.FC<IdentityVerificationCardProps> = ({
    ktpUrl,
    selfieUrl,
    faceMatchScore = 0,
    data
}) => {
    const isMatch = faceMatchScore > 80;
    const matchColor = isMatch ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const matchIcon = isMatch ? <CheckCircle2 size={16} /> : <XCircle size={16} />;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <Shield size={16} className="text-[#D95D00]" />
                <h3 className="text-sm font-bold text-gray-800">Verifikasi Identitas (Didit KYC)</h3>
            </div>

            <div className="p-4">
                {/* Visual Comparison Deck */}
                <div className="flex items-center justify-between gap-4 mb-6">
                    {/* KTP */}
                    <div className="flex-1 text-center">
                        <p className="text-xs text-gray-500 mb-2 font-medium">Foto KTP</p>
                        <div className="relative aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner group">
                            {ktpUrl ? (
                                <img src={getImageSrc(ktpUrl)} alt="KTP" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                            )}
                        </div>
                    </div>

                    {/* Center Match Badge */}
                    <div className="flex flex-col items-center z-10">
                        <div className={`p-1.5 rounded-full border-2 border-white shadow-lg ${isMatch ? 'bg-green-500' : 'bg-red-500'}`}>
                            <div className="bg-white p-1 rounded-full text-xs font-bold text-gray-700 min-w-[3rem] text-center">
                                {Math.round(faceMatchScore)}%
                            </div>
                        </div>
                        <span className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${matchColor} flex items-center gap-1`}>
                            {matchIcon}
                            {isMatch ? 'MATCH' : 'MISMATCH'}
                        </span>
                    </div>

                    {/* Selfie */}
                    <div className="flex-1 text-center">
                        <p className="text-xs text-gray-500 mb-2 font-medium">Selfie Terbaru</p>
                        <div className="relative aspect-[3/2] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-inner group">
                            {selfieUrl ? (
                                <img src={getImageSrc(selfieUrl)} alt="Selfie" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Data Grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <DataField label="NIK" value={data.nik} verified={!!data.nik} />
                    <DataField label="Nama Lengkap" value={data.name} verified={!!data.name} />
                    <DataField label="Tempat Lahir" value={data.pob} verified={!!data.pob} />
                    <DataField label="Tanggal Lahir" value={data.dob} verified={!!data.dob} />
                    <div className="col-span-2">
                        <DataField label="Alamat KTP" value={data.address} verified={!!data.address} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const DataField = ({ label, value, verified }: { label: string, value?: string, verified: boolean }) => (
    <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{value || '-'}</span>
            {verified && <CheckCircle2 size={12} className="text-green-500" />}
        </div>
    </div>
);

export default IdentityVerificationCard;
