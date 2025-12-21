import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
import { 
  processTask, 
  generateSimilarQuiz, 
  fetchTTSAudio, 
  playStoredAudio, 
  generateSummary 
} from '../services/geminiService.ts';

// Bỏ NotebookLM khỏi AgentLogo
const AgentLogo = React.memo(({ type, active }: { type: AgentType, active: boolean }) => {
  const cls = `w-4 h-4 ${active ? 'text-blue-600' : 'text-white'} transition-colors`;
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
  const [allResults, setAllResults] = useState<Partial<Record<AgentType, any>>>({});
  const [allAudios, setAllAudios] = useState<Partial<Record<AgentType, string>>>({});
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<any>(null);
  const [quizAnswered, setQuizAnswered] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TĂNG TỐC XỬ LÝ: Chạy song song thực thụ ---
  const runAnalysis = useCallback(async () => {
    if (!selectedSubject || (!image && !voiceText)) return alert("Vui lòng nhập đề bài!");
    
    setScreen('ANALYSIS');
    setLoading(true);
    setAllResults({});
    setAllAudios({});
    setQuiz(null);

    // Chỉ lấy 3 Agent còn lại
    const agents = [AgentType.SPEED, AgentType.SOCRATIC, AgentType.PERPLEXITY];

    // Tạo hàm thực thi riêng lẻ để chạy song song
    const runAgent = async (agent: AgentType) => {
      try {
        const res = await processTask(selectedSubject, agent, voiceText, image || undefined);
        
        if (agent === AgentType.SPEED) {
          const parsed = typeof res === 'string' ? JSON.parse(res) : res;
          setAllResults(prev => ({ ...prev, [agent]: parsed }));
          setLoading(false); // Speed xong là tắt loading ngay để hiện kết quả nhanh

          // Background tasks cho Speed
          generateSimilarQuiz(parsed.finalAnswer).then(q => q && setQuiz(q));
          generateSummary(parsed.finalAnswer).then(async (sum) => {
            if (sum) {
              const audio = await fetchTTSAudio(sum);
              if (audio) setAllAudios(prev => ({ ...prev, [agent]: audio }));
            }
          });
        } else {
          setAllResults(prev => ({ ...prev, [agent]: res }));
          generateSummary(res).then(async (sum) => {
            if (sum) {
              const audio = await fetchTTSAudio(sum);
              if (audio) setAllAudios(prev => ({ ...prev, [agent]: audio }));
            }
          });
        }
      } catch (err) {
        setAllResults(prev => ({ ...prev, [agent]: "Gặp sự cố kết nối." }));
      }
    };

    // Kích hoạt tất cả cùng lúc
    agents.forEach(agent => runAgent(agent));
  }, [selectedSubject, image, voiceText]);

  // --- SỬA LỖI MICRO: Khởi tạo sạch mỗi lần bấm ---
  const toggleRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Trình duyệt không hỗ trợ.");

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false; // Tắt continuous để tránh treo
      
      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);
      recognition.onresult = (e: any) => {
        setVoiceText(e.results[0][0].transcript);
        setImage(null);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
    }
  }, [isRecording]);

  // Giữ nguyên Camera Logic từ bản gốc của bạn vì nó đang chạy tốt
  const startCamera = async () => {
    setImage(null); setShowCamera(true); setCountdown(3);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { alert("Lỗi camera."); setShowCamera(false); }
  };

  useEffect(() => {
    let timer: any;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        canvasRef.current.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        setImage(canvasRef.current.toDataURL('image/jpeg', 0.8));
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      setShowCamera(false); setCountdown(null); setVoiceText('');
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <Layout 
      onBack={() => screen === 'ANALYSIS' ? setScreen('INPUT') : setScreen('HOME')}
      title={screen === 'HOME' ? undefined : (selectedSubject || 'AI Tutor')}
    >
      {/* HOME SCREEN */}
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {[Subject.MATH, Subject.PHYSICS, Subject.CHEMISTRY].map(sub => (
            <button key={sub} onClick={() => { setSelectedSubject(sub); setScreen('INPUT'); setImage(null); setVoiceText(''); }} className="bg-indigo-600 aspect-square rounded-[2rem] flex flex-col items-center justify-center text-white shadow-xl active:scale-95 transition-all">
              <span className="text-lg font-black uppercase mb-2">{sub}</span>
            </button>
          ))}
        </div>
      )}

      {/* INPUT SCREEN */}
      {screen === 'INPUT' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="w-full aspect-[16/10] bg-blue-50/50 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-2 border-blue-100 relative shadow-inner">
            {showCamera ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : image ? (
              <img src={image} className="h-full object-contain p-4" />
            ) : (
              <div className="p-8 text-center text-blue-900 font-bold leading-relaxed">
                {voiceText || "Vui lòng nhập đề bài..."}
              </div>
            )}
            {countdown !== null && <div className="absolute text-8xl font-black text-white drop-shadow-2xl">{countdown}</div>}
          </div>

          <div className="flex justify-between items-center px-4">
            <button onClick={startCamera} className="w-16 h-16 rounded-3xl bg-blue-600 text-white shadow-lg flex items-center justify-center">📸</button>
            <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-3xl bg-blue-600 text-white shadow-lg flex items-center justify-center">🖼️</button>
            <button onClick={toggleRecording} className={`w-16 h-16 rounded-3xl text-white shadow-lg transition-colors ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}`}>{isRecording ? '⏹️' : '🎙️'}</button>
            <button onClick={runAnalysis} className="w-16 h-16 rounded-3xl bg-emerald-500 text-white shadow-xl flex items-center justify-center">🚀</button>
          </div>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => { setImage(ev.target?.result as string); setVoiceText(''); };
              reader.readAsDataURL(file);
            }
          }} />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* ANALYSIS SCREEN */}
      {screen === 'ANALYSIS' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex bg-blue-600 p-1.5 rounded-2xl shadow-lg overflow-x-auto no-scrollbar">
            {[AgentType.SPEED, AgentType.SOCRATIC, AgentType.PERPLEXITY].map(ag => (
              <button key={ag} onClick={() => setSelectedAgent(ag)} className={`flex-1 flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${selectedAgent === ag ? 'bg-white text-blue-600 shadow-md' : 'text-blue-100'}`}>
                <AgentLogo type={ag} active={selectedAgent === ag} />
                <span className="text-[9px] font-black uppercase tracking-tighter">{ag}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm min-h-[500px] relative border border-slate-50">
            {loading && !allResults[selectedAgent] ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Đang giải bài...</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedAgent} - RESULT</span>
                  <button 
                    onClick={async () => {
                      if (allAudios[selectedAgent]) {
                        setIsSpeaking(true);
                        await playStoredAudio(allAudios[selectedAgent]!);
                        setIsSpeaking(false);
                      }
                    }}
                    disabled={!allAudios[selectedAgent] || isSpeaking}
                    className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-full disabled:opacity-20"
                  >
                    {isSpeaking ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : "🔊"}
                  </button>
                </div>

                <div className="prose prose-slate max-w-none text-sm math-font">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {selectedAgent === AgentType.SPEED 
                      ? allResults[AgentType.SPEED]?.finalAnswer 
                      : (allResults[selectedAgent] || "Đang phân tích...")}
                  </ReactMarkdown>
                </div>

                {selectedAgent === AgentType.SPEED && allResults[AgentType.SPEED]?.casioSteps && (
                  <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border-l-4 border-emerald-500">
                    <h4 className="text-[10px] font-black text-emerald-600 mb-2 uppercase">Casio 580VN X:</h4>
                    <div className="text-xs font-mono whitespace-pre-wrap">{allResults[AgentType.SPEED].casioSteps}</div>
                  </div>
                )}

                {selectedAgent === AgentType.SPEED && quiz && (
                  <div className="mt-6 p-4 bg-amber-50 rounded-2xl border-l-4 border-amber-500">
                    <h4 className="text-[10px] font-black text-amber-600 mb-2 uppercase">Luyện tập:</h4>
                    <p className="text-sm font-bold mb-3">{quiz.question}</p>
                    <div className="grid gap-2">
                      {quiz.options.map((opt: string, idx: number) => {
                        const label = String.fromCharCode(65 + idx);
                        return (
                          <button 
                            key={idx} 
                            onClick={() => setQuizAnswered(label)}
                            className={`p-3 text-left text-xs rounded-xl border transition-all ${quizAnswered === label ? 'bg-blue-600 text-white' : 'bg-white'}`}
                          >
                            <span className="font-black mr-2">{label}.</span> {opt}
                          </button>
                        );
                      })}
                    </div>
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
