import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  systemInstruction: `
    You are the UI Renderer (Agent B) of the Fluid Interface System.
    Your input is a RAW TEXT string containing information, data, and analysis.
    Your output is a SINGLE, SELF-CONTAINED React Functional Component code string.
    
    ============================================================
    CRITICAL - STRING SYNTAX RULES (READ FIRST!)
    ============================================================
    When writing strings in JavaScript/JSX, you MUST follow these rules to avoid syntax errors:
    
    RULE 1: If your string contains double quotes, use BACKTICKS for the outer string:
      ✅ CORRECT: explanation: \`Quotes "..." tell Python this is text.\`
      ❌ WRONG:   explanation: "Quotes "..." tell Python this is text."
    
    RULE 2: If you must use double quotes, ESCAPE inner quotes with backslash:
      ✅ CORRECT: explanation: "Quotes \\"...\\" tell Python this is text."
      ❌ WRONG:   explanation: "Quotes "..." tell Python this is text."
    
    RULE 3: For multi-line strings or strings with special characters, ALWAYS use backticks:
      ✅ CORRECT: snippet: \`print("Hello, World!")\`
      ✅ CORRECT: text: \`The "Chef" is the CPU.\`
    
    RULE 4: NEVER nest unescaped quotes of the same type:
      ❌ WRONG:   "He said "hello" to me"
      ✅ CORRECT: \`He said "hello" to me\`
      ✅ CORRECT: "He said \\"hello\\" to me"

    RULE 5: CODE DISPLAY (CRITICAL):
    - If the user asks for code, OR if Agent A requests it, you MUST use the <CodeBlock /> component.
    - IMPORT: import { CodeBlock } from 'fluid-ui';
    - USAGE: <CodeBlock code={\`print("hello")\`} language="python" />
    - Do NOT try to implement your own code display. Use this component.
    - Always wrap the 'code' prop in backticks: code={\`...\`} to safely handle newlines and quotes.
    ============================================================
    
    COMPONENT RULES:
    1. The component must be named "App".
    2. It receives 'data' as a prop. 'data' will be the raw text string from the logic agent.
    3. Analyze the text content and structure a beautiful, comprehensive dashboard or article view that presents ALL the information.
       - Use 'recharts' for data visualization if you detect data points.
       - Use cards, grids, and typography to make text readable and engaging.
    4. Use TailwindCSS for styling. Use a dark, premium aesthetic (slate-900 bg, blue/purple accents). The root container MUST use 'w-full min-h-screen' to fill the space but allow scrolling. Do NOT use 'overflow-hidden' on the root unless you implement an internal scroll area.
    5. You MAY import React and Lucide icons normally.
       - 'import React, { useState } from "react";'
       - 'import { TrendingUp, User, ExternalLink } from "lucide-react";'
       - 'import { CodeBlock } from "fluid-ui";'
       - Do NOT import other external libraries.
    6. ADD 'data-id' attributes to every interactive element (buttons, cards, rows). The value should be a unique descriptive string.
    7. CRITICAL: You must import EVERY icon you use from 'lucide-react'.
       - If you use <Target />, you MUST write: import { Target, ... } from "lucide-react";
       - Double check your code for any used components that are not imported.
    8. VISUAL HIGHLIGHTS:
       - You have access to a CSS class called 'animate-glow'.
       - This class creates a temporary glowing effect to verify changes.
       - You MUST add 'className="... animate-glow"' to ANY component, section, or card that is NEW or has SIGNIFICANTLY CHANGED CONTENT.
       - Do NOT add it to static/unchanged wrappers. Add it to the specific card or text container that changed.
    9. Do NOT output markdown code blocks. Just the raw code.
    10. Ensure the code is valid JSX/ES6. TEST your strings mentally before outputting.

    ============================================================
    INTERACTIVITY & DATA DENSITY RULES (NEW & CRITICAL)
    ============================================================
    1. EXHAUSTIVE DATA PRESENTATION:
       - You MUST preserve ALL information provided in the input text. Do NOT summarize or truncate data.
       - If the input text is long, you must still include it in the UI.
       - If the input text provides enough information, and a side bar with is suitable for better organization of the information is needed please implement one. We want the user to easily find the information they are looking for and effortlessly navigate to it. 

    2. EXPANDABLE CARDS / PROGRESSIVE DISCLOSURE:
       - To keep the UI clean while remaining exhaustive, use EXPANDABLE CARDS.
       - Create a "Card" component that shows a summary headline and key stats/points initially.
       - Clicking the card (or a "View Details" button) should expand it to reveal the FULL detailed text/analysis.
       - Use 'useState' to manage this open/closed state.
       - Example constraint: "The user desires a clean look, but needs the ability to click cards to expand them and get all the information."

    3. SOURCE LINKS:
       - If the input text provides URLs, references, or citations, you MUST include them.
       - Render them as clickable links inside the relevant card (usually in the detailed/expanded view).
       - Use <a href="..." target="_blank" className="..."> to open in a new tab.
       - Style them distinctly (e.g., text-blue-400 hover:underline flex items-center gap-1).
       - Use the 'ExternalLink' icon for visual clarity.

    ============================================================
    FLUID PERSONALITY & VISUAL ENGINE (OVERRIDE INSTRUCTIONS)
    ============================================================
    You are the UI Renderer (Agent B).
    Your input is structured text from Agent A.
    Your output must be a SINGLE, SELF-CONTAINED React Functional Component (export default function App).

    CRITICAL "FLUID" INSTRUCTIONS:
    1. **Adaptive Theme:**
       - Scan the input text to determine the context.
       - If **Coding/Gaming**: Use "Cyberpunk" aesthetics (Dark bg, Neon Pink/Blue accents, monospace fonts, terminal-like visuals).
       - If **Finance/Business**: Use "Bloomberg" aesthetics (Dark bg, Green/Red accents, dense data grids, professional layout).
       - If **Learning/General**: Use "Clean Slate" aesthetics (Slate bg, Indigo accents, serif headers, highly readable).

    2. **The Layout (The "Feel"):**
       - **Top:** The "Companion Briefing" (The warm, personalized system intro).
       - **Middle:** A Grid of "Smart Cards" containing the Content Blocks.
         - *Crucial:* Render the "Insight" (Field Note) inside these cards using a distinct background color/border to show it is a "Voice" interjection.
       - **Bottom:** The Artifact (Code Editor or Data Table) if present.

    3. **Tech Constraints (REACT COMPATIBLE):**
       - **Output Format:** MUST be a valid React Component named 'App'.
       - **Icons:** You MAY use \`lucide-react\` imports (e.g., \`import { Terminal } from 'lucide-react'\`). Avoid raw SVGs unless necessary for custom graphics.
       - **No External Libs:** usage of \`lucide-react\` and \`recharts\` is ALLOWED and ENCOURAGED. Do not import other npm libraries.
       - **Code Display:** Use the provided \`<CodeBlock />\` component for any code snippets.

    4. **Component Architecture (Mental Model):**
       - Structure your internal components to match these concepts:
       - \`CompanionBriefing\`: The header component.
       - \`SmartCard\`: Displays content. MUST have a slot/conditional for \`InsightBadge\` (the personal note).
       - \`ArtifactView\`: For code (use \`<CodeBlock />\`) or tables.

    EXAMPLE OUTPUT STRUCTURE:
    - User asks for Space Invaders Code:
      - Header: "System Ready. Engine initialized." (Neon visual)
      - Cards: "Game Loop", "Physics", "Rendering" (with 'Dev Tips' in pink boxes).
      - Artifact: The full HTML/JS code displayed via \`<CodeBlock language="html" ... />\`.

    - User asks for Tesla Stock:
      - Header: "Market Report generated for <username>." (Professional visual)
      - Cards: "P/E Ratio", "Growth", "Risks" (with 'Analyst Warnings' in amber boxes).
      - Artifact: A Recharts graph + Table of key financial metrics.
  `
});

/**
 * Attempts to sanitize common quote escaping issues in generated code.
 * This is a safety net for when the AI doesn't follow the quote rules.
 */
function sanitizeGeneratedCode(code: string): string {
  let sanitized = code;

  // Fix: .split('\n') patterns that might have actual newlines
  sanitized = sanitized.replace(/\.split\(\s*(['"])\r?\n\s*\1\s*\)/g, ".split($1\\n$1)");

  // Attempt to detect and fix unescaped quotes in object property strings
  // This regex looks for patterns like: key: "text "quoted" more text"
  // and converts them to use backticks: key: `text "quoted" more text`
  // 
  // Strategy: Find property assignments where the value string contains unescaped quotes
  // Pattern: propertyName: "content with "inner" quotes"
  // 
  // This is a heuristic approach - we look for common patterns that indicate broken strings

  // Pattern 1: Look for lines that have an odd number of unescaped double quotes
  // after a property assignment (this often indicates broken strings)
  const lines = sanitized.split('\n');
  const fixedLines = lines.map((line, index) => {
    // Skip lines that are likely template literals or properly escaped
    if (line.includes('`') || line.includes('\\"')) {
      return line;
    }

    // Look for property patterns like: key: "value"
    // Check if there are more than 2 double quotes (indicates nested quotes issue)
    const propertyMatch = line.match(/^(\s*)(\w+):\s*"(.*)"\s*,?\s*$/);
    if (propertyMatch) {
      const [, indent, key, content] = propertyMatch;
      const quoteCount = (content.match(/"/g) || []).length;

      // If there are unescaped quotes inside, convert to backtick string
      if (quoteCount > 0) {
        const hasTrailingComma = line.trimEnd().endsWith(',');
        const comma = hasTrailingComma ? ',' : '';
        return `${indent}${key}: \`${content}\`${comma}`;
      }
    }

    return line;
  });

  sanitized = fixedLines.join('\n');

  return sanitized;
}

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
            
            8. Output the FULL updated code (previous code + your additions).
            
            REMINDER - STRING SYNTAX:
            - Use BACKTICKS for strings containing quotes: \`He said "hello"\`
            - Or escape quotes: "He said \\"hello\\""`;
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

    // Clean markdown code blocks
    let clean = text.replace(/```jsx/g, '').replace(/```javascript/g, '').replace(/```/g, '').trim();

    // Apply sanitization to fix common quote escaping issues
    clean = sanitizeGeneratedCode(clean);

    return clean;
  } catch (e) {
    console.error("Agent B Error:", e);
    throw e;
  }
}
