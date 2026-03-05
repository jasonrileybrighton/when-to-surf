export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    // Fetch live data from Surf-Forecast.com
    const surfForecastResponse = await fetch(
      'https://www.surf-forecast.com/breaks/Hotpipe/forecasts/latest/six_day',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!surfForecastResponse.ok) {
      throw new Error('Failed to fetch Surf-Forecast data');
    }

    const surfForecastHTML = await surfForecastResponse.text();

    // Send to Claude for analysis
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `You are a professional surf forecasting analyzer for Hot Pipe, Shoreham, East Sussex.

Analyze the following Surf-Forecast.com data and identify ONLY the days in the next 3 days that meet these "GOOD" conditions:

GOOD CONDITIONS CRITERIA:
- Wave height: 1.5 feet or more
- Wave period (interval): 5+ seconds between waves
- Wind direction: Northerly ONLY (N, NNE, NW)
- Timing: Must be within ±2 hours around BOTH daily low tides
- Hours: Only during daylight, dawn, or dusk hours (roughly 6 AM - 8 PM)

IMPORTANT INSTRUCTIONS:
1. Check the data for the next 3 days ONLY
2. Only show days that meet ALL the criteria above
3. For each good day found, provide:
   - Date
   - Exact best time window (e.g., "2:30 PM - 3:30 PM")
   - Wave height (in feet)
   - Wave period/interval (in seconds)
   - Wind direction and speed
   - Low tide timing for that day
4. If NO days meet the criteria, respond with an empty forecast list
5. Format your response as JSON array like this:
[
  {
    "date": "Monday, March 10",
    "bestTime": "2:00 PM - 3:00 PM",
    "waveHeight": "1.8 feet",
    "wavePeriod": "5.2 seconds",
    "wind": "NNE 12 knots",
    "tideTiming": "2:45 PM"
  }
]

RAW SURF-FORECAST DATA:
${surfForecastHTML}

Respond ONLY with the JSON array. Do not include any other text.`
          }
        ]
      })
    });

    const claudeData = await claudeResponse.json();

    if (!claudeResponse.ok) {
      throw new Error(claudeData.error?.message || 'Claude API request failed');
    }

    let forecastText = claudeData.content[0]?.type === 'text' ? claudeData.content[0].text : '[]';
    
    /
