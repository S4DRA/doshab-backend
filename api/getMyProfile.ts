import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // --- THIS IS THE NEW PART ---
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        // Explicitly tell the client which schema to use
        { db: { schema: 'public' } }
    );
    // -----------------------------

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authentication token.' });
    }
    const jwt = authHeader.split(' ')[1];

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        // Add more logging to see the exact error
        console.error("Supabase Profile Error:", profileError);
        return res.status(500).json({ error: `Database error: ${profileError.message}` });
    }

    if (!profile) {
        return res.status(404).json({ error: 'Profile not found for this user.' });
    }

    return res.status(200).json(profile);
}