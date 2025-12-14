import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    systemInstruction: `
    You are the UI Renderer (Agent B) of the Fluid Interface System.
    Your input is a RAW TEXT string containing information, data, and analysis.
    Your output is a SINGLE, SELF-CONTAINED React Functional Component code string.
    
    RULES:
    1. The component must be named "App".
    2. It receives 'data' as a prop. 'data' will be the raw text string from the logic agent.
    3. Analyze the text content and structure a beautiful, comprehensive dashboard or article view that presents ALL the information.
       - Use 'rechats' for data visualization if you detect data points.
       - Use cards, grids, and typography to make text readable and engaging.
    4. Use TailwindCSS for styling. Use a dark, premium aesthetic (slate-900 bg, blue/purple accents). The root container MUST use 'w-full min-h-screen' to fill the space but allow scrolling. Do NOT use 'overflow-hidden' on the root unless you implement an internal scroll area.
    5. You MAY import React and Lucide icons normally.
       - 'import React, { useState } from "react";'
       - 'import { TrendingUp, User } from "lucide-react";'
       - Do NOT import other external libraries.
    24. ADD 'data-id' attributes to every interactive element (buttons, cards, rows). The value should be a unique descriptive string.
    25. CRITICAL: You must import EVERY icon you use from 'lucide-react'.
       - If you use <Target />, you MUST write: import { Target, ... } from "lucide-react";
       - Double check your code for any used components that are not imported.
    26. VISUAL HIGHLIGHTS:
       - You have access to a CSS class called 'animate-glow'.
       - This class creates a temporary glowing effect to verify changes.
       - You MUST add 'className="... animate-glow"' to ANY component, section, or card that is NEW or has SIGNIFICANTLY CHANGED CONTENT.
       - Do NOT add it to static/unchanged wrappers. Add it to the specific card or text container that changed.
    27. Do NOT output markdown code blocks. Just the raw code.
    28. Ensure the code is valid JSX/ES6.
  `
});

export async function callUIAgent(dataContext: any, previousCode?: string, feedback?: string): Promise<string> {
    if (!API_KEY) {
        throw new Error("VITE_GEMINI_API_KEY is not set");
    }

    try {
        // dataContext is now likely a large string, but we wrap it to be sure
        const prompt = typeof dataContext === 'string' ? dataContext : JSON.stringify(dataContext, null, 2);

        // Construct the prompt
        let fullInstruction = `Render this content:\n${prompt}`;

        if (previousCode) {
            fullInstruction += `\n\nIMPORTANT: Here is the PREVIOUS UI CODE you generated. You MUST use this as a starting point.
            
            PREVIOUS CODE:
            ${previousCode}
            
            INSTRUCTIONS FOR UPDATE:
            1. Keep the existing layout, visual style, and component structure IDENTICAL to the previous code unless strictly necessary to change it.
            2. ADD new sections, tabs, or components to accommodate the NEW data provided above.
            3. If the user asked for a new module/lesson, add it to the existing list or navigation.
            4. Do NOT start from scratch. Reuse the existing 'App' component structure.
            
            CRITICAL - VISUAL HIGHLIGHTING RULES:
            5. REMOVE all existing 'animate-glow' classes from the PREVIOUS CODE. The old updates are no longer new.
            6. IDENTIFY the parts of the UI that are NEW or MODIFIED based on the new data/feedback.
            7. ADD the 'animate-glow' class to those SPECIFIC modified elements (e.g., the new card, the updated chart container, the new text block).
               - Example: <div className="bg-slate-800 p-4 rounded animate-glow">...</div>
            
            8. Output the FULL updated code (previous code + your additions).`;
        }

        if (feedback) {
            fullInstruction += `\n\nCRITICAL USER FEEDBACK / ERROR LOG:
            "${feedback}"
            
            PRIORITY INSTRUCTION:
            - The user (or the system) has reported an issue or requested a specific change.
            - You MUST address this feedback immediately.
            - If this is an error log, ANALYZE the error and FIX the code.
            - If this is a style request, apply it while keeping the data intact.`;
        }

        const result = await model.generateContent(fullInstruction);
        const text = result.response.text();

        // Clean markdown
        // Clean markdown and fixes
        let clean = text.replace(/```jsx/g, '').replace(/```javascript/g, '').replace(/```/g, '').trim();

        // Fix: .split('
        // ') -> .split('\n')
        clean = clean.replace(/\.split\(\s*(['"])\r?\n\s*\1\s*\)/g, ".split($1\\n$1)");

        return clean;
    } catch (e) {
        console.error("Agent B Error:", e);
        throw e;
    }
}
