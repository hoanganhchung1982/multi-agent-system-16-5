import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from './types';
import { Layout } from './components/Layout';
import { processTask, generateSimilarQuiz, playStoredAudio, generateSummary } from './services/geminiService';

// --- CONTROLLER: Quản lý logic AI ---
const useAgentSystem = (selectedSubject: Subject | null) => {
  const [allResults, setAllResults] = useState<Partial<Record<AgentType, any>>>({});
  const [allAudios, setAllAudios] = useState<Partial<Record<AgentType, string>>>({});
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);

  const resetResults = useCallback(() => {
    setAllResults({});
    setAllAudios({});
    setQuiz(null);
    setLoading(false);
  }, []);

  const runAgents = useCallback(async (
    primaryAgent: AgentType,
    allAgents: AgentType[],
    voiceText: string,
    image: string | null
  ) => {
    if (!selectedSubject || (!image && !voiceText)) return;

    setLoading(true);
    setAllResults({}); 

    // CHẠY SONG SONG 3 CHUYÊN GIA
    allAgents.forEach(async (agent) => {
      try {
        const res = await processTask(selectedSubject, agent, voiceText, image || undefined);
        
        // Cập nhật kết quả ngay lập tức cho từng Agent
        setAllResults(prev => {
          let data = res;
          if (agent === AgentType.SPEED) {
            try { data = JSON.parse(res); } catch { data = { finalAnswer: res }; }
          }
          return { ...prev, [agent]: data };
        });

        // Tắt loading ngay khi Agent chủ đạo (SPEED) trả về để người dùng xem luôn
        if (agent === primaryAgent) setLoading(false);

        // Chạy ngầm Quiz và Audio (Background)
        if (agent === AgentType.SPEED) {
          const parsed = res.startsWith('{') ? JSON.parse(res) : { finalAnswer: res };
          generateSimilarQuiz(parsed.finalAnswer || res).then(q => q && setQuiz(q));
        }
        
        generateSummary(res).then(sum => {
          if (sum) setAllAudios(p => ({ ...p, [agent]: sum }));
        });
      } catch (error) {
        setAllResults(prev => ({ ...prev, [agent]: "Lỗi xử lý chuyên gia." }));
      }
    });
  }, [selectedSubject]);

  return { allResults, allAudios, loading, quiz, resetResults, runAgents };
};

const AgentLogo = React.memo(({ type, active }: { type: AgentType, active: boolean }) => {
  const cls = `w-4 h-4 ${active ? 'text-blue-600' : 'text-white'} transition-colors`;
  switch (type) {
    case AgentType.SPEED: return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>;
    case AgentType.SOCRATIC: return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case AgentType.PERPLEXITY: return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    default: return null;
  }
});

// --- VIEW: Giao diện chính ---
const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS' | 'DIARY'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  const [image, setImage] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const agents = useMemo(() => Object.values(AgentType), []);

  const { allResults, allAudios, loading, quiz, resetResults, runAgents } = useAgentSystem(selectedSubject);

  // FIX LỖI MICRO: Khởi tạo lại mỗi khi bấm
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return alert("Trình duyệt không hỗ trợ giọng nói.");
      const r = new SR();
      r.lang = 'vi-VN';
      r.onstart = () => setIsRecording(true);
      r.onend = () => setIsRecording(false);
      r.onresult = (e: any) => setVoiceText(e.results[0][0].transcript);
      recognitionRef.current = r;
      r.start();
    }
  }, [isRecording]);

  const handleRunAnalysis = () => {
    if (!selectedSubject || (!image && !voiceText)) return;
    setScreen('ANALYSIS');
    runAgents(selectedAgent, agents, voiceText, image);
  };

  return (
    <Layout onBack={() => setScreen(screen === 'ANALYSIS' ? 'INPUT' : 'HOME')} title={selectedSubject || "AI Study"}>
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 p-4">
          {[Subject.MATH, Subject.PHYSICS, Subject.CHEMISTRY].map(sub => (
            <button key={sub} onClick={() => { setSelectedSubject(sub); setScreen('INPUT'); resetResults(); }} className="bg-blue-600 aspect-square rounded-[2rem] text-white font-bold text-xl shadow-lg active:scale-95 transition-all">
              {sub}
            </button>
          ))}
        </div>
      )}

      {screen === 'INPUT' && (
        <div className="space-y-6 p-4">
          <div className="w-full aspect-video bg-blue-50 rounded-[2rem] flex items-center justify-center p-4 border-2 border-dashed border-blue-200">
            <p className="text-blue-800 text-center font-medium">{voiceText || image ? "Đã nhận dữ liệu" : "Chụp ảnh hoặc nói đề bài..."}</p>
          </div>
          <div className="flex justify-center gap-6">
            <button onClick={toggleRecording} className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-2xl ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600'} text-white`}>
              {isRecording ? '⏹️' : '🎙️'}
            </button>
            <button onClick={handleRunAnalysis} className="w-16 h-16 bg-emerald-500 rounded-full shadow-xl flex items-center justify-center text-2xl text-white">🚀</button>
          </div>
        </div>
      )}

      {screen === 'ANALYSIS' && (
        <div className="space-y-4 p-4">
          <div className="flex bg-blue-700 p-1.5 rounded-2xl gap-1">
            {agents.map(ag => (
              <button key={ag} onClick={() => setSelectedAgent(ag)} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase flex flex-col items-center gap-1 ${selectedAgent === ag ? 'bg-white text-blue-600' : 'text-blue-100'}`}>
                <AgentLogo type={ag} active={selectedAgent === ag} /> {ag}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm min-h-[400px] relative">
            {loading && !allResults[selectedAgent] ? (
              <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="prose prose-blue max-w-none">
                <div className="flex justify-end mb-2">
                  <button onClick={() => playStoredAudio(allAudios[selectedAgent] || "")} className="p-2 bg-blue-50 text-blue-600 rounded-full">🔊</button>
                </div>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {selectedAgent === AgentType.SPEED ? allResults[AgentType.SPEED]?.finalAnswer : allResults[selectedAgent]}
                </ReactMarkdown>
                {selectedAgent === AgentType.SPEED && allResults[AgentType.SPEED]?.casioSteps && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border-l-4 border-emerald-500 text-sm italic">
                    {allResults[AgentType.SPEED].casioSteps}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
