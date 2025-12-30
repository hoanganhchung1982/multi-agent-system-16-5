// --- File: services/geminiService.ts ---
export const optimizeImage = async (base64Str: string): Promise<string> => {
  // ... (giữ nguyên logic canvas nén ảnh của bạn) ...
};

export const processTask = async (subject: string, agent: string, prompt: string, image?: string) => {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    body: JSON.stringify({ subject, agent, prompt, image: image ? await optimizeImage(image) : undefined })
  });
  return res.json();
};

export const fetchTTSAudio = async (text: string) => {
  // Logic gọi API Text-to-speech của bạn (Google TTS hoặc tương tự)
};

export const playStoredAudio = async (base64: string, ref: any) => {
  // Logic phát audio của bạn
};
