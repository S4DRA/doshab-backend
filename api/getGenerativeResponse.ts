// in api/getGenerativeResponse.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// This is the main function Vercel will run
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. --- INITIALIZATION ---
    // Initialize Supabase client with the secret service key from environment variables
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the prompt from the incoming request from the Android app
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Please provide a prompt." });
    }

    // 2. --- SETUP GEMINI WITH FUNCTION CALLING ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
   const model = genAI.getGenerativeModel({
        model: "gemini-1.0-pro",
        tools: [ // <-- The 'tools' property is now the array itself
            {
                functionDeclarations: [ // <-- And we must use 'functionDeclarations' here
                    {
                        name: "getFamilyMemberLocation",
                        description: "Get the current GPS location of a family member by name",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                name: {
                                    type: "STRING",
                                    description: "The name of the family member, e.g., 'dad', 'mom', or their email.",
                                },
                            },
                            required: ["name"],
                        },
                    },
                ]
            }
        ]
    });

    // 3. --- FIRST CALL TO GEMINI ---
    // Start a chat and send the user's prompt
    const chat = model.startChat();
    const result = await chat.sendMessage(prompt);
    const call = result.response.functionCalls()?.[0];

    // 4. --- DECIDE WHAT TO DO ---
    // If Gemini did NOT ask to call a function, just return its text response.
    if (!call) {
        return res.status(200).json({ response: result.response.text() });
    }

    // If Gemini DID ask to call our function...
    if (call.name === "getFamilyMemberLocation") {
        console.log("Gemini wants to call getFamilyMemberLocation with args:", call.args);
        
        const name = ((call.args as { name: string }).name || "").toLowerCase();
        let targetEmail = "";

        // --- This is our simple logic to map names to emails ---
        // In a real app, you would have a more robust "family" table in your DB
        if (name.includes("dad")) {
            // !!! IMPORTANT: CHANGE THIS to a real user's email that exists in your Supabase 'locations' table for testing !!!
            targetEmail = "so4nper@gmail.com"; 
        } else {
            // If it's not a special name, assume the name itself is the email
            targetEmail = name;
        }

        console.log(`Searching for email: ${targetEmail}`);

        // 5. --- EXECUTE THE FUNCTION (QUERY SUPABASE) ---
        const { data, error } = await supabase
            .from('locations') // The name of our table
            .select('latitude, longitude')
            .eq('email', targetEmail) // Find the row with the matching email
            .limit(1)
            .single(); // We only expect one result

        // If we got an error or didn't find the user
        if (error || !data) {
            console.error("Supabase query error or user not found:", error);
            // Tell Gemini the function result was "not found"
            const functionResponse = {
                functionResponse: {
                    name: "getFamilyMemberLocation",
                    response: { name: name, location: "not found" },
                },
            };
            // Send this back to Gemini so it can form a natural response
            const secondResult = await chat.sendMessage(JSON.stringify(functionResponse));
            return res.status(200).json({ response: secondResult.response.text() });
        }

        // If we successfully found the user's location
        const { latitude, longitude } = data;
        console.log(`Found location for ${targetEmail}:`, { latitude, longitude });

        // 6. --- SECOND CALL TO GEMINI (with function result) ---
        // Give the found location data back to the model
        const functionResponse = {
            functionResponse: {
                name: "getFamilyMemberLocation",
                response: {
                    name: name,
                    location: { latitude, longitude },
                    mapLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
                },
            },
        };

        const secondResult = await chat.sendMessage(JSON.stringify(functionResponse));
        // Return the final, natural language answer from the AI
        return res.status(200).json({ response: secondResult.response.text() });
    }

    // Fallback if the function name is not recognized
    return res.status(400).json({ error: "Function call not recognized." });
}