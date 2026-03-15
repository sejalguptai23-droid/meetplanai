module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transcript } = req.body;
  if (!transcript || transcript.length < 40) return res.status(400).json({ error: 'Transcript too short' });

  const prompt = `You are a project management AI. Analyze this meeting transcript.

Meeting Transcript:
"""
${transcript}
"""

You MUST respond with ONLY a valid JSON object. No text before or after. No markdown. No backticks. Start your response with { and end with }.

Use exactly this format:
{"tasks":["Task 1","Task 2","Task 3"],"wbs":[{"category":"Design","id":"1","items":[{"id":"1.1","name":"UI Design"}]},{"category":"Development","id":"2","items":[{"id":"2.1","name":"Backend API"}]},{"category":"Testing","id":"3","items":[{"id":"3.1","name":"QA Testing"}]}],"dependencies":[{"from":"Task 1","to":"Task 2","label":"must complete before"}],"actions":[{"who":"Person Name","what":"what they need to do"}],"timeline":[{"weeks":"Week 1-2","task":"Task 1","duration":"2 weeks"},{"weeks":"Week 3-5","task":"Task 2","duration":"3 weeks"}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Anthropic API error: ' + errText });
    }

    const data = await response.json();

    if (!data.content || data.content.length === 0) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    let raw = data.content.map(b => b.text || '').join('');

    // Strip any markdown or extra text
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    // Extract JSON object if there is extra text around it
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON found in response' });
    }
    raw = raw.slice(start, end + 1);

    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
