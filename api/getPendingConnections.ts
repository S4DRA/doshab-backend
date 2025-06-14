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

    // --- THIS IS THE NEW, MORE ROBUST QUERY ---
    // It specifies the foreign key relationship directly.
    const { data, error } = await supabase
        .from('connections')
        .select(`
            id,
            requester_id,
            requesterProfile:requester_id( email, doCode )
        `)
        .eq('approver_id', currentUser.id)
        .eq('status', 'pending');

    // Also, rename 'profiles' to 'requesterProfile' to match the data class
    // in the Android app for clarity. You'll need to update the data class.

    if (error) {
        return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    return res.status(200).json(data);
}