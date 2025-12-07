import React, { useState, useEffect } from 'react';
import { Bot, User, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  speaker: 'ai' | 'user' | 'candidate';
  text: string;
  isNew?: boolean;
  isTyping?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ speaker, text, isNew = false, isTyping = false }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const isAI = speaker === 'ai';

  useEffect(() => {
    if (isNew && isAI && text) {
      let currentIndex = 0;
      const typingSpeed = 30; // milliseconds per character

      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.substring(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
          setShowCursor(false);
        }
      }, typingSpeed);

      return () => clearInterval(interval);
    } else {
      setDisplayedText(text);
      setShowCursor(false);
    }
  }, [text, isNew, isAI]);

  if (isTyping) {
    return (
      <div className="flex items-start gap-3 mb-4 animate-fade-in">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg animate-pulse">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none p-4 shadow-md border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 mb-4 ${isNew ? 'animate-slide-in' : ''}`}>
      {isAI && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg relative">
          <Bot className="w-5 h-5 text-white" />
          {isNew && (
            <Sparkles className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1 animate-ping" />
          )}
        </div>
      )}
      
      <div className={`flex-1 ${!isAI && 'flex justify-end'}`}>
        <div className={`
          max-w-[85%] rounded-2xl p-4 shadow-md transition-all duration-300
          ${isAI 
            ? 'bg-white dark:bg-slate-800 rounded-tl-none border border-gray-100 dark:border-slate-700' 
            : 'bg-gradient-to-br from-brand-orange to-yellow-500 text-white rounded-tr-none ml-auto'
          }
          ${isNew && isAI ? 'animate-glow' : ''}
        `}>
          <p className={`text-sm leading-relaxed ${isAI ? 'text-gray-700 dark:text-gray-300' : 'text-white'}`}>
            {displayedText}
            {showCursor && isNew && isAI && (
              <span className="inline-block w-1 h-4 bg-gray-700 dark:bg-gray-300 ml-1 animate-blink"></span>
            )}
          </p>
        </div>
      </div>

      {!isAI && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <User className="w-5 h-5 text-white" />
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(168, 85, 247, 0.2);
          }
          50% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.4s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ChatMessage;
