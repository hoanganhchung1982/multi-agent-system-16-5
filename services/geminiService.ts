import { GoogleGenAI, Type } from "@google/genai";
import { Subject } from "../types";

// CẤU HÌNH CỐT LÕI
const API_KEY = "AIzaSyC6OnjD_SVhrSkbyEddwKe25KgedEaQsmU";
const genAI = new GoogleGenAI(API_KEY);

export interface SolveResult {
  finalAnswer: string;
  casioSteps: string;
  detailedSolution: string;
}

export const processTask = async (subject: Subject, input: string, image?: string): Promise<SolveResult | null> => {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });

  const prompt = `
    Bạn là một hệ thống AI kép cho môn ${subject}.
    NHIỆM VỤ: Phân tích đề bài và trả về JSON với cấu trúc chính xác sau:
    {
      "finalAnswer": "Chỉ đưa ra đáp án cuối cùng (ví dụ: Đáp án A. $x=2$). Dùng LaTeX.",
      "casioSteps": "Hướng dẫn bấm máy Casio 580VNX ngắn gọn: [PHÍM] -> [PHÍM]. Xuống dòng bằng \\n",
      "detailedSolution": "Lời giải chi tiết theo phong cách giáo sư Socratic, logic, khoa học, dùng LaTeX."
    }
    YÊU CẦU: Không dùng văn nói, không lời dẫn. Đề bài: ${input}
  `;

  try {
    const parts: any[] = [{ text: prompt }];
    if (image) {
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: image.split(",")[1] }
      });
    }

    const result = await model.generateContent(parts);
    const responseText = result.response.text();
    return JSON.parse(responseText) as SolveResult;
  } catch (error) {
    console.error("Lỗi AI:", error);
    return null;
  }
};
