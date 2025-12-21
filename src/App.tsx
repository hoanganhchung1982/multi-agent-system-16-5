import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subject, AgentType } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPTS: Record<string, string> = {
  [AgentType.SPEED]: `Expert. Return JSON: {"finalAnswer": "đáp án LaTeX", "casioSteps": "bước Casio"}. No prose.`,
  [AgentType.SOCRATIC]: `Professor. Giải chi tiết logic ngắn gọn. Dùng LaTeX.`,
  [AgentType.PERPLEXITY]: `Searcher. Đưa ra 2 bài tập tương tự. Dùng LaTeX.`,
};

export const processTask = async (subject: Subject, agent: AgentType, input: string, image?: string) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { temperature: 0.1, responseMimeType: agent === AgentType.SPEED ? "application/json" : "text/plain" }
    });
    const parts: any[] = [{ text: `Môn: ${subject}. ${SYSTEM_PROMPTS[agent]} \nĐề: ${input}` }];
    if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } });
    
    const result = await model.generateContent(parts);
    return result.response.text();
  } catch (error) {
    return "Lỗi kết nối AI.";
  }
};

export const generateSummary = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent("Tóm tắt 1 câu cực ngắn: " + content);
    return res.response.text();
  } catch { return ""; }
};

export const generateSimilarQuiz = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      generationConfig: { responseMimeType: "application/json" } 
    });
    const res = await model.generateContent("Tạo 1 câu trắc nghiệm JSON {question, options, answer} tương tự: " + content);
    return JSON.parse(res.response.text());
  } catch { return null; }
};

export const fetchTTSAudio = async (text: string) => text;

export const playStoredAudio = (text: string) => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve(null);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    u.rate = 1.1;
    u.onend = () => resolve(null);
    window.speechSynthesis.speak(u);
  });
};
