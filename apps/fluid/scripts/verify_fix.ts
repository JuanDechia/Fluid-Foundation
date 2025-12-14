
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Polyfill for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    // 1. Read API Key from .env
    const envPath = path.resolve(__dirname, "../.env");
    let apiKey = "";
    try {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
        if (match) {
            apiKey = match[1].trim();
        }
    } catch (e) {
        console.error("Could not read .env file at", envPath);
        process.exit(1);
    }

    if (!apiKey) {
        console.error("No API Key found in .env");
        process.exit(1);
    }

    // 2. Setup Model (Mirroring src/agents/agent_ui.ts)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview", // MATCHING PROJECT CONFIG
        // IMPORTANT: using the UPDATED system instruction
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
    6. ADD 'data-id' attributes to every interactive element (buttons, cards, rows). The value should be a unique descriptive string.
    7. CRITICAL: You must import EVERY icon you use from 'lucide-react'.
       - If you use <Target />, you MUST write: import { Target, ... } from "lucide-react";
       - Double check your code for any used components that are not imported.
    8. Do NOT output markdown code blocks. Just the raw code.
    9. Ensure the code is valid JSX/ES6.
  `
    });

    // 3. Construct Input that triggered the error
    // The user had "Forex Intelligence" and "Target: 1.1800"
    const inputData = `
    SECTION: Forex Intelligence
    
    Pairs:
    1. EUR/USD - Price 1.1720, Trend: Bullish. Target: 1.1800
    2. USD/JPY - Price 155.95, Trend: Bearish. Target: 154.45
    
    Please show a card for each pair. Use a specific icon for the 'Target' field to visualize the goal.
    `;

    console.log("Generating with input...");
    let text = "";
    try {
        const result = await model.generateContent(`Render this content:\n${inputData}`);
        text = result.response.text();
    } catch (err: any) {
        console.error("GENERATION FAILED:", err.message);
        if (err.response) {
            console.error("Response:", JSON.stringify(err.response));
        }
        process.exit(1);
    }

    // 4. Verify
    console.log("---------------- GENERATED CODE ----------------");
    console.log(text.substring(0, 500) + "..."); // Print start
    console.log("------------------------------------------------");

    const usesTarget = text.includes("<Target");
    const importsTarget = text.includes("Target") && text.includes('from "lucide-react"');

    // We check if "Target" is in the import line. 
    // Regex to find: import { ... Target ... } from "lucide-react"
    const lucideImportRegex = /import\s*{([^}]*)}\s*from\s*['"]lucide-react['"]/;
    const importMatch = text.match(lucideImportRegex);

    let importedIcons: string[] = [];
    if (importMatch) {
        importedIcons = importMatch[1].split(',').map(s => s.trim());
    }

    console.log("Uses <Target />:", usesTarget);
    console.log("Imported icons:", importedIcons);
    console.log("Imports 'Target':", importedIcons.includes("Target"));

    if (usesTarget && !importedIcons.includes("Target")) {
        console.error("FAIL: Used <Target /> but did not import it!");
        process.exit(1);
    } else if (usesTarget && importedIcons.includes("Target")) {
        console.log("SUCCESS: Used and Imported Target.");
    } else {
        console.log("NEUTRAL: Did not use Target icon (Model chose otherwise). Rerun or adjust prompt to force usage.");
        if (text.includes("Target")) {
            console.log("Text contains 'Target', checking if it is used as component...");
        }
    }
}

run();
