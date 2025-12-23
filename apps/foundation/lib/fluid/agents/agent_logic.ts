import { GoogleGenAI, Type, FunctionDeclaration, Part, Content, FunctionCallingConfigMode } from "@google/genai";

const render_interface_tool: FunctionDeclaration = {
    name: "render_interface",
    description: "Generates a structured visual interface or dashboard for the user.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: {
                type: Type.STRING,
                description: "UUID of the block to update. If creating new content, leave empty. If correcting/updating existing content, you MUST reuse the ID of the block you are fixing.",
            },
            title: {
                type: Type.STRING,
                description: "The headline or title of the interface.",
            },
            summary: {
                type: Type.STRING,
                description: "A brief executive summary of the content.",
            },
            content_blocks: {
                type: Type.ARRAY,
                description: "List of content blocks to display.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING, description: "The main text or data content." },
                        insight_type: { type: Type.STRING, description: "Type of insight (e.g., 'Analyst Note', 'Warning')." },
                        insight_value: { type: Type.STRING, description: "The specific insight text." },
                    },
                    required: ["title", "content", "insight_type", "insight_value"],
                },
            },
            raw_data: {
                type: Type.STRING,
                description: "Optional raw data for code snippets, CSVs, or complex datasets.",
            },
        },
        required: ["title", "summary", "content_blocks"],
    },
};

const SYSTEM_INSTRUCTION = `You are the Logic Core (Agent A) of the Fluid Interface System.
Your goal is to be the user's expert companion. You are NOT a generic chatbot. You are a morphing expert system.

[SYSTEM TIME]: ${new Date().toISOString()}

STEP 1: DETERMINE THE PERSONA
Based on the user's request, adopt the correct stance (e.g., Financial Analyst, Software Architect, Professor).

STEP 2: GENERATE CONTENT
- If the user's request requires a visual interface, dashboard, structured answer, or specific data (like code, tables, or news analysis), you MUST call the 'render_interface' tool.
- Do NOT output the data as text in the chat.
- ONLY output a conversational summary or confirmation in the main chat response to the user (e.g., "I've analyzed the market data, here is the dashboard.").

GENERAL RULES:
- Always use up-to-date information.
- Use your 'googleSearch' tool for current events, news, or specific real-time data.
- Provide high-quality insights in the 'insight_value' fields of the tool.
- If asking for code, put the full code in 'raw_data' or a content block.`;

// Maintained for compatibility with FluidEngine (which expects strings)
export interface ChatMessage {
    role: "user" | "model";
    parts: string;
    metrics?: {
        logicLatency?: number;
        uiLatency?: number;
        totalLatency?: number;
        cached?: boolean;
    };
}

export interface LogicResponse {
    textResponse: string;
    hiddenUiData: any | null;
}

export interface DataBlock {
    id: string;
    type: string;
    content: any;
    timestamp?: number;
}

export async function callLogicAgent(
    prompt: string,
    history: ChatMessage[] = [],
    currentDataBlocks: DataBlock[] = [],
    apiKey?: string
): Promise<LogicResponse> {
    const API_KEY = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!API_KEY) {
        throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");
    }
    const client = new GoogleGenAI({ apiKey: API_KEY });

    try {
        // Map string history to Gemini Content objects
        const geminiHistory: Content[] = history.map(h => ({
            role: h.role,
            parts: [{ text: h.parts }]
        }));

        // PHASE 1: SEARCH DISCOVERY
        // We first ask the "Researcher" persona if they need to search the web.
        const searchResponse = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                ...geminiHistory,
                // We append a specific instruction for this turn
                {
                    role: "user", parts: [{
                        text: `
                    ${prompt}
                    
                    [INTERNAL SEARCH INSTRUCTION]
                    You are the Researcher. 
                    1. If the user's request requires external information, news, or fresh data, use use your 'googleSearch' tool.
                    2. If NO search is needed, just respond with your analysis or answer.
                ` }]
                }
            ],
            config: {
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                tools: [{ googleSearch: {} }],
                toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }
            }
        });

        const searchCandidate = searchResponse.candidates?.[0];
        const searchParts = searchCandidate?.content?.parts || [];

        let searchContext = "";
        let searchGroundingArgs: any = null;

        // Collect search results/context from Phase 1
        for (const part of searchParts) {
            if (part.text) {
                searchContext += part.text;
            }
        }

        // PHASE 2: SYNTHESIS & RENDER
        // Now we call the "Architect" persona with the gathered context to render the UI.

        // Build Table of Contents of existing blocks for upsert logic
        let blockTOC = "";
        if (currentDataBlocks.length > 0) {
            const tocEntries = currentDataBlocks.map(b => ({
                id: b.id,
                title: b.content?.title || b.type || 'Untitled'
            }));
            blockTOC = `\n[CURRENT UI BLOCKS]: ${JSON.stringify(tocEntries)}\nTo UPDATE an existing block, you MUST use its exact ID in the 'id' field of 'render_interface'. To create a NEW block, leave 'id' empty.\n`;
        }

        // Synthesize the prompt for Phase 2
        let synthesisPrompt = prompt;
        if (searchContext || blockTOC) {
            synthesisPrompt = `
                User Request: ${prompt}
                ${blockTOC}
                ${searchContext ? `[RESEARCHER FINDINGS FROM GOOGLE SEARCH]\n${searchContext}` : ''}

                [INSTRUCTION]
                Using the above findings, generate the final response and call 'render_interface' if appropriate.
                If the search didn't yield results, do your best with your internal knowledge.
            `;
        }

        const renderResponse = await client.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                ...geminiHistory,
                { role: "user", parts: [{ text: synthesisPrompt }] }
            ],
            config: {
                systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                tools: [{ functionDeclarations: [render_interface_tool] }],
                toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }
            }
        });

        const renderCandidate = renderResponse.candidates?.[0];
        const renderParts = renderCandidate?.content?.parts || [];

        let textResponse = "";
        let hiddenUiData = null;

        // Check for function calls and text in Phase 2
        for (const part of renderParts) {
            if (part.text) {
                textResponse += part.text;
            }
            if (part.functionCall) {
                if (part.functionCall.name === "render_interface") {
                    hiddenUiData = part.functionCall.args;
                }
            }
        }

        if (hiddenUiData && !textResponse && (hiddenUiData as any).summary) {
            textResponse = (hiddenUiData as any).summary;
        }

        return {
            textResponse: textResponse || "Processing...",
            hiddenUiData,
        };

    } catch (e) {
        console.error("Agent A Error:", e);
        throw e;
    }
}
