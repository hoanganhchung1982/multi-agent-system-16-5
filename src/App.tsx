import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
import { processTask } from '../services/geminiService.ts';

const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  
  const [image, setImage] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{quick?: any, detail?: string}>({});

  const [showCamera, setShowCamera] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isCounting, setIsCounting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- TẦNG XỬ LÝ CAMERA ---
  const startCamera = async () => {
    setShowCamera(true); 
    setIsCounting(true); 
    setCountdown(3);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Không thể mở camera");
      setShowCamera(false);
      setIsCounting(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (isCounting && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isCounting && countdown === 0) {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        
        setImage(canvas.toDataURL('image/jpeg', 0.7));
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        setShowCamera(false);
        setIsCounting(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isCounting, countdown]);

  // --- TẦNG XỬ LÝ AI ---
  const handleRunAnalysis = useCallback(async () => {
    if (!selectedSubject || (!image && !voiceText)) return;
    
    setLoading(true);
    setScreen('ANALYSIS');

    try {
      const data = await processTask(selectedSubject, voiceText, image || undefined);
      if (data) {
        setResults(data);
      }
    } catch (err) {
      console.error("Lỗi build/fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, image, voiceText]);

  return (
    <Layout 
      onBack={() => setScreen(screen === 'ANALYSIS' ? 'INPUT' : 'HOME')}
      title={selectedSubject || "AI GIẢI ĐỀ"}
    >
      {/* MÀN HÌNH CHÍNH */}
      {screen === 'HOME' && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {[Subject.MATH, Subject.PHYSICS, Subject.CHEMISTRY].map((sub) => (
            <button 
              key={sub} 
              onClick={() => { setSelectedSubject(sub); setScreen('INPUT'); }}
              className="h-40 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all"
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* MÀN HÌNH NHẬP LIỆU */}
      {screen === 'INPUT' && (
        <div className="space-y-8">
          <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
            {showCamera ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : image ? (
              <img src={image} className="w-full h-full object-contain p-4" alt="Preview" />
            ) : (
              <div className="flex items-center justify-center h-full p-10 text-center font-bold text-slate-400">
                {voiceText || "Hãy chụp ảnh đề bài hoặc nhập văn bản..."}
              </div>
            )}
            {isCounting && <div className="absolute inset-0 flex items-center justify-center text-8xl font-black text-white drop-shadow-lg">{countdown}</div>}
          </div>

          <div className="flex justify-around items-center px-6">
            <button onClick={startCamera} className="w-20 h-20 bg-blue-600 rounded-3xl text-3xl shadow-lg active:scale-90 transition-all">📸</button>
            <button 
              onClick={handleRunAnalysis} 
              disabled={loading || (!image && !voiceText)}
              className="w-24 h-24 bg-red-600 rounded-[2rem] text-4xl shadow-2xl active:scale-90 transition-all disabled:opacity-50"
            >
              🚀
            </button>
            <button onClick={() => setVoiceText(prompt("Nhập câu hỏi:") || "")} className="w-20 h-20 bg-emerald-600 rounded-3xl text-3xl shadow-lg active:scale-90 transition-all">⌨️</button>
          </div>
        </div>
      )}

      {/* MÀN HÌNH KẾT QUẢ PHÂN TẦNG */}
      {screen === 'ANALYSIS' && (
        <div className="space-y-4">
          <div className="flex bg-slate-200 p-1.5 rounded-2xl">
            {(Object.values(AgentType) as AgentType[]).map((type) => (
              <button 
                key={type}
                onClick={() => setSelectedAgent(type)}
                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${selectedAgent === type ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl min-h-[450px] border border-slate-50">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-black text-blue-600 animate-pulse text-xs">ĐANG PHÂN TÍCH...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none math-font">
                {selectedAgent === AgentType.SPEED ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-xl font-black text-indigo-700 mb-6 pb-4 border-b border-slate-100">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {results.quick?.finalAnswer || "Đang chờ đáp án..."}
                      </ReactMarkdown>
                    </div>
                    <div className="bg-emerald-50 p-5 rounded-[1.5rem] border-l-8 border-emerald-500 shadow-inner">
                      <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-3 tracking-widest">Hướng dẫn Casio 580VNX</h4>
                      <div className="text-xs font-bold text-emerald-800 leading-relaxed whitespace-pre-wrap italic">
                        {results.quick?.casioSteps || "Bài này không cần dùng máy tính."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-2">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {results.detail || "Đang soạn bài giải chi tiết..."}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </Layout>
  );
};

export default App;
