import React, { useState, useEffect } from 'react';
import { Crown, Lock, Eye, EyeOff } from 'lucide-react';
import { InterviewSession, CompanyProfile } from '../types';
import { SUBSCRIPTION_PLANS } from '../types';

interface CandidateListWithBlurProps {
  sessions: InterviewSession[];
  company: CompanyProfile;
  onSelectSession: (session: InterviewSession) => void;
  onUpgradeClick: () => void;
  renderItem: (session: InterviewSession, index: number) => React.ReactNode;
}

const CandidateListWithBlur: React.FC<CandidateListWithBlurProps> = ({
  sessions,
  company,
  onSelectSession,
  onUpgradeClick,
  renderItem
}) => {
  const isFreemium = company.tier === 'Freemium';
  const viewLimit = SUBSCRIPTION_PLANS.FREEMIUM.candidateViewLimit;
  const [showAll, setShowAll] = useState(false);

  // Reset showAll when tier changes
  useEffect(() => {
    if (!isFreemium) {
      setShowAll(false);
    }
  }, [isFreemium]);

  return (
    <div className="space-y-3">
      {sessions.map((session, index) => {
        const isBlurred = isFreemium && index >= viewLimit && !showAll;
        
        return (
          <div key={session.id} className="relative">
            {/* Render Item */}
            <div 
              className={`transition-all ${isBlurred ? 'blur-sm pointer-events-none select-none' : ''}`}
              onClick={() => !isBlurred && onSelectSession(session)}
            >
              {renderItem(session, index)}
            </div>

            {/* Blur Overlay for Freemium */}
            {isBlurred && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-black/60 to-black/40 backdrop-blur-[2px] rounded-xl z-10">
                <div className="text-center px-6 py-4">
                  <Lock size={32} className="text-white mx-auto mb-3" />
                  <p className="text-white font-bold text-lg mb-2">Kandidat #{index + 1} Terkunci</p>
                  <p className="text-white/90 text-sm mb-4">
                    Freemium terbatas {viewLimit} kandidat
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpgradeClick();
                    }}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all flex items-center gap-2 mx-auto shadow-lg"
                  >
                    <Crown size={18} />
                    Upgrade ke Premium
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Show All Button (temporary bypass) */}
      {isFreemium && sessions.length > viewLimit && !showAll && (
        <div className="mt-6 text-center p-6 bg-orange-50 border-2 border-orange-200 rounded-xl">
          <Lock size={48} className="text-orange-500 mx-auto mb-3" />
          <p className="text-gray-900 font-bold text-lg mb-2">
            {sessions.length - viewLimit} kandidat lagi tersembunyi
          </p>
          <p className="text-gray-600 text-sm mb-4">
            Upgrade ke Premium untuk akses unlimited candidates
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onUpgradeClick}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all flex items-center gap-2"
            >
              <Crown size={18} />
              Upgrade Premium
            </button>
            <button
              onClick={() => setShowAll(true)}
              className="bg-white text-gray-700 border-2 border-gray-300 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <Eye size={18} />
              Lihat Semua (Preview)
            </button>
          </div>
        </div>
      )}

      {/* Hide Button */}
      {isFreemium && sessions.length > viewLimit && showAll && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(false)}
            className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2 mx-auto"
          >
            <EyeOff size={18} />
            Sembunyikan Kandidat Premium
          </button>
        </div>
      )}
    </div>
  );
};

export default CandidateListWithBlur;
