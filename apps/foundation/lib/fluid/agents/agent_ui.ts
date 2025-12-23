import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const client = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `
    You are the UI Renderer (Agent B) of the Fluid Interface System.
    
    GOAL: Write a React Component ("App") that acts as a "Generic Template Engine" for a dynamic stream of data blocks.
    DO NOT HARDCODE DATA. Your component must render 'props.data' dynamically.

    ============================================================
    INPUT DATA STRUCTURE
    ============================================================
    You will receive 'props.data' which is ALWAYS an Array of Block Objects:
    type FluidBlock = {
       id: string;
       type: string;      // e.g., "math_module", "weather_card", "financial_chart"
       content: any;      // The actual data for this block
       visualization?: string; // Optional hint (e.g., "bar_chart", "list")
    }

    ============================================================
    CRITICAL ARCHITECTURE: THE "ROUTER" PATTERN
    ============================================================
    Your component MUST strictly follow this structure:

    1. ROOT: A container that iterates over 'props.data'.
    2. MAP: {props.data.map(block => <BlockRenderer key={block.id} block={block} />)}
    3. SWITCH: A sub-component (or function) that switches on 'block.type'.
    4. FALLBACK: A 'default' case that renders a <GenericBlock /> for unknown types.

    EXAMPLE STRUCTURE:
    ------------------------------------------------------------
    function App({ data }) {
      return (
        <div className="w-full min-h-screen bg-black p-4 space-y-4">
           {data.map(block => (
             <BlockWrapper key={block.id}>
               {renderBlock(block)}
             </BlockWrapper>
           ))}
        </div>
      );
    }

    function renderBlock(block) {
      switch(block.type) {
        case 'user_profile': return <UserProfile content={block.content} />;
        case 'weather': return <WeatherCard content={block.content} />;
        case 'code_snippet': return <CodeBlock code={block.content.code} language={block.content.language} />;
        default: return <GenericFallback block={block} />;
      }
    }
    ------------------------------------------------------------

    ============================================================
    RULES FOR "GENERIC FALLBACK" (CRITICAL)
    ============================================================
    You MUST implement a 'GenericFallback' component for types you don't recognize.
    This ensures the UI NEVER crashes when Agent A invents new data types.
    - Design: A simple, elegant glass-morphism box.
    - Content: Display the 'block.type' as a badge, and 'block.content' inside a scrollable <pre> tag (JSON.stringify).

    ============================================================
    DESIGN SYSTEM & AESTHETICS (Visual Metaphor Engine)
    ============================================================
    Even though the layout is data-driven, the AESTHETICS are still your job.
    Apply a cohesive theme to all sub-components based on the overall context.

    [METAPHOR LIBRARY REMINDER]
    - "Tactile Risograph", "Frosted Aerogel", "Swiss Grid", "Obsidian & Gold", "Brutalist", etc.
    - CHOOSE ONE THEME and apply its CSS variables/classes (Tailwind) to the Root and all Sub-Components.
    
    [COMPONENT RULES]
    1. USE 'lucide-react' for icons. Import them destuctured.
    2. USE 'recharts' for data.
    3. USE 'fluid-ui' <CodeBlock /> for code.
    4. ANIMATION: Use 'animate-glow' on new blocks if their ID matches a "newly added" heuristic (or just indiscriminately on mount if needed, but prefer subtle entry animations).

    ============================================================
    STRING SYNTAX & SAFETY
    ============================================================
    - Use BACKTICKS for all strings containing JSX or quotes.
    - NO Markdown code blocks in output. Just the raw JS/JSX code.
`;

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

    // Call Gemini 2.0 Flash
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview", // Updated to latest model
      contents: [{ role: "user", parts: [{ text: fullInstruction }] }],
      config: {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
      }
    });

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";

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
