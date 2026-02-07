console.log("Groq key at runtime:", import.meta.env.VITE_GROQ_API_KEY);

export async function generateWithGroq(prompt: string) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API key missing");
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
        max_tokens:512,
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Groq error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
