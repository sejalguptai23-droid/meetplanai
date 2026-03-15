module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { transcript } = req.body;

    if (!transcript || transcript.length < 40) {
      return res.status(400).json({ error: 'Transcript too short' });
    }

    const prompt = `Analyze this meeting transcript and respond with ONLY a JSON object. No markdown, no explanation, no backticks. Just raw JSON starting with { and ending with }.

Transcript:
${transcript}

JSON format to use:
{
  "tasks": ["task1", "task2"],
  "wbs": [
    {"id": "1", "category": "Design", "items": [{"id": "1.1", "name": "UI Design"}]},
    {"id": "2", "category": "Development", "items": [{"id": "2.1", "name": "Backend API"}]},
    {"id": "3", "category": "Testing", "items": [{"id": "3.1", "name": "QA Testing"}]}
  ],
  "dependencies": [
    {"from": "task1", "to": "task2", "label": "must complete before"}
  ],
  "actions": [
    {"who": "Person", "what": "action description"}
  ],
  "timeline": [
    {"weeks": "Week 1-2", "task": "task1", "duration": "2 weeks"}
  ]
}`;

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const apiData = await apiResponse.json();

    if (apiData.error) {
      return res.status(500).json({ error: apiData.error.message || 'API error' });
    }

    if (!apiData.content || !apiData.content[0]) {
      return res.status(500).json({ error: 'No content returned from AI' });
    }

    let text = apiData.content[0].text || '';

    // Remove any markdown formatting
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Find the JSON object
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: 'AI did not return valid JSON' });
    }

    const jsonText = text.slice(firstBrace, lastBrace + 1);
    const result = JSON.parse(jsonText);

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
