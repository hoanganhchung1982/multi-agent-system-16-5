import React, { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
// Chú ý: Import đúng các hàm bạn đã viết trong geminiService
import { processTask, playStoredAudio } from '../services/geminiService';

const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  const [voiceText, setVoiceText] = useState('');
  const [allResults, setAllResults] = useState<Partial<Record<AgentType, any>>>({});
  const [loading, setLoading] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleRun = async () => {
    if (!selectedSubject || !voiceText) return;
    setScreen('ANALYSIS');
    setLoading(true);
    
    // Chạy song song các Agent để đạt tốc độ cao nhất
    Object.values(AgentType).forEach(async (agent) => {
      try {
        const res = await processTask(selectedSubject, agent, voiceText);
        setAllResults(prev => ({ ...prev, [agent]: res }));
        if (agent === AgentType.SPEED) setLoading(false);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <Layout onBack={() => setScreen('HOME')} title={selectedSubject || "AI Study"}>
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 p-4">
          {Object.values(Subject).map(sub => (
            <button key={sub} onClick={() => { setSelectedSubject(sub); setScreen('INPUT'); }} className="bg-blue-600 p-8 rounded-[2rem] text-white font-bold shadow-lg">
              {sub}
            </button>
          ))}
        </div>
      )}

      {screen === 'INPUT' && (
        <div className="p-4 space-y-6">
          <textarea 
            className="w-full p-6 bg-blue-50 rounded-[2rem] border-none focus:ring-2 focus:ring-blue-500 h-40"
            placeholder="Nhập đề bài tại đây..."
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
          />
          <button onClick={handleRun} className="w-full bg-emerald-500 py-4 rounded-2xl text-white font-bold text-xl shadow-lg">
            GIẢI ĐỀ NGAY 🚀
          </button>
        </div>
      )}

      {screen === 'ANALYSIS' && (
        <div className="p-4 space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {Object.values(AgentType).map(ag => (
              <button key={ag} onClick={() => setSelectedAgent(ag)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold ${selectedAgent === ag ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                {ag}
              </button>
            ))}
          </div>
          
          <div className="bg-white p-6 rounded-[2rem] shadow-sm min-h-[300px]">
            {loading && !allResults[selectedAgent] ? (
              <div className="flex justify-center py-20 animate-spin">🌀</div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {typeof allResults[selectedAgent] === 'string' ? allResults[selectedAgent] : JSON.parse(allResults[selectedAgent] || '{}').finalAnswer}
              </ReactMarkdown>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
