// in api/getPendingConnections.ts
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const authHeader = req.headers.authorization;
    const jwt = authHeader?.split(' ')[1];
    if (!jwt) { return res.status(401).json({ error: 'Missing token.' }); }

    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !currentUser) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    try {
        // THIS IS THE NEW QUERY. It is more explicit.
        // The exclamation point (!) tells Supabase that the foreign key relationship IS there.
        const { data, error } = await supabase
            .from('connections')
            .select(`
                id,
                requester_id,
                requesterProfile: profiles!inner ( email, doCode )
            `)
            .eq('approver_id', currentUser.id)
            .eq('status', 'pending');

        if (error) { throw error; }
        return res.status(200).json(data);

    } catch (e: any) {
        return res.status(500).json({ error: `Server Query Failed: ${e.message}` });
    }
}