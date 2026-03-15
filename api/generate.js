module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const transcript = req.body && req.body.transcript ? req.body.transcript : '';
  if (!transcript || transcript.length < 10) { res.status(400).json({ error: 'Transcript too short' }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Groq API key not configured' }); return; }

  const prompt = `Analyze this meeting transcript and respond with ONLY a JSON object. No markdown. No explanation. Just JSON starting with { and ending with }.

Transcript:
${transcript}

Respond with exactly this JSON structure:
{"tasks":["Task 1","Task 2"],"wbs":[{"id":"1","category":"Design","items":[{"id":"1.1","name":"UI Design"}]},{"id":"2","category":"Development","items":[{"id":"2.1","name":"Backend API"}]},{"id":"3","category":"Testing","items":[{"id":"3.1","name":"QA Testing"}]}],"dependencies":[{"from":"Task 1","to":"Task 2","label":"must complete before"}],"actions":[{"who":"Person","what":"action description"}],"timeline":[{"weeks":"Week 1-2","task":"Task 1","duration":"2 weeks"},{"weeks":"Week 3-4","task":"Task 2","duration":"2 weeks"}]}`;

  try {
    const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    const apiText = await apiResponse.text();

    if (!apiText || apiText.trim() === '') {
      res.status(500).json({ error: 'Empty response from Groq' }); return;
    }

    let apiData;
    try { apiData = JSON.parse(apiText); }
    catch (e) { res.status(500).json({ error: 'Groq returned invalid response' }); return; }

    if (apiData.error) {
      res.status(500).json({ error: 'Groq error: ' + apiData.error.message }); return;
    }

    if (!apiData.choices || !apiData.choices[0]) {
      res.status(500).json({ error: 'No response from Groq' }); return;
    }

    let text = apiData.choices[0].message.content || '';
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      res.status(500).json({ error: 'No JSON found in Groq response' }); return;
    }

    const jsonText = text.slice(firstBrace, lastBrace + 1);

    let result;
    try { result = JSON.parse(jsonText); }
    catch (e) { res.status(500).json({ error: 'Could not parse JSON: ' + e.message }); return; }

    res.status(200).json(result);

  } catch (err) {
    res.status(500).json({ error: 'Function error: ' + err.message });
  }
};
