
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, Subject } from "../types";

export const transcribeAudio = async (audioB64: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: "Hãy chuyển đổi âm thanh tiếng Việt này thành văn bản một cách chính xác nhất. Chỉ trả về văn bản đã chuyển đổi, không thêm bất kỳ nội dung nào khác." },
        {
          inlineData: {
            mimeType: "audio/wav",
            data: audioB64.split(',')[1] || audioB64
          }
        }
      ]
    }
  });
  return response.text || "";
};

export const getSolution = async (
  subject: Subject,
  text?: string,
  imageB64?: string,
  audioB64?: string
): Promise<AIResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `Bạn là một chuyên gia giáo dục đa năng. 
YÊU CẦU QUAN TRỌNG: 
1. Nội dung phải CỰC KỲ NGẮN GỌN, XÚC TÍCH.
2. Tuyệt đối KHÔNG sử dụng câu dẫn (như "Chào bạn", "Sau đây là lời giải",...). 
3. Tập trung thẳng vào mấu chốt vấn đề, công thức và đáp án.
4. Ngôn ngữ chuẩn xác theo chuyên môn môn ${subject}.`;

  const parts: any[] = [
    { text: `${systemInstruction}\nGiải bài tập môn ${subject}.` }
  ];

  if (text) parts.push({ text: `Đề bài: ${text}` });
  if (imageB64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageB64.split(',')[1] || imageB64
      }
    });
  }
  if (audioB64) {
    parts.push({
      inlineData: {
        mimeType: "audio/wav",
        data: audioB64.split(',')[1] || audioB64
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING, description: "Lời giải trực tiếp, siêu ngắn gọn" },
          tutorial: { type: Type.STRING, description: "Hướng dẫn cốt lõi, mấu chốt tư duy (không rườm rà)" },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING, description: "Giải thích mấu chốt tại sao chọn" }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["answer", "tutorial", "quiz"]
      }
    }
  });

  return JSON.parse(response.text);
};
