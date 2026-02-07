import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  try {
    const { prompt } = JSON.parse(event.body || "{}");

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Prompt is required" }),
      };
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Groq API key missing" }),
      };
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "Reply in the same language as the user. Support Indian languages naturally.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 512,
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: data.choices[0].message.content,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
