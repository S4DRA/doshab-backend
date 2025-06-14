// in api/approveConnection.ts

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

    const { data: { user: approver }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !approver) {
        return res.status(401).json({ error: 'Invalid token.' });
    }

    const { connectionId, nicknameForRequester } = req.body;
    if (!connectionId || !nicknameForRequester) {
        return res.status(400).json({ error: 'Connection ID and nickname are required.' });
    }

    // 1. Find the original pending request
    const { data: originalRequest, error: findError } = await supabase
        .from('connections')
        .select('*')
        .eq('id', connectionId)
        .eq('approver_id', approver.id) // Security check: make sure I'm the approver
        .eq('status', 'pending')
        .single();

    if (findError || !originalRequest) {
        return res.status(404).json({ error: 'Pending request not found or you are not authorized to approve it.' });
    }

    // 2. Update the original request status from 'pending' to 'approved'
    const { error: updateError } = await supabase
        .from('connections')
        .update({ status: 'approved' })
        .eq('id', connectionId);

    if (updateError) {
        return res.status(500).json({ error: `Error updating request: ${updateError.message}` });
    }

    // 3. Create the SECOND, reverse connection (from me back to the requester)
    const { error: insertError } = await supabase.from('connections').insert({
        requester_id: approver.id,
        approver_id: originalRequest.requester_id,
        nickname: nicknameForRequester,
        status: 'approved'
    });

    if (insertError) {
        return res.status(500).json({ error: `Error creating reverse connection: ${insertError.message}` });
    }

    return res.status(200).json({ message: 'Connection approved!' });
}