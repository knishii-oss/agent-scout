export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { system, prompt, url } = req.body;
    
    let urlContent = '';
    if (url) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(url, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' }
        });
        clearTimeout(timeout);
        const html = await r.text();
        urlContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
      } catch {
        // URL読み取り失敗時はスキップ
      }
    }

    const fullPrompt = urlContent
      ? `【求人ページ内容】\n${urlContent}\n\n${prompt}`
      : prompt;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${fullPrompt}` }] }],
        }),
      }
    );
    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data).slice(0, 500));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                 data.error?.message || '';
    res.status(200).json({ text, debug: JSON.stringify(data).slice(0, 200) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
