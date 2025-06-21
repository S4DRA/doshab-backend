// in api/getMyProfile.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { db: { schema: 'public' } }
    );

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authentication token.' });
    }
    const jwt = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, doCode') // Being more explicit with columns
            .eq('id', user.id)
            .single();

        if (profileError) {
            // This re-throws the error to be caught by our catch block
            throw profileError;
        }

        if (!profile) {
            return res.status(404).json({ error: 'Profile not found for this user.' });
        }

        return res.status(200).json(profile);

    } catch (e: any) {
        console.error("Error in getMyProfile:", e);
        return res.status(500).json({ error: `Database error in getMyProfile: ${e.message}` });
    }
}