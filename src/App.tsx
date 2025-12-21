import { GoogleGenerativeAI } from "@google/generative-ai";
import { Subject, AgentType } from "../types";

// Đảm bảo dùng VITE_ để Vite có thể đọc được biến môi trường
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_PROMPTS: Record<string, string> = {
  [AgentType.SPEED]: `Bạn là chuyên gia luyện thi THPT QG. Hãy giải nhanh, gọn, tập trung vào đáp án. Phải trả về định dạng JSON: {"finalAnswer": "...", "casioSteps": "..."}`,
  [AgentType.SOCRATIC]: `Bạn là giáo sư Socratic. Đừng cho đáp án ngay, hãy gợi ý bằng câu hỏi để người học tự tư duy. Dùng LaTeX cho công thức toán học.`,
  [AgentType.PERPLEXITY]: `Bạn là máy tìm kiếm kiến thức. Giải thích sâu và đưa ra 2 bài tập tương tự kèm lời giải. Dùng LaTeX.`,
};

/**
 * Xử lý tác vụ chính với AI
 */
export const processTask = async (subject: Subject, agent: AgentType, input: string, image?: string) => {
  if (!API_KEY) return "Lỗi: Chưa cấu hình API Key trong biến môi trường.";

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: agent === AgentType.SPEED 
        ? { temperature: 0.1, responseMimeType: "application/json" } 
        : { temperature: 0.2 }
    });

    const parts: any[] = [{ text: `Môn học: ${subject}.\nVai trò: ${SYSTEM_PROMPTS[agent]}\n\nĐề bài: ${input}` }];

    if (image) {
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: base64Data }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `Lỗi kết nối AI: ${error.message || "Vui lòng thử lại sau"}`;
  }
};

/**
 * Tóm tắt nội dung
 */
export const generateSummary = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`Tóm tắt nội dung sau đây trong đúng 1 câu ngắn gọn: ${content}`);
    return result.response.text();
  } catch (error) {
    console.error("Summary Error:", error);
    return "Không thể tóm tắt nội dung này.";
  }
};

/**
 * Tạo Quiz tương tự - Đã sửa lỗi JSON parse
 */
export const generateSimilarQuiz = async (content: string) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash', 
      generationConfig: { responseMimeType: "application/json" } 
    });

    const prompt = `Dựa vào nội dung này: "${content}", hãy tạo 1 câu hỏi trắc nghiệm tương tự. 
    Trả về duy nhất JSON theo cấu trúc: {"question": "...", "options": ["A", "B", "C", "D"], "answer": "đáp án đúng"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Quiz Generation Error:", error);
    return null;
  }
};

/**
 * Chuyển văn bản thành giọng nói (Giả lập hoặc gọi API)
 */
export const fetchTTSAudio = async (text: string) => {
  // Hiện tại trả về text để playStoredAudio xử lý
  return text;
};

/**
 * Phát âm thanh bằng trình duyệt
 */
export const playStoredAudio = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn("Trình duyệt không hỗ trợ TTS");
      return resolve();
    }
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    
    window.speechSynthesis.speak(utterance);
  });
};
