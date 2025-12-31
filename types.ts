
export type Subject = 'Toán học' | 'Vật lí' | 'Hóa học';

export interface DiaryEntry {
  timestamp: string;
  subject: Subject;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface AIResponse {
  answer: string;
  tutorial: string;
  quiz: QuizQuestion[];
}

export enum AppState {
  HOME = 'home',
  SUBJECT_INPUT = 'subject_input',
  PROCESSING = 'processing',
  RESULT = 'result',
  DIARY = 'diary'
}
