// in doshab-backend/api/getConnections.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. --- SECURITY AND INITIALIZATION ---
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { db: { schema: 'public' } }
    );

    // 2. --- VERIFY THE USER'S IDENTITY ---
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token.' });
    }
    const jwt = authHeader.split(' ')[1];
    const { data: { user: requester }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !requester) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // 3. --- FETCH THE CONNECTIONS AND THE CONNECTED PROFILES ---
    const { data: connections, error: connectionsError } = await supabase
        .from('connections')
        .select(`
            nickname,
            profiles ( doCode )
        `)
        .eq('requester_id', requester.id);

    if (connectionsError) {
        return res.status(500).json({ error: `Database error: ${connectionsError.message}` });
    }

    // 4. --- SUCCESS! RETURN THE LIST OF CONNECTIONS ---
    return res.status(200).json(connections);
}