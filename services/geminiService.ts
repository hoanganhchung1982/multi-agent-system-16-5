import { Subject } from "../types";

export const processTask = async (subject: Subject, prompt: string, image?: string) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, prompt, image })
    });

    if (!response.ok) throw new Error('Network error');
    return await response.json();
  } catch (error) {
    console.error("Lỗi:", error);
    return null;
  }
};

// Khai báo rỗng để tránh lỗi "Variable not found" trong App.tsx
export const fetchTTSAudio = async () => null;
export const playStoredAudio = async () => {};
