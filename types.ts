export enum Subject {
  MATH = 'Toán học',
  PHYSICS = 'Vật lí',
  CHEMISTRY = 'Hóa học',
  DIARY = 'Nhật ký'
}

// Chúng ta giữ lại 2 Agent chính như bạn muốn
export enum AgentType {
  SPEED = 'Giải 1s+Casio',
  SOCRATIC = 'Gia sư AI'
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string; // Đáp án đúng (A, B, C, hoặc D)
}

// Cấu trúc kết quả phân tầng từ AI trả về
export interface AnalysisResult {
  quick: {
    finalAnswer: string;
    casioSteps: string;
  };
  detail: string;
  quiz?: QuizQuestion; // Dùng cho bài tập tương tự nếu cần
}

export type InputMode = 'CAMERA' | 'GALLERY' | 'VOICE';
