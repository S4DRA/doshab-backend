// in api/getMyProfile.ts

import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. --- INITIALIZE SUPABASE ADMIN CLIENT ---
    // We use the secret SERVICE_ROLE_KEY to perform admin-level tasks
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    // 2. --- GET THE USER'S AUTH TOKEN ---
    // The Android app will send this in the 'Authorization' header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authentication token.' });
    }
    const jwt = authHeader.split(' ')[1]; // Extract the token from "Bearer <token>"

    // 3. --- VERIFY THE TOKEN AND GET THE USER ---
    // This is a secure way to confirm who is making the request
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    // 4. --- FETCH THE USER'S PROFILE FROM THE 'profiles' TABLE ---
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*') // Get all columns from the profile
        .eq('id', user.id) // Find the profile where the id matches the auth user's id
        .single(); // We expect only one profile

    if (profileError) {
        return res.status(500).json({ error: `Database error: ${profileError.message}` });
    }

    if (!profile) {
        return res.status(404).json({ error: 'Profile not found for this user.' });
    }

    // 5. --- SUCCESS! RETURN THE PROFILE DATA ---
    return res.status(200).json(profile);
}