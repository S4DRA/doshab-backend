// in api/getPendingConnections.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { db: { schema: 'public' } }
    );

    const authHeader = req.headers.authorization;
    const jwt = authHeader?.split(' ')[1];
    if (!jwt) { return res.status(401).json({ error: 'Missing token.' }); }

    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !currentUser) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    try {
        // Step 1: Get the basic connection rows where I am the approver and status is pending
        const { data: pendingConnections, error: connectionsError } = await supabase
            .from('connections')
            .select('id, requester_id') // Get the connection ID and who sent it
            .eq('approver_id', currentUser.id)
            .eq('status', 'pending');

        if (connectionsError) throw connectionsError;

        // If there are no pending requests, return an empty array successfully
        if (!pendingConnections || pendingConnections.length === 0) {
            return res.status(200).json([]);
        }

        // Step 2: Extract just the IDs of the people who sent the requests
        const requesterIds = pendingConnections.map(c => c.requester_id);

        // Step 3: Fetch all the profiles for ONLY those specific user IDs
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, doCode') // Get the info we need
            .in('id', requesterIds);

        if (profilesError) throw profilesError;

        // Step 4: Manually combine the information into the structure the app expects
        const finalResponse = pendingConnections.map(connection => {
            const matchingProfile = profiles.find(p => p.id === connection.requester_id);
            return {
                id: connection.id,
                requester_id: connection.requester_id,
                requesterProfile: {
                    email: matchingProfile?.email || 'Unknown User',
                    doCode: matchingProfile?.doCode || 'N/A'
                }
            };
        });

        // Return the successfully combined data
        return res.status(200).json(finalResponse);

    } catch (e: any) {
        // Catch any other unexpected errors
        return res.status(500).json({ error: e.message });
    }
}