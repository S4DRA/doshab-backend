// in api/getPendingConnections.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { db: { schema: 'public' } });
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.split(' ')[1];

    if (!jwt) { return res.status(401).json({ error: 'Missing token.' }); }

    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !currentUser) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    // Find connections where I am the approver AND the status is pending
    // Also fetch the nickname the requester gave me (from the perspective of the requester)
    // And fetch the requester's profile so I can see who they are
    const { data, error } = await supabase
        .from('connections')
        .select(`
            id,
            requester_id,
            profiles:requester_id ( email, doCode )
        `)
        .eq('approver_id', currentUser.id)
        .eq('status', 'pending');

    if (error) {
        return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    return res.status(200).json(data);
}