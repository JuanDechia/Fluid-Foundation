import dotenv from 'dotenv';
import path from 'path';
import { callLogicAgent } from '../lib/fluid/agents/agent_logic';

// Explicitly load .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath });

async function main() {
    console.log("Testing Logic Agent with Search...");
    // We ask for something very specific and time-sensitive to prove "live" search.
    // If the model thinks it's 2025, asking for "latest news" might be confusing if the real world is 2024.
    // Asking for "Current price of Bitcoin" or "Who won the 2024 Super Bowl" is safer to grounding.
    // But let's stick to the prompt that caused the confusion to see if the DATE INJECTION fixed it.
    const prompt = "What is the date today? And what is the latest news on SpaceX?";
    try {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            console.error("Error: NEXT_PUBLIC_GEMINI_API_KEY not found in .env.local");
            console.log("Looking in:", envLocalPath);
            return;
        }

        const response = await callLogicAgent(prompt, [], [], apiKey);
        console.log("Prompt:", prompt);
        console.log("---------------------------------------------------");
        console.log("Response:", response.textResponse);
        console.log("---------------------------------------------------");
        if (response.hiddenUiData) {
            console.log("Hidden UI Data Found (Tool Call made):", response.hiddenUiData);
        }
    } catch (error) {
        console.error("Test Error:", error);
    }
}

main();
