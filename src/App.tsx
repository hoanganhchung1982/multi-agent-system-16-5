import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subject, AgentType } from "../types";

// 1. CẤU HÌNH MODEL
const MODEL_CONFIG = {
  TEXT: 'gemini-1.5-flash',
};

const cache = new Map<string, string>();

// 2. KHỞI TẠO (Sử dụng VITE_ cho biến môi trường)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPTS: Record<string, string> = {
  [AgentType.SPEED]: `Expert THPT QG. Return JSON ONLY: {"finalAnswer": "result with LaTeX", "casioSteps": "calculator steps"}. No prose.`,
  [AgentType.SOCRATIC]: `Socratic Professor. Explain logic deeply but concisely. Use LaTeX.`,
  [AgentType.PERPLEXITY]: `Searcher. Provide 2 similar advanced problems. Use LaTeX.`,
};

// 3. HÀM XỬ LÝ CHÍNH
export const processTask = async (subject: Subject, agent: AgentType, input: string, image?: string) => {
  const cacheKey = `${agent}-${input}-${!!image}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_CONFIG.TEXT,
      generationConfig: agent === AgentType.SPEED ? { temperature: 0.1, responseMimeType: "application/json" } : { temperature: 0.2 }
    });

    const parts: any[] = [{ text: `Môn: ${subject}. ${SYSTEM_PROMPTS[agent]} \nĐề bài: ${input}` }];
    if (image) {
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();
    cache.set(cacheKey, text);
    return text;
  } catch (error) {
    console.error("AI Error:", error);
    return "Lỗi kết nối AI hoặc hình ảnh không hợp lệ.";
  }
};

// 4. CÁC HÀM BỔ TRỢ
export const generateSummary = async (content: string) => {
  if (!content) return "";
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_CONFIG.TEXT });
    const result = await model.generateContent(`Tóm tắt 1 câu cực ngắn để đọc: ${content}`);
    return result.response.text();
  } catch { return ""; }
};

export const generateSimilarQuiz = async (content: string) => {
  if (!content) return null;
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_CONFIG.TEXT,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(`Tạo 1 câu trắc nghiệm JSON {question, options, answer} từ: ${content}`);
    return JSON.parse(result.response.text());
  } catch { return null; }
};

// 5. AUDIO (Dùng Web Speech API cho ổn định)
export const fetchTTSAudio = async (text: string) => {
  return text; 
};

export const playStoredAudio = (text: string) => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(null);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.1;
    utterance.onend = () => resolve(null);
    utterance.onerror = () => resolve(null);
    window.speechSynthesis.speak(utterance);
  });
};
