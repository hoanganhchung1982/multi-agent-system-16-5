
import React, { useState, useEffect, useRef } from 'react';
import { Subject, DiaryEntry, AIResponse, AppState } from './types';
import { getSolution, transcribeAudio } from './services/geminiService';
import { ProfessorTab } from './components/ProfessorTab';

const AtomicLogo: React.FC = () => {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center mb-12">
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          <radialGradient id="sphereGreen" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#10b981" />
          </radialGradient>
          <radialGradient id="sphereYellow" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fbbf24" />
          </radialGradient>
          <radialGradient id="spherePink" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f472b6" />
          </radialGradient>
        </defs>

        {[0, 60, 120].map((rotation, i) => (
          <g key={`back-${i}`} transform={`rotate(${rotation} 100 100)`}>
            <ellipse 
              cx="100" cy="100" rx="80" ry="32" 
              fill="none" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="1.8" 
            />
          </g>
        ))}

        <foreignObject x="80" y="80" width="40" height="40">
          <div 
            className="w-full h-full rounded-full flex items-center justify-center shadow-xl z-10"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #2563eb 100%)',
              boxShadow: 'inset -2px -2px 8px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3)'
            }}
          >
            <span className="text-white font-black text-[8px] drop-shadow-md select-none tracking-tighter">SM-AS</span>
          </div>
        </foreignObject>

        {[0, 60, 120].map((rotation, i) => {
          const colors = ['url(#sphereGreen)', 'url(#sphereYellow)', 'url(#spherePink)'];
          return (
            <g key={`front-${i}`} transform={`rotate(${rotation} 100 100)`}>
              <ellipse 
                cx="100" cy="100" rx="80" ry="32" 
                fill="none" 
                stroke="rgba(255,255,255,0.5)" 
                strokeWidth="2.2" 
              />
              <circle r="7" fill={colors[i]} className="shadow-lg">
                <animateMotion 
                  dur={`${7 + i * 1.5}s`} 
                  repeatCount="indefinite" 
                  path="M 20,100 a 80,32 0 1,0 160,0 a 80,32 0 1,0 -160,0"
                />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.HOME);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [rating, setRating] = useState<number>(0);

  // Inputs
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Camera & Timer
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const timerRef = useRef<any>(null);

  // Resizable Crop Area State
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 50 }); // in percentages

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const savedDiary = localStorage.getItem('study_diary');
    if (savedDiary) setDiary(JSON.parse(savedDiary));
    const savedRating = localStorage.getItem('app_rating');
    if (savedRating) setRating(parseInt(savedRating));
  }, []);

  // Countdown logic for camera
  useEffect(() => {
    if (isCameraActive && countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (isCameraActive && countdown === 0) {
      capturePhoto();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isCameraActive, countdown]);

  const addToDiary = (subject: Subject) => {
    const newEntry = {
      timestamp: new Date().toLocaleString('vi-VN'),
      subject
    };
    const updated = [newEntry, ...diary].slice(0, 50);
    setDiary(updated);
    localStorage.setItem('study_diary', JSON.stringify(updated));
  };

  const handleRating = (stars: number) => {
    setRating(stars);
    localStorage.setItem('app_rating', stars.toString());
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setCountdown(10);
      }
    } catch (err) {
      alert("Vui lòng cấp quyền camera trong cài đặt trình duyệt.");
    }
  };

  const toggleCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (isCameraActive) {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: newMode } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err) {
        console.error("Lỗi khi chuyển camera:", err);
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const sx = (cropBox.x / 100) * videoWidth;
      const sy = (cropBox.y / 100) * videoHeight;
      const sw = (cropBox.w / 100) * videoWidth;
      const sh = (cropBox.h / 100) * videoHeight;

      canvas.width = sw;
      canvas.height = sh;

      context.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const b64 = reader.result as string;
          setRecordedAudio(b64);
          setIsTranscribing(true);
          try {
            const text = await transcribeAudio(b64);
            setInputText(prev => prev + (prev ? " " : "") + text);
          } catch (e) {
            console.error("Transcription error", e);
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      alert("Vui lòng cấp quyền microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCapturedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!selectedSubject) return;
    setIsLoading(true);
    setState(AppState.PROCESSING);
    try {
      const data = await getSolution(selectedSubject, inputText, capturedImage || undefined, recordedAudio || undefined);
      setResult(data);
      setState(AppState.RESULT);
      addToDiary(selectedSubject);
    } catch (err) {
      console.error(err);
      alert("Kết nối không ổn định hoặc lỗi xử lí AI. Vui lòng thử lại.");
      setState(AppState.SUBJECT_INPUT);
    } finally {
      setIsLoading(false);
    }
  };

  const resetInputs = () => {
    setCapturedImage(null);
    setRecordedAudio(null);
    setInputText("");
    setResult(null);
    setActiveTab(0);
  };

  if (state === AppState.HOME) {
    return (
      <div className="min-h-screen bg-blue-600 flex flex-col transition-colors duration-500 overflow-x-hidden">
        <div className="max-w-4xl mx-auto w-full p-6 flex flex-col flex-grow">
          <header className="py-6 text-center flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow-md whitespace-nowrap overflow-hidden text-ellipsis">
              Hệ sinh thái học tập cộng sinh
            </h1>
            <div className="text-blue-100 font-medium text-sm">
              Trí tuệ nhân tạo đồng hành cùng tri thức
            </div>
            <div className="text-blue-200 font-bold text-base mt-1">
              Multi Agent System 16.5
            </div>
          </header>

          <div className="flex-grow flex flex-col items-center justify-center">
            <AtomicLogo />

            <div className="grid grid-cols-2 gap-4 mb-12 w-full max-w-sm">
              {['Toán học', 'Vật lí'].map((sub) => (
                <button
                  key={sub}
                  onClick={() => {
                    setSelectedSubject(sub as Subject);
                    setState(AppState.SUBJECT_INPUT);
                    resetInputs();
                  }}
                  className="group p-5 bg-white/95 rounded-2xl shadow-lg border border-white/20 hover:bg-white hover:scale-105 transition-all flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl font-bold group-hover:rotate-12 transition-transform">
                    {sub === 'Toán học' ? '∑' : '⚛'}
                  </div>
                  <span className="text-base font-bold text-slate-800">{sub}</span>
                </button>
              ))}
              
              <button
                onClick={() => {
                  setSelectedSubject('Hóa học');
                  setState(AppState.SUBJECT_INPUT);
                  resetInputs();
                }}
                className="group p-5 bg-white/95 rounded-2xl shadow-lg border border-white/20 hover:bg-white hover:scale-105 transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl group-hover:rotate-12 transition-transform">🧪</div>
                <span className="text-base font-bold text-slate-800">Hóa học</span>
              </button>

              <button
                onClick={() => setState(AppState.DIARY)}
                className="group p-5 bg-indigo-500 text-white rounded-2xl shadow-lg border border-white/20 hover:bg-indigo-400 hover:scale-105 transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">📖</div>
                <span className="text-base font-bold">Nhật kí</span>
              </button>
            </div>

            <div className="w-full max-w-sm text-center">
              <p className="text-sm font-bold text-blue-100 mb-3 tracking-widest uppercase">Bình chọn ứng dụng</p>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    className={`text-4xl transition-all hover:scale-125 active:scale-90 ${rating >= star ? 'text-yellow-400 drop-shadow-lg' : 'text-blue-300/40'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {rating > 0 && <p className="text-xs text-blue-100 mt-3 font-semibold">Cảm ơn bạn đã đồng hành!</p>}
            </div>
          </div>

          <footer className="py-8 text-center border-t border-white/10 mt-auto">
            <p className="text-sm font-bold text-blue-100 tracking-wide">Science Technology Project 2025</p>
            <p className="text-xs text-blue-200/60 mt-1 font-medium">@Team AI Mai Son High School</p>
          </footer>
        </div>
      </div>
    );
  }

  if (state === AppState.DIARY) {
    return (
      <div className="max-w-4xl mx-auto p-6 min-h-screen flex flex-col bg-slate-50">
        <button onClick={() => setState(AppState.HOME)} className="mb-6 flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors font-bold group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Quay lại trang chủ
        </button>

        <section className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex-grow">
          <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
            📖 Lịch sử học tập
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-sm font-bold text-slate-600">Thời gian truy cập</th>
                  <th className="px-8 py-5 text-sm font-bold text-slate-600">Môn học</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {diary.length > 0 ? diary.map((entry, i) => (
                  <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-5 text-sm text-slate-500 font-medium">{entry.timestamp}</td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-800">
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">{entry.subject}</span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={2} className="px-8 py-20 text-center text-slate-400 font-medium italic">Chưa có hoạt động nào được ghi lại.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (state === AppState.SUBJECT_INPUT) {
    return (
      <div className="max-w-2xl mx-auto p-6 min-h-screen">
        <button onClick={() => setState(AppState.HOME)} className="mb-6 flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Quay lại
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-8 border-l-4 border-blue-600 pl-4">Học tập: {selectedSubject}</h2>

        <div className="space-y-6">
          <div className="relative group">
            <textarea
              className="w-full p-6 rounded-3xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none min-h-[160px] font-medium text-lg transition-all shadow-sm"
              placeholder={isTranscribing ? "Đang chuyển đổi giọng nói..." : "Gõ đề bài hoặc mô tả nội dung tại đây..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isTranscribing}
            />
            {isTranscribing && (
              <div className="absolute inset-0 bg-white/50 rounded-3xl flex items-center justify