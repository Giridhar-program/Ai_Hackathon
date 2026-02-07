
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
        description: 'The new status of the mentor mode.',
      },
    },
    required: ['status'],
  },
};

const tools: Tool[] = [{ functionDeclarations: [updateMentorStatusTool] }];

export interface ChatResponse {
  text: string;
  mentorStatus?: 'searching' | 'satisfied';
}

const getLevelInstruction = (level: string): string => {
  switch (level) {
    case KnowledgeLevel.BEGINNER:
      return "### MODE: BEGINNER. Use simple analogies and zero jargon.";
    case KnowledgeLevel.INTERMEDIATE:
      return "### MODE: INTERMEDIATE. Use technical terms and focus on 'why'.";
    case KnowledgeLevel.ADVANCED:
      return "### MODE: ADVANCED. Dense, high-bandwidth peer-to-peer discussion.";
    default:
      return "";
  }
};

export const sendMessageToGemini = async (
  history: { role: string; parts: { text: string }[] }[],
  currentMessage: string,
  knowledgeLevel: string
): Promise<ChatResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview'; 

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: currentMessage }] }
  ];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTION}\n\n${getLevelInstruction(knowledgeLevel)}`,
        tools: tools,
      },
    });

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
    
    let mentorStatus: 'searching' | 'satisfied' | undefined = undefined;
    if (functionCalls?.[0]?.name === 'updateMentorStatus') {
      mentorStatus = (functionCalls[0].args as any).status;
    }

    let text = "";
    for (const part of candidate?.content?.parts || []) {
      if (part.text) text += part.text;
    }

    return { text: text || "I am analyzing your logic...", mentorStatus };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const synthesizeTemplate = async (query: string): Promise<Template> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
          category: { type: Type.STRING, enum: Object.values(TemplateCategory) }
        },
        required: ['title', 'description', 'content', 'category']
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return { ...data, id: `syn-${Date.now()}`, isSynthesized: true };
};
