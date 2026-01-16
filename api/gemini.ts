export const config = {
  runtime: 'edge', // Tối ưu tốc độ phản hồi cho Edge Network
};

export default async function (req: Request) {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // 1. SỬA LỖI QUAN TRỌNG NHẤT: Xóa dấu = thừa
  const apiKey = process.env.VITE_GEMINI_API_KEY; 

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server thiếu Gemini API Key' }), { status: 500 });
  }

  try {
    const { subject, prompt, image } = await req.json();

    // 2. Cấu trúc lại Prompt để ép AI trả về 2 kết quả (Nhanh & Chi tiết)
    const systemInstruction = `
      Bạn là chuyên gia giáo dục môn ${subject}. 
      Giải bài toán và trả về DUY NHẤT một đối tượng JSON có cấu trúc:
      {
        "quick": {
          "finalAnswer": "Đáp án cuối (Dùng LaTeX)",
          "casioSteps": "Hướng dẫn bấm máy Casio 580VNX (Dùng \\n để xuống dòng)"
        },
        "detail": "Lời giải chi tiết từng bước, logic, dùng LaTeX"
      }
      TUYỆT ĐỐI không có lời dẫn, không dùng văn nói.
    `;

    const contents = [
      {
        parts: [
          { text: `${systemInstruction}\n\nĐề bài: ${prompt}` },
          ...(image ? [{
            inlineData: {
              mimeType: "image/jpeg",
              data: image.includes(",") ? image.split(",")[1] : image
            }
          }] : [])
        ]
      }
    ];

    // 3. Gọi API Google (Bản 1.5-Flash để đạt tốc độ 1s)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1 // Độ chính xác cao
        }
      })
    });

    const data = await response.json();

    // 4. Trả kết quả về cho Frontend
    if (!data.candidates || !data.candidates[0]) {
       return new Response(JSON.stringify({ error: 'AI không phản hồi' }), { status: 500 });
    }

    const content = data.candidates[0].content.parts[0].text;
    
    return new Response(content, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Lỗi Server:", err);
    return new Response(JSON.stringify({ error: 'Lỗi máy chủ khi xử lý Gemini' }), { status: 500 });
  }
}
