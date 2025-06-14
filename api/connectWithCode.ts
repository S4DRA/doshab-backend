// in api/connectWithCode.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. --- SECURITY AND INITIALIZATION ---
    // Ensure this is a POST request
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    // 2. --- GET THE REQUESTER'S IDENTITY ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authentication token.' });
    }
    const jwt = authHeader.split(' ')[1];
    const { data: { user: requester }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !requester) {
        return res.status(401).json({ error: 'Invalid token. Requester not found.' });
    }

    // 3. --- FIND THE PERSON THEY WANT TO CONNECT WITH ---
    const { codeToConnect } = req.body;
    if (!codeToConnect) {
        return res.status(400).json({ error: 'Please provide the code to connect with.' });
    }

    // Find the profile that has the matching 'doCode'
    const { data: approver, error: profileError } = await supabase
        .from('profiles')
        .select('id') // We only need their ID
        .eq('doCode', codeToConnect)
        .single();

    if (profileError || !approver) {
        return res.status(404).json({ error: 'A user with this code was not found.' });
    }

    // Prevent users from connecting with themselves
    if (requester.id === approver.id) {
        return res.status(400).json({ error: "You can't connect with yourself." });
    }

    // 4. --- CREATE THE CONNECTION ---
    // Insert a new row into the 'connections' table
    const { error: insertError } = await supabase.from('connections').insert({
        requester_id: requester.id,
        approver_id: approver.id,
    });

    if (insertError) {
        // Handle cases where the connection might already exist
        if (insertError.code === '23505') { // Unique violation error code
            return res.status(409).json({ message: 'You are already connected to this user.' });
        }
        return res.status(500).json({ error: `Database error: ${insertError.message}` });
    }

    // 5. --- SUCCESS! ---
    return res.status(200).json({ message: 'Connection successful!' });
}