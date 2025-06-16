// in api/getPendingConnections.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    const authHeader = req.headers.authorization;
    const jwt = authHeader?.split(' ')[1];
    if (!jwt) { return res.status(401).json({ error: 'Missing token.' }); }

    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !currentUser) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    try {
        // Step 1: Get the basic connection rows where I am the approver
        const { data: pendingConnections, error: connectionsError } = await supabase
            .from('connections')
            .select('id, requester_id') // Get the connection ID and who sent it
            .eq('approver_id', currentUser.id)
            .eq('status', 'pending');

        if (connectionsError) throw connectionsError;
        if (!pendingConnections || pendingConnections.length === 0) {
            return res.status(200).json([]); // Success, just no requests
        }

        // Step 2: Get the IDs of everyone who sent a request
        const requesterIds = pendingConnections.map(c => c.requester_id);

        // Step 3: Get the profiles for ONLY those people
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', requesterIds);

        if (profilesError) throw profilesError;

        // Step 4: Manually combine the information
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
        return res.status(500).json({ error: e.message });
    }
}
