export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { location, details } = req.body;

  if (!location || !details) {
    return res
      .status(400)
      .json({ error: "Location and details are required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a professional surf forecasting AI. Provide accurate, helpful surf condition forecasts based on the user's request.

User's Location: ${location}
User's Question/Request: ${details}

Please provide a detailed surf forecast that includes:
- Current conditions (if known)
- Best times to surf
- Swell direction and height estimates
- Tide information
- Wind conditions
- Safety considerations
- Overall recommendation

Be specific and helpful. Use your knowledge of surf spots and conditions.`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "API request failed");
    }

    const forecast =
      data.content[0]?.type === "text" ? data.content[0].text : "";

    return res.status(200).json({ forecast });
  } catch (error) {
    console.error("Claude API error:", error);
    return res.status(500).json({
      error:
        error.message ||
        "Failed to generate forecast. Please check your API key.",
    });
  }
}
