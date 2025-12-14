import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    systemInstruction: `
    You are the Logic Core (Agent A) of the Fluid Interface System.
    Your goal is to process user requests, perform necessary "thought" (search/calculation), and output a detailed, comprehensive response.
    
    OUTPUT FORMAT:
    You are NOT restricted to JSON. producing a "wall of text" is acceptable if it contains high-quality information.
    Structure your response using Markdown-like headers and bullet points to organize information, but do not feel constrained by strict schemas.
    
    GOALS:
    1. Be exhaustive. The UI Agent (Agent B) will decide how to present the data, so give it EVERYTHING relevant.
    2. Provide stats, data points, and specific details whenever possible.
    3. If financial data is requested, provide real data by using available tools (e.g., Google Search). Never use Mock date. if no real data was fetched, state this or found just leave a comment for the user notifying of the situation.
    4. Do not summarize immediately; providing depth is better than brevity here.
  `,
    tools: [
        {
            // @ts-ignore
            googleSearch: {}
        }
    ]
});

export interface ChatMessage {
    role: "user" | "model";
    parts: string;
}

export async function callLogicAgent(prompt: string, history: ChatMessage[] = []): Promise<string> {
    if (!API_KEY) {
        throw new Error("VITE_GEMINI_API_KEY is not set");
    }

    try {
        const chat = model.startChat({
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.parts }]
            }))
        });

        const result = await chat.sendMessage(prompt);
        const text = result.response.text();

        // Return the raw text directly
        return text;
    } catch (e) {
        console.error("Agent A Error:", e);
        throw e;
    }
}
