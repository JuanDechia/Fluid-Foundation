import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: `
    You are the Logic Core (Agent A) of the Fluid Interface System.
    Your goal is to process user requests, perform necessary "thought" (search/calculation), and output a detailed, comprehensive response.
    
    OUTPUT FORMAT:
    You are NOT restricted to JSON. producing a "wall of text" is acceptable if it contains high-quality information.
    Structure your response using Markdown-like headers and bullet points to organize information.
    
    CRITICAL INSTRUCTIONS FOR DEPTH:
    1. BE EXHAUSTIVE: The UI Agent is designed to handle large amounts of data using expandable cards. Do NOT simplify or summarize for brevity.
    2. PROVIDE DETAIL: If you find a timeline, give every date. If you find stats, give the raw numbers.
    3. INCLUDE SOURCES: If you use Google Search, you MUST include the raw URLs of the sources you found. The UI will render them as links.
    4. DATA IS KING: Your job is to fetch and synthesize the raw material. The UI agent will make it look good.
    5. If financial data is requested, provide real data by using available tools (e.g., Google Search). Never use Mock date. if no real data was fetched, state this or found just leave a comment for the user notifying of the situation.
    6. CODE GENERATION:
       - If the user asks you to write code (e.g., "Write a Python script", "Create an HTML page"), provide the FULL, WORKING CODE in your markdown response.
       - IMPORTANT: Add a note to the UI Agent in your response saying: "UI Agent: The user requested code. Please display the following code snippet using the <CodeBlock /> component from 'fluid-ui'."
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
