import { config } from "../lib/config.js";

export async function generateAnswer(prompt: string, context: string): Promise<string | null> {
  try {
    const fullPrompt = `
You are an intelligent AI assistant.

Rules:
- Extract relevant info from context
- Do NOT copy full text
- Answer clearly
- Perform reasoning if needed

Context:
${context}

Question:
${prompt}

Answer:
`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [
          { role: "user", content: fullPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.log("GROQ ERROR:", err);
      return null;
    }

    const data = await res.json();

    const answer = data?.choices?.[0]?.message?.content;

    return answer || null;

  } catch (err) {
    console.log("GROQ CRASH:", err);
    return null;
  }
}