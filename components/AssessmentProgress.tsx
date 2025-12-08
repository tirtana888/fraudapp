import React, { useEffect, useState } from 'react';
import { CheckCircle, Trophy, Star, Zap, Target } from 'lucide-react';

interface AssessmentProgressProps {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  showCelebration?: boolean;
}

const MILESTONES = [
  { step: 3, message: "🎯 Great start!", emoji: "🎯" },
  { step: 5, message: "🔥 You're on fire!", emoji: "🔥" },
  { step: 7, message: "⭐ Almost there!", emoji: "⭐" },
  { step: 10, message: "🎉 Final stretch!", emoji: "🎉" }
];

const AssessmentProgress: React.FC<AssessmentProgressProps> = ({ 
  currentStep, 
  totalSteps, 
  stepName,
  showCelebration = false
}) => {
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneMessage, setMilestoneMessage] = useState('');
  const percentage = Math.round((currentStep / totalSteps) * 100);

  useEffect(() => {
    const milestone = MILESTONES.find(m => m.step === currentStep);
    if (milestone) {
      setMilestoneMessage(milestone.message);
      setShowMilestone(true);
      setTimeout(() => setShowMilestone(false), 3000);
    }
  }, [currentStep]);

  return (
    <div className="space-y-4">
      {/* Progress Bar Container - STICKY */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 border-2 border-gray-100 dark:border-slate-700 backdrop-blur-sm bg-opacity-95">
        {/* Milestone Celebration - Inside sticky container */}
        {showMilestone && (
          <div className="animate-bounce-in bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-xl shadow-lg text-center font-bold mb-4 text-sm sm:text-base">
            {milestoneMessage}
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-orange to-yellow-500 flex items-center justify-center shadow-lg animate-pulse-slow">
                <span className="text-white font-bold text-lg">{currentStep}</span>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-ping"></div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Step {currentStep} of {totalSteps}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stepName}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black bg-gradient-to-r from-brand-orange to-purple-600 bg-clip-text text-transparent">
              {percentage}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Complete</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-brand-orange via-yellow-500 to-green-500 rounded-full transition-all duration-1000 ease-out relative animate-shimmer"
              style={{ width: `${percentage}%` }}
            >
              <div className="absolute inset-0 bg-white/30 animate-pulse-slow"></div>
            </div>
          </div>
          
          {/* Milestone Markers */}
          <div className="absolute top-0 left-0 right-0 h-4 flex justify-between px-1">
            {MILESTONES.map((milestone) => {
              const milestonePercentage = (milestone.step / totalSteps) * 100;
              const isPassed = currentStep >= milestone.step;
              return (
                <div
                  key={milestone.step}
                  className={`transform -translate-y-1/2 transition-all duration-300 ${
                    isPassed ? 'scale-125' : 'scale-100'
                  }`}
                  style={{ 
                    position: 'absolute',
                    left: `${milestonePercentage}%`,
                    top: '50%'
                  }}
                >
                  {isPassed ? (
                    <CheckCircle className="w-6 h-6 text-green-500 drop-shadow-lg" fill="currentColor" />
                  ) : (
                    <div className="w-4 h-4 bg-gray-300 dark:bg-slate-600 rounded-full border-2 border-white"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">
              {totalSteps - currentStep} questions remaining
            </span>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(Math.min(currentStep, 5))].map((_, i) => (
              <Star key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" />
            ))}
          </div>
        </div>
      </div>
      
      {/* Motivational Message - Outside sticky container */}
      {percentage >= 80 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2 animate-bounce" />
          <p className="text-green-800 dark:text-green-300 font-semibold">
            🎉 Amazing! You're almost done!
          </p>
        </div>
      )}

      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -100% 0; }
          100% { background-position: 100% 0; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 2s linear infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AssessmentProgress;
