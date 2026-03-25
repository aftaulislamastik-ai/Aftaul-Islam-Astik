import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. AI features will not work.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateAiResponse = async (
  prompt: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Error: API Key missing.";

  try {
    const model = 'gemini-3-flash-preview';
    const contents = [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
    ];

    const response = await ai.models.generateContent({
      model,
      contents: contents, // Use contents directly for history
      config: {
        systemInstruction: "You are a cyber-futuristic AI assistant named 'Commune AI'. You speak in a sleek, slightly robotic but helpful tone. Keep responses concise and witty.",
      }
    });

    return response.text || "I cannot process that request right now.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Connection interrupted. Neural link unstable.";
  }
};
