
import React, { useState } from 'react';
import { speakText } from '../services/audioService';
import { QuizQuestion } from '../types';

interface ProfessorTabProps {
  title: string;
  name: string;
  content?: string;
  quiz?: QuizQuestion[];
  icon: React.ReactNode;
}

export const ProfessorTab: React.FC<ProfessorTabProps> = ({ title, name, content, quiz, icon }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number | null>>({});

  const handleSpeech = () => {
    const textToRead = content || quiz?.map(q => q.question).join('. ') || "";
    speakText(textToRead);
  };

  const shareUrl = window.location.href;
  const shareText = `Học tập cùng ${name}: ${content?.substring(0, 100)}...`;

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const shareToZalo = () => {
    window.open(`https://zalo.me/share?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="animate-fade-in p-6 bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">{name}</h3>
            <p className="text-sm text-slate-500 font-medium">{title}</p>
          </div>
        </div>
        <button 
          onClick={handleSpeech}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          title="Nghe mấu chốt"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
      </div>

      <div className="prose prose-slate max-w-none flex-grow">
        {content && (
          <div className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
            {content}
          </div>
        )}

        {quiz && (
          <div className="space-y-8 mt-4">
            {quiz.map((q, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-semibold text-slate-800 mb-4">{idx + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedAnswers[idx] === optIdx;
                    const isCorrect = q.correctAnswer === optIdx;
                    const showFeedback = selectedAnswers[idx] !== undefined;

                    let btnClass = "w-full text-left p-3 rounded-lg border transition-all ";
                    if (showFeedback) {
                      if (isCorrect) btnClass += "bg-green-100 border-green-500 text-green-800";
                      else if (isSelected) btnClass += "bg-red-100 border-red-500 text-red-800";
                      else btnClass += "bg-white border-slate-200 opacity-60";
                    } else {
                      btnClass += "bg-white border-slate-200 hover:border-blue-500 hover:shadow-sm";
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={showFeedback}
                        onClick={() => setSelectedAnswers(prev => ({ ...prev, [idx]: optIdx }))}
                        className={btnClass}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {selectedAnswers[idx] !== undefined && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm font-bold text-slate-600 mb-1">Mấu chốt:</p>
                    <p className="text-sm text-slate-700">{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-4">
        <span className="text-sm text-slate-500 font-medium">Chia sẻ kiến thức:</span>
        <button 
          onClick={shareToFacebook}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </button>
        <button 
          onClick={shareToZalo}
          className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-full text-xs font-bold hover:bg-sky-100 transition-colors"
        >
          <div className="w-4 h-4 bg-sky-600 text-white flex items-center justify-center rounded-sm font-black text-[10px]">Z</div>
          Zalo
        </button>
      </div>
    </div>
  );
};
