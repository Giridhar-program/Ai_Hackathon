import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Tool definition for updating mentor status
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
    // API KEY is strictly from environment variable as per instructions
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiInstance;
};

export interface ChatResponse {
  text: string;
  mentorStatus?: 'searching' | 'satisfied';
}

export const sendMessageToGemini = async (
  history: { role: string; parts: { text: string }[] }[],
  currentMessage: string,
  knowledgeLevel: string
): Promise<ChatResponse> => {
  const ai = getAIInstance();
  
  // Construct the conversation history specifically for the prompt context
  // We prepend the system instruction and knowledge level context
  const model = 'gemini-3-flash-preview'; 

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCurrent User Knowledge Level: ${knowledgeLevel}`,
      tools: tools,
    },
    history: history,
  });

  const result = await chat.sendMessage({ message: currentMessage });
  
  // Handle function calls if any
  const functionCalls = result.functionCalls;
  let mentorStatus: 'searching' | 'satisfied' | undefined = undefined;

  if (functionCalls && functionCalls.length > 0) {
    for (const call of functionCalls) {
      if (call.name === 'updateMentorStatus') {
        const args = call.args as { status: 'searching' | 'satisfied' };
        mentorStatus = args.status;
        
        // We need to send the function response back to the model to get the final text response
        // In a real loop we would do this, but for simplicity in this single-turn wrapper,
        // we'll accept the function call as a side effect and return the text if available,
        // or trigger a continuation if the model stopped at the tool call.
        // For this specific app, the model usually generates text AND calls the tool.
        // If text is empty, we might need to send the tool response.
      }
    }
  }

  // If the model stopped solely for a function call, we usually need to loop back.
  // However, Gemini often outputs text thinking along with the tool call.
  // We will assume for this specific single-turn helper that we extract what we can.
  // To strictly follow the protocol, if there's a tool call, we should feed it back.
  
  let finalText = result.text || "";

  if (functionCalls && functionCalls.length > 0 && !finalText) {
     // If no text, we MUST reply to the function to get the text completion
     // This is a simplified handling. 
     const functionResponses = functionCalls.map(call => ({
        id: call.id,
        name: call.name,
        response: { result: 'ok' } 
     }));
     
     const toolResponse = await chat.sendMessage({
         content: { parts: functionResponses.map(r => ({ functionResponse: r })) } // Correct structure for @google/genai not fully typed here but conceptually
         // Actually the SDK simplifies this:
     } as any); // Type casting for brevity in this specific scaffold
     
     // Correct way with SDK 0.0.1+ pattern if needed, but let's try to just return the text if present
     // Re-check SDK docs: chat.sendMessage handles history.
     // If result.text is empty, we act as if we ack the status update.
     if (toolResponse.text) {
         finalText = toolResponse.text;
     }
  }

  return {
    text: finalText,
    mentorStatus,
  };
};

export const generateImage = async (prompt: string, size: string): Promise<string | undefined> => {
  // Always create a new instance to ensure we use the freshest API key (e.g. if user selected one via AI Studio)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          imageSize: size,
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image gen error", error);
    throw error;
  }
  return undefined;
};