export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const surfResponse = await fetch('https://www.surf-forecast.com/breaks/Hotpipe/forecasts/latest/six_day', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!surfResponse.ok) {
      throw new Error('Could not fetch surf data');
    }

    const html = await surfResponse.text();

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Analyze this surf forecast data and find ONLY days in the next 3 days with GOOD conditions. Return ONLY valid JSON array, no other text.

GOOD means: wave height 1.5ft+, period 5+ seconds, northerly winds (N/NNE/NW), around low tide ±2 hours, daylight hours.

Return format: [{"date":"Day","bestTime":"HH:MM","waveHeight":"Xft","wavePeriod":"Xs","wind":"Direction Xkts","tideTiming":"HH:MM"}]

Data: ${html.substring(0, 5000)}`
        }]
      })
    });

    const claudeData = await claudeResponse.json();

    if (!claudeResponse.ok) {
      throw new Error(claudeData.error?.message || 'Claude error');
    }

    const text = claudeData.content[0]?.text || '[]';
    const jsonMatch = text.match(/\[.*\]/s);
    const forecast = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return res.status(200).json({ forecast });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
