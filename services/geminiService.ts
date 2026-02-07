import { GoogleGenAI, FunctionDeclaration, Type, Tool, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { Template, TemplateCategory, KnowledgeLevel } from "../types";

const updateMentorStatusTool: FunctionDeclaration = {
  name: 'updateMentorStatus',
  description: 'Updates the mentor mode status based on user understanding.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        enum: ['searching', 'satisfied'],
        description: 'The new status of the mentor mode. Use "satisfied" when the user understands the core logic.',
      },
    },
    required: ['status'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [updateMentorStatusTool] }];

let aiInstance: GoogleGenAI | null = null;

const getAIInstance = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiInstance;
};

export interface ChatResponse {
  text: string;
  mentorStatus?: 'searching' | 'satisfied';
  imagePart?: string;
}

const getLevelInstruction = (level: string): string => {
  switch (level) {
    case KnowledgeLevel.BEGINNER:
      return `
### MODE: BEGINNER
- **Tone**: Gentle, patient, and encouraging.
- **Vocabulary**: Use simple, non-technical phrasing. Explain concepts using real-world analogies (e.g., "A variable is like a labelled box").
- **Constraint**: Avoid jargon unless you define it immediately in very simple terms. Assume zero prior knowledge.
- **Strategy**: Break logic down into the smallest possible steps. Ask simple guiding questions.`;
      
    case KnowledgeLevel.INTERMEDIATE:
      return `
### MODE: INTERMEDIATE
- **Tone**: Professional, academic, and structured.
- **Vocabulary**: Use standard technical terminology freely.
- **Strategy**: Focus on connecting concepts, discussing best practices, and handling edge cases. Assume the user has the basics down but needs to understand *why* things work this way.
- **Goal**: Bridge the gap between "making it work" and "mastering the concept".`;

    case KnowledgeLevel.ADVANCED:
      return `
### MODE: ADVANCED (Expert Peer-to-Peer)
- **Tone**: High-bandwidth, dense, and concise. Speak as one expert to another (e.g., Sr. Engineer to Staff Engineer).
- **Vocabulary**: Use precise, high-level terminology. You can discuss algorithmic complexity (Big O), compiler optimizations, system design trade-offs, and architectural implications.
- **Meta-Cognition**: You are permitted to discuss how you (the AI) are parsing the user's intent or the logical constraints of the problem itself.
- **Constraint**: Do NOT simplify. Focus on elegance, efficiency, and abstraction.`;

    default:
      return "MODE: GENERAL. Adapt to the user's tone.";
  }
};

export const sendMessageToGemini = async (
  history: { role: string; parts: { text: string }[] }[],
  currentMessage: string,
  knowledgeLevel: string
): Promise<ChatResponse> => {
  const ai = getAIInstance();
  const model = 'gemini-3-flash-preview'; 

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: currentMessage }] }
  ];

  const levelSpecificInstruction = getLevelInstruction(knowledgeLevel);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${levelSpecificInstruction}\n\nALWAYS provide a Mermaid diagram (using \`\`\`mermaid\`) if the logic can be visualized. Focus on the core structural logic.`,
      tools: tools,
      thinkingConfig: { thinkingBudget: 4000 }
    },
  });

  let mentorStatus: 'searching' | 'satisfied' | undefined = undefined;
  const candidate = response.candidates?.[0];
  const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

  if (functionCalls && functionCalls.length > 0) {
    for (const call of functionCalls) {
      if (call && call.name === 'updateMentorStatus') {
        const args = call.args as { status: 'searching' | 'satisfied' };
        mentorStatus = args.status;
      }
    }
  }

  let finalText = "";
  let imagePart: string | undefined = undefined;

  for (const part of candidate?.content?.parts || []) {
    if (part.text) finalText += part.text;
    if (part.inlineData) {
      imagePart = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  if (functionCalls && functionCalls.length > 0 && !finalText) {
      finalText = "I have updated my mentor status and am analyzing your logic further.";
  }

  return { text: finalText, mentorStatus, imagePart };
};

export const synthesizeTemplate = async (query: string): Promise<Template> => {
  const ai = getAIInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: `Create a structured LOGIC TEMPLATE for the topic: "${query}". Return JSON.` }]}],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          content: { type: Type.STRING },
          category: { 
            type: Type.STRING, 
            enum: Object.values(TemplateCategory)
          }
        },
        required: ['title', 'description', 'content', 'category']
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    id: `syn-${Date.now()}`,
    isSynthesized: true
  };
};

export const generateImage = async (prompt: string, size: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Helper to extract base64 from response
  const extractImage = (response: any) => {
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  };

  try {
    // Attempt with High Quality model
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { imageSize: size, aspectRatio: "1:1" } }
    });
    return extractImage(response);

  } catch (error: any) {
    // If High Quality fails with Permission Denied (403), fallback to Flash
    if (error.status === 403 || error.message?.includes('403') || error.message?.includes('Permission denied')) {
        console.warn("Pro image gen failed (403), falling back to Flash model.");
        try {
            const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: "1:1" } } // Flash supports aspect ratio but not size in the same way, kept simple
            });
            return extractImage(fallbackResponse);
        } catch (fallbackError) {
             console.error("Fallback image gen error", fallbackError);
             throw error; // Throw the original error to trigger UI key selection prompt
        }
    }
    console.error("Image gen error", error);
    throw error;
  }
};