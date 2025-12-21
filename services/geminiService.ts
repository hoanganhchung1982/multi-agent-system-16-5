import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subject, AgentType } from "../types";

// 1. CẤU HÌNH
const MODEL_CONFIG = {
  TEXT: 'gemini-1.5-flash',
};

const cache = new Map<string, string>();
const audioCache = new Map<string, string>();

// 2. KHỞI TẠO (Dùng VITE_ cho biến môi trường)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPTS: Record<string, string> = {
  [AgentType.SPEED]: `Expert THPT QG. Return JSON ONLY: {"finalAnswer": "result with LaTeX", "casioSteps": "calculator steps"}. No prose.`,
  [AgentType.SOCRATIC]: `Socratic Professor. Explain logic deeply nhưng ngắn gọn. Use LaTeX.`,
  [AgentType.PERPLEXITY]: `Searcher. Provide 2 tương tự nâng cao. Use LaTeX.`,
};

// 3. XỬ LÝ CHÍNH
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
    return "Lỗi kết nối AI.";
  }
};

// 4. TIỆN ÍCH (Summary & Quiz)
export const generateSummary = async (content: string) => {
  if (!content) return "";
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_CONFIG.TEXT });
    const result = await model.generateContent(`Tóm tắt 1 câu ngắn gọn để đọc: ${content}`);
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

// 5. ÂM THANH (Dùng Web Speech API cho nhẹ và ổn định khi Build)
export const fetchTTSAudio = async (text: string) => {
  // Trả về chính text để hàm play nhận diện
  return text; 
};

export const playStoredAudio = (text: string) => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(null);
    
    // Hủy các câu đang nói dở
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.1; // Tốc độ nhanh hơn chút cho chuyên nghiệp
    utterance.onend = () => resolve(null);
    utterance.onerror = () => resolve(null);
    
    window.speechSynthesis.speak(utterance);
  });
};
