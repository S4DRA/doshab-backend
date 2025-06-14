// in api/connectWithCode.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

   const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    // Add this explicit options block
    { db: { schema: 'public' } }
    );
    const authHeader = req.headers.authorization;
    if (!authHeader) { return res.status(401).json({ error: 'Missing auth token.' }); }

    const jwt = authHeader.split(' ')[1];
    const { data: { user: requester }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !requester) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    // GET THE NICKNAME AND CODE FROM THE REQUEST
    const { codeToConnect, nickname } = req.body;

    if (!codeToConnect || !nickname) {
        return res.status(400).json({ error: 'Please provide a code and a nickname.' });
    }

    // Find the profile for the code they entered
    const { data: approver, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('doCode', codeToConnect)
        .single();

    if (profileError || !approver) {
        return res.status(404).json({ error: 'A user with this code was not found.' });
    }

    if (requester.id === approver.id) {
        return res.status(400).json({ error: "You can't connect with yourself." });
    }

    // CREATE THE CONNECTION, NOW INCLUDING THE NICKNAME
    const { error: insertError } = await supabase.from('connections').insert({
        requester_id: requester.id,
        approver_id: approver.id,
        nickname: nickname // <-- Save the nickname
    });

    if (insertError) {
        if (insertError.code === '23505') {
            return res.status(409).json({ message: 'You are already connected.' });
        }
        return res.status(500).json({ error: `Database error: ${insertError.message}` });
    }

    return res.status(200).json({ message: `Successfully connected to ${nickname}!` });
}