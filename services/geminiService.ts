export const config = {
  runtime: 'edge', // Tối ưu tốc độ phản hồi cực nhanh
};

export default async function (req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // SỬA LỖI: Xóa dấu = thừa tại đây
  const apiKey = process.env.VITE_GEMINI_API_KEY; 

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server thiếu API Key' }), { status: 500 });
  }

  try {
    const { subject, prompt, image } = await req.json();

    const contents = [{
      parts: [
        { text: `Giải môn ${subject} và trả về JSON { "quick": {...}, "detail": "..." }: ${prompt}` },
        ...(image ? [{ inlineData: { mimeType: "image/jpeg", data: image.split(",")[1] } }] : [])
      ]
    }];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;

    return new Response(content, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Lỗi server' }), { status: 500 });
  }
}
