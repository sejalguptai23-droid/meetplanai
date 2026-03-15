module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let transcript = '';

  try {
    transcript = req.body && req.body.transcript ? req.body.transcript : '';
  } catch (e) {
    res.status(400).json({ error: 'Could not read request body' });
    return;
  }

  if (!transcript || transcript.length < 10) {
    res.status(400).json({ error: 'Transcript too short or missing' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured on server' });
    return;
  }

  const prompt = `Analyze this meeting transcript and respond with ONLY a JSON object. No markdown. No explanation. Just JSON starting with { and ending with }.

Transcript:
${transcript}

Respond with this exact JSON structure:
{"tasks":["Task 1","Task 2"],"wbs":[{"id":"1","category":"Design","items":[{"id":"1.1","name":"UI Design"}]},{"id":"2","category":"Development","items":[{"id":"2.1","name":"Backend API"}]},{"id":"3","category":"Testing","items":[{"id":"3.1","name":"QA Testing"}]}],"dependencies":[{"from":"Task 1","to":"Task 2","label":"must complete before"}],"actions":[{"who":"Person","what":"action description"}],"timeline":[{"weeks":"Week 1-2","task":"Task 1","duration":"2 weeks"},{"weeks":"Week 3-4","task":"Task 2","duration":"2 weeks"}]}`;

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const apiText = await apiResponse.text();

    if (!apiText || apiText.trim() === '') {
      res.status(500).json({ error: 'Empty response from Anthropic API' });
      return;
    }

    let apiData;
    try {
      apiData = JSON.parse(apiText);
    } catch (e) {
      res.status(500).json({ error: 'Anthropic returned invalid JSON: ' + apiText.slice(0, 100) });
      return;
    }

    if (apiData.error) {
      res.status(500).json({ error: 'Anthropic error: ' + (apiData.error.message || JSON.stringify(apiData.error)) });
      return;
    }

    if (!apiData.content || !apiData.content[0] || !apiData.content[0].text) {
      res.status(500).json({ error: 'No content in Anthropic response' });
      return;
    }

    let text = apiData.content[0].text;
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      res.status(500).json({ error: 'No JSON found in AI response: ' + text.slice(0, 100) });
      return;
    }

    const jsonText = text.slice(firstBrace, lastBrace + 1);

    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (e) {
      res.status(500).json({ error: 'Could not parse AI JSON: ' + e.message });
      return;
    }

    res.status(200).json(result);

  } catch (err) {
    res.status(500).json({ error: 'Function error: ' + err.message });
  }
};
