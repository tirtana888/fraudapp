import React, { useState } from 'react';
import { CreditCard, X, ZoomIn, ExternalLink } from 'lucide-react';

interface DocumentGalleryProps {
    frontImage?: string;
    backImage?: string;
    selfieImage?: string;
    getImageSrc: (src?: string) => string | undefined;
}

const DocumentGallery: React.FC<DocumentGalleryProps> = ({
    frontImage,
    backImage,
    selfieImage,
    getImageSrc
}) => {
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const documents = [
        { id: 'front', label: 'KTP Depan', image: frontImage },
        { id: 'back', label: 'KTP Belakang', image: backImage },
        { id: 'selfie', label: 'Foto Selfie', image: selfieImage }
    ].filter(doc => doc.image);

    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-teal-500 to-cyan-600">
                    <div className="flex items-center gap-2">
                        <CreditCard size={20} className="text-white" />
                        <h3 className="text-lg font-bold text-white">Dokumen Identitas</h3>
                    </div>
                    <p className="text-teal-100 text-sm mt-1">Klik gambar untuk memperbesar</p>
                </div>

                {/* Gallery Grid */}
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {documents.map((doc) => (
                            <div key={doc.id} className="relative group">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                                    {doc.label}
                                </p>
                                <div
                                    onClick={() => setZoomedImage(getImageSrc(doc.image) || null)}
                                    className="relative aspect-[3/2] rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-300 hover:border-indigo-400 hover:shadow-lg group"
                                >
                                    <img
                                        src={getImageSrc(doc.image)}
                                        alt={doc.label}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    />
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 rounded-full p-3">
                                            <ZoomIn size={24} className="text-gray-800" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {documents.length === 0 && (
                            <div className="col-span-3 py-12 text-center">
                                <CreditCard size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500">Tidak ada dokumen tersedia</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={24} className="text-white" />
                    </button>
                    <a
                        href={zoomedImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-4 right-16 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <ExternalLink size={24} className="text-white" />
                    </a>
                    <img
                        src={zoomedImage}
                        alt="Zoomed Document"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
};

export default DocumentGallery;
