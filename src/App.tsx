import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Subject, AgentType } from '../types';
import { Layout } from '../components/Layout';
// Đảm bảo geminiService.ts đã sửa theo hướng trả về JSON gộp
import { processTask, fetchTTSAudio, playStoredAudio } from '../services/geminiService.ts';

interface DiaryEntry {
  date: string;
  subject: Subject;
  mode: AgentType;
  input: string; 
  image?: string; 
  resultContent: string; 
  casioSteps?: string; 
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<'HOME' | 'INPUT' | 'ANALYSIS' | 'DIARY'>('HOME');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(AgentType.SPEED);
  
  // States cho dữ liệu
  const [image, setImage] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{quick?: any, detail?: string}>({});
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  // States UI Camera/Record
  const [showCamera, setShowCamera] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isCounting, setIsCounting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // LOAD DIARY
  useEffect(() => {
    const saved = localStorage.getItem('symbiotic_diary');
    if (saved) setDiaryEntries(JSON.parse(saved));
  }, []);

  // XỬ LÝ CHÍNH: CHẠY AI (1 LẦN CHO CẢ 2)
  const handleRunAnalysis = useCallback(async () => {
    if (!selectedSubject || (!image && !voiceText)) return;
    
    setLoading(true);
    setScreen('ANALYSIS');

    try {
      // Gọi service (đã tối giản chỉ còn 1 hàm duy nhất)
      const data = await processTask(selectedSubject, voiceText, image || undefined);
      if (data) {
        setResults(data); // Lưu cả quick và detail vào state
      }
    } catch (err) {
      console.error("Lỗi build/fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, image, voiceText]);

  // CHỤP ẢNH (LOGIC NHANH)
  const startCamera = async () => {
    setShowCamera(true); setIsCounting(true); setCountdown(3);
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (videoRef.current) videoRef.current.srcObject = s;
  };

  useEffect(() => {
    if (isCounting && countdown > 0) {
      setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (isCounting && countdown === 0) {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        canvasRef.current
