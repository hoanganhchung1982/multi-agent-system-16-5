import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subject, AgentType } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Cache kết quả để nếu quay lại câu cũ sẽ hiện ngay 0ms
const resultCache = new Map<string, string>();

export const processTask = async (subject: Subject, agent: AgentType, input: string, image?: string) => {
  const cacheKey = `${agent}-${input.substring(0, 50)}-${!!image}`;
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey)!;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // Model nhanh nhất hiện tại
      generationConfig: {
        temperature: 0.1, // Thấp để AI trả lời thẳng thừng, không rườm rà
        topP: 0.1,
        responseMimeType: agent === AgentType.SPEED ? "application/json" : "text/plain"
      }
    });

    const parts: any[] = [{ text: `Môn: ${subject}. Agent: ${agent}. Yêu cầu: Trả lời cực ngắn gọn, dùng LaTeX. \nĐề: ${input}` }];
    if (image) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();
    resultCache.set(cacheKey, text);
    return text;
  } catch (error) {
    return "Lỗi kết nối.";
  }
};

// Các hàm phụ chạy ngầm (Background)
export const generateSummary = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent("Tóm tắt 1 câu ngắn: " + content);
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

export const playStoredAudio = (text: string) => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve(null);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    u.rate = 1.2; // Tăng tốc độ đọc lên 1.2x để cảm giác nhanh hơn
    u.onend = () => resolve(null);
    window.speechSynthesis.speak(u);
  });
};
