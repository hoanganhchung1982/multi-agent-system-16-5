// --- File: api/gemini.ts ---
export const config = { runtime: 'edge' };

export default async function (req: Request) {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  const { subject, agent, prompt, image } = await req.json();

  const instructions = {
    SPEED: `Giải nhanh, đáp án ngắn gọn. Trả về JSON: { "finalAnswer": "...", "casioSteps": "...", "summary": "1 câu mấu chốt để đọc", "quiz": { "question": "...", "options": ["A","B","C","D"], "answer": "A" } }`,
    SOCRATIC: `Giải thích sư phạm sâu sắc. Trả về JSON: { "content": "...", "summary": "1 câu mấu chốt để đọc" }`,
    PERPLEXITY: `Tạo bài tập thực hành. Trả về JSON: { "content": "...", "summary": "Thông điệp luyện tập" }`
  };

  const systemPrompt = `Bạn là chuyên gia ${subject}. ${instructions[agent] || instructions.SPEED}. Dùng LaTeX với $.`;

  const payload = {
    contents: [{
      parts: [
        { text: `${systemPrompt}\n\nĐề bài: ${prompt}` },
        ...(image ? [{ inlineData: { mimeType: "image/jpeg", data: image.split(",")[1] }}] : [])
      ]
    }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  return new Response(data.candidates[0].content.parts[0].text, {
    headers: { 'Content-Type': 'application/json' }
  });
}
