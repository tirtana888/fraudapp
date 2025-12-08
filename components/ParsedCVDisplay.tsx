import React from 'react';
import { User, Mail, Phone, MapPin, Briefcase, GraduationCap, Award, Languages, Lightbulb } from 'lucide-react';
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
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#D95D00] to-[#FF6B35] text-white rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <User size={32} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{parsedData.fullName || 'Nama tidak tersedia'}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm">
              {parsedData.address && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} />
                  <span>{parsedData.address}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Quick Stats */}
        {(totalExperience > 0 || parsedData.education?.length > 0) && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/20">
            {totalExperience > 0 && (
              <div>
                <div className="text-3xl font-bold">{totalExperience}+</div>
                <div className="text-sm opacity-90">Tahun Pengalaman</div>
              </div>
            )}
            {parsedData.education && parsedData.education.length > 0 && (
              <div>
                <div className="text-3xl font-bold">{parsedData.education[0]?.degree?.split(' ')[0] || 'S1'}</div>
                <div className="text-sm opacity-90">Pendidikan Terakhir</div>
              </div>
            )}
          </div>
        )}
      </div>

      {parsedData.summary && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Lightbulb size={18} className="text-[#D95D00]" />
            Ringkasan Profesional
          </h3>
          <p className="text-gray-700 leading-relaxed">{parsedData.summary}</p>
        </div>
      )}

      {parsedData.experience && parsedData.experience.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Briefcase size={18} className="text-[#D95D00]" />
            Pengalaman Kerja
          </h3>
          <div className="space-y-4">
            {parsedData.experience.map((exp, index) => (
              <div key={index} className="border-l-4 border-[#D95D00] pl-4 pb-4 last:pb-0">
                <h4 className="font-semibold text-gray-900">{exp.title}</h4>
                <p className="text-[#D95D00] font-medium">{exp.company}</p>
                <p className="text-sm text-gray-500 mb-2">{exp.duration}</p>
                {exp.description && (
                  <p className="text-gray-700 text-sm">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {parsedData.education && parsedData.education.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <GraduationCap size={18} className="text-[#D95D00]" />
            Pendidikan
          </h3>
          <div className="space-y-3">
            {parsedData.education.map((edu, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[#D95D00] rounded-full mt-2"></div>
                <div>
                  <h4 className="font-semibold text-gray-900">{edu.degree}</h4>
                  <p className="text-gray-700">{edu.institution}</p>
                  <p className="text-sm text-gray-500">{edu.year}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parsedData.skills && parsedData.skills.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Award size={18} className="text-[#D95D00]" />
              Keahlian
            </h3>
            <div className="flex flex-wrap gap-2">
              {parsedData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[#D95D00]/10 text-[#D95D00] rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {parsedData.languages && parsedData.languages.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Languages size={18} className="text-[#D95D00]" />
              Bahasa
            </h3>
            <div className="flex flex-wrap gap-2">
              {parsedData.languages.map((lang, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {parsedData.certifications && parsedData.certifications.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Award size={18} className="text-[#D95D00]" />
            Sertifikasi
          </h3>
          <ul className="space-y-2">
            {parsedData.certifications.map((cert, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-[#D95D00] rounded-full mt-2"></div>
                <span className="text-gray-700">{cert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ParsedCVDisplay;
