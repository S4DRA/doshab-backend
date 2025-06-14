// in api/requestConnection.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.split(' ')[1];

    if (!jwt) { return res.status(401).json({ error: 'Missing token.' }); }

    const { data: { user: requester }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !requester) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    const { codeToConnect, nickname } = req.body;
    if (!codeToConnect || !nickname) {
        return res.status(400).json({ error: 'A code and nickname are required.' });
    }

    const { data: approver, error: profileError } = await supabase
        .from('profiles').select('id').eq('doCode', codeToConnect).single();

    if (profileError || !approver) {
        return res.status(404).json({ error: 'User with this code not found.' });
    }

    if (requester.id === approver.id) {
        return res.status(400).json({ error: "You can't connect with yourself." });
    }

    // Insert the one-way PENDING connection request
    const { error: insertError } = await supabase.from('connections').insert({
        requester_id: requester.id,
        approver_id: approver.id,
        nickname: nickname, // This is the nickname the requester sets for the approver
        // The 'status' column will automatically default to 'pending'
    });

    if (insertError) {
        if (insertError.code === '23505') { // Unique constraint violation
            return res.status(409).json({ message: 'A request has already been sent.' });
        }
        return res.status(500).json({ error: `Database error: ${insertError.message}` });
    }

    return res.status(200).json({ message: `Connection request sent successfully to ${nickname}!` });
}