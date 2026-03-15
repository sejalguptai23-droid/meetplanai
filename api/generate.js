module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript } = req.body;

  if (!transcript || transcript.length < 40) {
    return res.status(400).json({ error: 'Transcript too short' });
  }

  const prompt = `You are a project management AI. Analyze this meeting transcript and return ONLY valid JSON — no markdown, no explanation.

Meeting Transcript:
"""
${transcript}
"""

Return exactly this structure:
{"tasks":["Task 1","Task 2"],"wbs":[{"category":"Design","id":"1","items":[{"id":"1.1","name":"UI Design"}]}],"dependencies":[{"from":"Task A","to":"Task B","label":"must complete before"}],"actions":[{"who":"Person","what":"action"}],"timeline":[{"weeks":"Week 1-2","task":"Task Name","duration":"2 weeks"}]}

Rules: extract ALL tasks; group into WBS categories (Design/Development/Testing/Deployment); use real names for actions; sequential dependencies; realistic durations (design 1-2w, dev 2-4w, testing 1-2w); timeline starts Week 1.`;

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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const raw = data.content.map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
