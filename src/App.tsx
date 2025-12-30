import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
import { processTask, fetchTTSAudio, playStoredAudio } from '../services/geminiService';

interface DiaryEntry {
  date: string;
  subject: Subject;
  agentType: AgentType;
  input: string; 
  image?: string; 
  resultContent: string; 
  casioSteps?: string; 
}

// --- CONTROLLER LAYER: Gộp logic gọi AI tập trung ---
const useAgentSystem = (selectedSubject: Subject | null) => {
  const [allResults, setAllResults] = useState<Partial<Record<AgentType, any>>>({});
  const [allAudios, setAllAudios] = useState<Partial<Record<AgentType, string>>>({});
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  const resetResults = useCallback(() => {
    setAllResults({});
    setAllAudios({});
    setLoading(false);
    setLoadingStatus('');
  }, []);

  const runAgents = useCallback(async (
    primaryAgent: AgentType,
    allAgents: AgentType[],
    voiceText: string,
    image: string | null
  ) => {
    if (!selectedSubject || (!image && !voiceText)) return;

    setLoading(true);
    setLoadingStatus(`Đang gọi chuyên gia ${primaryAgent}...`);

    const callSingleAgent = async (agent: AgentType) => {
      try {
        const data = await processTask(selectedSubject, agent, voiceText, image || undefined);
        // data bây giờ là Object: { finalAnswer/content, casioSteps, summary, quiz }
        setAllResults(prev => ({ ...prev, [agent]: data }));

        // Tự động tạo âm thanh từ bản tóm tắt (Summary) có sẵn trong data
        if (data.summary) {
          fetchTTSAudio(data.summary).then(aud => {
            if (aud) setAllAudios(prev => ({ ...prev, [agent]: aud }));
          });
        }
      } catch (error) {
        console.error(`Lỗi Agent ${agent}:`, error);
      }
    };

    // Chạy Agent ưu tiên trước
    await callSingleAgent(primaryAgent);
    setLoading(false);

    // Chạy các Agent còn lại dưới nền
    const others = allAgents.filter(a => a !== primaryAgent);
    others.forEach(callSingleAgent);
  }, [selectedSubject]);

  return { allResults, allAudios, loading, loadingStatus, resetResults, runAgents };
};

const AgentLogo = React.memo(({ type, active }: { type: AgentType, active: boolean }) => {
  const cls = `w-4 h-4 ${active ? 'text-blue-600' : 'text-white'} transition-colors duration-300`;
  switch (type) {
    case AgentType.SPEED: return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>;
    case AgentType.SOCRATIC: return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case AgentType.PERPLEXITY: return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    default: return null;
  }
});

const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS' | 'DIARY'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  const [image, setImage] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [quizAnswered, setQuizAnswered] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isCurrentResultSaved, setIsCurrentResultSaved] = useState(false);

  // Camera & Refs
  const [showCamera, setShowCamera] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agents = useMemo(() => Object.values(AgentType), []);
  const { allResults, allAudios, loading, loadingStatus, resetResults, runAgents } = useAgentSystem(selectedSubject);

  useEffect(() => {
    const saved = localStorage.getItem('symbiotic_diary');
    if (saved) setDiaryEntries(JSON.parse(saved));
  }, []);

  const handleRunAnalysis = useCallback(() => {
    if (!selectedSubject || (!image && !voiceText)) return alert("Vui lòng nhập đề bài!");
    setScreen('ANALYSIS');
    runAgents(selectedAgent, agents, voiceText, image);
  }, [selectedSubject, image, voiceText, selectedAgent, agents, runAgents]);

  const handleSaveToDiary = useCallback(() => {
    const currentData = allResults[selectedAgent];
    if (!selectedSubject || !currentData || isCurrentResultSaved) return;

    const newEntry: DiaryEntry = {
      date: new Date().toLocaleString('vi-VN'),
      subject: selectedSubject,
      agentType: selectedAgent,
      input: voiceText || "Hình ảnh",
      image: image || undefined,
      resultContent: currentData.finalAnswer || currentData.content,
      casioSteps: currentData.casioSteps,
    };

    const updated = [newEntry, ...diaryEntries];
    setDiaryEntries(updated);
    localStorage.setItem('symbiotic_diary', JSON.stringify(updated));
    setShowSaveSuccess(true);
    setIsCurrentResultSaved(true);
  }, [selectedSubject, allResults, selectedAgent, isCurrentResultSaved, diaryEntries, voiceText, image]);

  const currentResult = allResults[selectedAgent];

  return (
    <Layout 
      onBack={() => setScreen(screen === 'ANALYSIS' ? 'INPUT' : 'HOME')} 
      title={selectedSubject || (screen === 'DIARY' ? 'Nhật ký' : 'Gemini AI')}
    >
      {/* --- HOME SCREEN --- */}
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 mt-4 p-4 animate-in fade-in">
          {[
            { name: Subject.MATH, color: 'bg-indigo-600', icon: '📐' },
            { name: Subject.PHYSICS, color: 'bg-violet-600', icon: '⚛️' },
            { name: Subject.CHEMISTRY, color: 'bg-emerald-600', icon: '🧪' },
            { name: Subject.DIARY, color: 'bg-amber-600', icon: '📔' },
          ].map((sub) => (
            <button key={sub.name} onClick={() => sub.name === Subject.DIARY ? setScreen('DIARY') : (setSelectedSubject(sub.name as Subject), setScreen('INPUT'))} 
              className={`${sub.color} aspect-square rounded-[2rem] flex flex-col items-center justify-center text-white shadow-xl active:scale-95 transition-all`}>
              <span className="text-sm font-black mb-2 uppercase">{sub.name}</span>
              <span className="text-4xl">{sub.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* --- INPUT SCREEN (Chụp ảnh/Ghi âm) --- */}
      {screen === 'INPUT' && (
        <div className="p-4 space-y-6">
          <div className="w-full aspect-video bg-blue-50 rounded-[2rem] flex items-center justify-center overflow-hidden border-2 border-dashed border-blue-200 relative">
            {image ? <img src={image} className="h-full object-contain p-2" /> : <p className="text-blue-400 text-sm">Chưa có dữ liệu đầu vào</p>}
          </div>
          <div className="flex justify-around items-center">
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-white shadow rounded-2xl flex items-center justify-center text-2xl">🖼️</div>
              <span className="text-[10px] font-bold text-slate-500">THƯ VIỆN</span>
            </button>
            <button onClick={handleRunAnalysis} className="w-20 h-20 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white text-3xl active:scale-90 transition-transform">
              🚀
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setImage(ev.target?.result as string);
                reader.readAsDataURL(file);
              }
            }} />
          </div>
        </div>
      )}

      {/* --- ANALYSIS SCREEN (Kết quả 3 Tab) --- */}
      {screen === 'ANALYSIS' && (
        <div className="p-4 space-y-4">
          {/* Tabs Selector */}
          <div className="flex bg-blue-700 p-1.5 rounded-2xl gap-1">
            {agents.map((ag) => (
              <button key={ag} onClick={() => setSelectedAgent(ag)} 
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${selectedAgent === ag ? 'bg-white text-blue-700 shadow' : 'text-blue-100'}`}>
                <AgentLogo type={ag} active={selectedAgent === ag} />
                {ag}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm min-h-[400px] border border-slate-50">
            {loading && !currentResult ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{loadingStatus}</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">KẾT QUẢ CHUYÊN GIA</span>
                  <div className="flex gap-2">
                    <button onClick={handleSaveToDiary} className="p-2 bg-slate-50 rounded-full active:scale-90">
                      {isCurrentResultSaved ? '✅' : '💾'}
                    </button>
                    <button onClick={async () => {
                       if (allAudios[selectedAgent]) {
                         setIsSpeaking(true);
                         await playStoredAudio(allAudios[selectedAgent]!, audioSourceRef);
                         setIsSpeaking(false);
                       }
                    }} className={`p-2 bg-blue-50 text-blue-600 rounded-full ${isSpeaking ? 'animate-pulse' : ''}`}>
                      🔊
                    </button>
                  </div>
                </div>

                <article className="prose prose-slate max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {currentResult?.finalAnswer || currentResult?.content || "Đang chuẩn bị dữ liệu..."}
                  </ReactMarkdown>
                </article>

                {/* Phần bổ trợ cho Tab Giải Nhanh (Speed) */}
                {selectedAgent === AgentType.SPEED && currentResult && (
                  <div className="mt-6 space-y-4">
                    {currentResult.casioSteps && (
                      <div className="bg-emerald-50 p-4 rounded-2xl border-l-4 border-emerald-500">
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-2">Mẹo Casio 580VNX</h4>
                        <p className="text-xs whitespace-pre-wrap text-emerald-900">{currentResult.casioSteps}</p>
                      </div>
                    )}
                    {currentResult.quiz && (
                      <div className="bg-amber-50 p-4 rounded-2xl border-l-4 border-amber-500">
                        <h4 className="text-[10px] font-black text-amber-600 uppercase mb-3">Thử thách tương tự</h4>
                        <p className="text-sm font-bold mb-3">{currentResult.quiz.question}</p>
                        <div className="grid gap-2">
                          {currentResult.quiz.options.map((opt: string, idx: number) => (
                            <button key={idx} onClick={() => setQuizAnswered(opt)} 
                              className={`text-left p-3 rounded-xl border text-xs font-bold transition-all ${quizAnswered === opt ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                              {String.fromCharCode(65 + idx)}. {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DIARY SCREEN --- */}
      {screen === 'DIARY' && (
        <div className="p-4 space-y-4 overflow-y-auto">
          {diaryEntries.map((entry, i) => (
            <div key={i} className="bg-white p-5 rounded-[2rem] border shadow-sm">
              <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-2 uppercase">
                <span>{entry.date}</span>
                <span className="text-blue-600">{entry.agentType}</span>
              </div>
              <p className="text-sm font-bold text-slate-800 line-clamp-2">{entry.input}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default App;
