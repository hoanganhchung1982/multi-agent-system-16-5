import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Subject, AgentType } from "../types";

// CẤU HÌNH MODEL - Tối ưu cho tốc độ và hiệu năng
const MODEL_CONFIG = {
  TEXT: 'gemini-1.5-flash', // Dùng bản ổn định để tránh lỗi preview
  TTS: 'gemini-1.5-flash',  // Dùng flash cho cả TTS để đồng nhất
};

// CACHING LAYER - "Siêu Tốc Độ"
const cache = new Map<string, string>();
const audioCache = new Map<string, string>();

const getCacheKey = (subject: string, agent: string, input: string, imageHash: string = '') => 
  `${subject}|${agent}|${input.trim()}|${imageHash}`;

// SỬA LỖI: Vite dùng import.meta.env thay vì process.env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  [AgentType.SPEED]: `Bạn là chuyên gia giải đề thi THPT Quốc gia.
    NHIỆM VỤ: Trả về một đối tượng JSON với hai trường: "finalAnswer" và "casioSteps".
    1. finalAnswer (string): Chỉ đưa ra KẾT QUẢ CUỐI CÙNG. TUYỆT ĐỐI KHÔNG giải thích chi tiết.
    2. casioSteps (string): Hướng dẫn NGẮN GỌN NHẤT cách bấm Casio fx-580VN X.
    YÊU CẦU: Luôn sử dụng LaTeX cho công thức toán học (ví dụ: $x^2$, $\frac{a}{b}$).`,
  [AgentType.SOCRATIC]: `Bạn là giáo sư Socratic. Hãy giải chi tiết bài toán theo các bước logic chặt chẽ. Ngôn ngữ khoa học, cực kỳ ngắn gọn. Luôn sử dụng LaTeX cho công thức.`,
  [AgentType.PERPLEXITY]: `Bạn là Perplexity AI. Liệt kê 2 DẠNG BÀI TẬP NÂNG CAO liên quan đến chủ đề này. Chỉ nêu ĐỀ BÀI, không giải. Luôn sử dụng LaTeX.`,
};

async function safeExecute<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
}

export const processTask = async (subject: Subject, agent: AgentType, input: string, image?: string) => {
  const cacheKey = getCacheKey(subject, agent, input, image ? 'has_img' : 'no_img');
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  return safeExecute(async () => {
    let promptContent = `Môn: ${subject}. Chuyên gia: ${agent}. Yêu cầu: ${SYSTEM_PROMPTS[agent]}. \nNội dung: ${input}`;
    const parts: any[] = [{ text: promptContent }];
    
    if (image) {
      // Chuẩn hóa Base64
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
    }

    const model = ai.getGenerativeModel({ model: MODEL_CONFIG.TEXT });
    
    const config: any = {
      temperature: 0.1,
      topP: 0.5,
    };

    // Chỉ áp dụng Schema cho Agent SPEED
    if (agent === AgentType.SPEED) {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: Type.OBJECT,
        properties: {
          finalAnswer: { type: Type.STRING },
          casioSteps: { type: Type.STRING }
        },
        required: ["finalAnswer", "casioSteps"]
      };
    }

    const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: config
    });

    const resultText = result.response.text();
    if (resultText) cache.set(cacheKey, resultText);
    return resultText;
  });
};

export const generateSummary = async (content: string) => {
  if (!content) return "";
  return safeExecute(async () => {
    const model = ai.getGenerativeModel({ model: MODEL_CONFIG.TEXT });
    const result = await model.generateContent(`Tóm tắt cực ngắn gọn 1 câu để đọc: ${content}`);
    return result.response.text();
  });
};

export const generateSimilarQuiz = async (content: string): Promise<any> => {
  if (!content) return null;
  return safeExecute(async () => {
    const model = ai.getGenerativeModel({ model: MODEL_CONFIG.TEXT });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Dựa vào: "${content}", tạo 1 câu trắc nghiệm. Trả về JSON {question, options, answer}.` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING }
          },
          required: ["question", "options", "answer"]
        }
      }
    });
    return JSON.parse(result.response.text());
  });
};

export const fetchTTSAudio = async (text: string) => {
  if (!text) return undefined;
  if (audioCache.has(text)) return audioCache.get(text);

  return safeExecute(async () => {
    const model = ai.getGenerativeModel({ model: MODEL_CONFIG.TEXT }); // Dùng chung model text
    const response = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO" as Modality],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
      },
    });
    const data = response.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (data) audioCache.set
