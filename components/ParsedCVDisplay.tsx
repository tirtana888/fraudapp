import React from 'react';
import { User, MapPin, Briefcase, GraduationCap, Award, Languages, Lightbulb } from 'lucide-react';
import { ParsedCVData } from '../types';

interface ParsedCVDisplayProps {
  parsedData: ParsedCVData;
}

const ParsedCVDisplay: React.FC<ParsedCVDisplayProps> = ({ parsedData }) => {
  // Calculate total years of experience
  const calculateTotalExperience = () => {
    if (!parsedData.experience || parsedData.experience.length === 0) return 0;
    
    let totalYears = 0;
    parsedData.experience.forEach(exp => {
      // Try to extract years from duration string
      const match = exp.duration?.match(/(\d+)\s*(tahun|year|yr)/i);
      if (match) {
        totalYears += parseInt(match[1]);
      }
    });
    
    return totalYears;
  };
  
  const totalExperience = calculateTotalExperience();
  
  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] text-white rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{parsedData.fullName || 'Nama tidak tersedia'}</h2>
            {parsedData.address && (
              <div className="flex items-center gap-1.5 mt-1 text-sm opacity-90">
                <MapPin size={12} />
                <span className="truncate">{parsedData.address}</span>
              </div>
            )}
            
            {/* Inline Stats */}
            {(totalExperience > 0 || parsedData.education?.length > 0) && (
              <div className="flex gap-4 mt-2 text-sm">
                {totalExperience > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-bold">{totalExperience}+ thn</span>
                    <span className="opacity-75">exp</span>
                  </div>
                )}
                {parsedData.education && parsedData.education.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-bold">{parsedData.education[0]?.degree?.split(' ')[0] || 'S1'}</span>
                    <span className="opacity-75">edu</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {parsedData.summary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2 text-sm">
            <Lightbulb size={16} className="text-[#D95D00]" />
            Ringkasan Profesional
          </h3>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{parsedData.summary}</p>
        </div>
      )}

      {parsedData.experience && parsedData.experience.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
            <Briefcase size={16} className="text-[#D95D00]" />
            Pengalaman Kerja ({parsedData.experience.length})
          </h3>
          <div className="space-y-3">
            {parsedData.experience.map((exp, index) => (
              <div key={index} className="border-l-2 border-[#D95D00] pl-3 pb-3 last:pb-0">
                <h4 className="font-semibold text-gray-900 text-sm">{exp.title}</h4>
                <p className="text-[#D95D00] font-medium text-xs">{exp.company}</p>
                <p className="text-xs text-gray-500 mb-1">{exp.duration}</p>
                {exp.description && (
                  <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {parsedData.education && parsedData.education.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
            <GraduationCap size={16} className="text-[#D95D00]" />
            Pendidikan
          </h3>
          <div className="space-y-2">
            {parsedData.education.map((edu, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-[#D95D00] rounded-full mt-1.5 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">{edu.degree}</h4>
                  <p className="text-gray-600 text-xs truncate">{edu.institution}</p>
                  <p className="text-xs text-gray-500">{edu.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {parsedData.skills && parsedData.skills.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <Award size={16} className="text-[#D95D00]" />
              Keahlian ({parsedData.skills.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {parsedData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-[#D95D00]/10 text-[#D95D00] rounded text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {parsedData.languages && parsedData.languages.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <Languages size={16} className="text-[#D95D00]" />
              Bahasa
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {parsedData.languages.map((lang, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {parsedData.certifications && parsedData.certifications.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
            <Award size={16} className="text-[#D95D00]" />
            Sertifikasi ({parsedData.certifications.length})
          </h3>
          <ul className="space-y-1">
            {parsedData.certifications.map((cert, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="w-1 h-1 bg-[#D95D00] rounded-full mt-1.5 flex-shrink-0"></div>
                <span className="text-gray-600 text-xs">{cert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ParsedCVDisplay;
