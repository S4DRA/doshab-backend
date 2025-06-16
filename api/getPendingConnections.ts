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
        // --- STEP 1: Get all PENDING connection rows for me ---
        const { data: pendingConnections, error: connectionsError } = await supabase
            .from('connections')
            .select('id, requester_id')
            .eq('approver_id', currentUser.id)
            .eq('status', 'pending');

        if (connectionsError) throw new Error(connectionsError.message);
        if (!pendingConnections || pendingConnections.length === 0) {
            // This is a success case. The user just has no requests.
            return res.status(200).json([]);
        }

        // --- STEP 2: Get a list of all the IDs of the people who sent requests ---
        const requesterIds = pendingConnections.map(c => c.requester_id);

        // --- STEP 3: Get all the profiles for those specific IDs ---
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', requesterIds); // `in` is like "where id is one of these..."

        if (profilesError) throw new Error(profilesError.message);

        // --- STEP 4: Manually combine the two lists ---
        const finalResponse = pendingConnections.map(conn => {
            const matchingProfile = profiles.find(p => p.id === conn.requester_id);
            return {
                id: conn.id,
                requesterId: conn.requester_id,
                requesterProfile: {
                    email: matchingProfile?.email || 'Unknown User'
                }
            };
        });

        return res.status(200).json(finalResponse);

    } catch (e: any) {
        return res.status(500).json({ error: `Server Query Failed: ${e.message}` });
    }
}