import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Initialize the admin client
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    try {
        // This is a special query to get all table names from the 'public' schema
        const { data, error } = await supabase
            .from('pg_catalog.pg_tables')
            .select('tablename')
            .eq('schemaname', 'public');

        if (error) {
            // If the query itself fails
            return res.status(500).json({
                step: "Query Failed",
                error: error
            });
        }

        // If the query succeeds, send back the list of tables it found
        return res.status(200).json({
            step: "Query Succeeded",
            tablesFound: data
        });

    } catch (e: any) {
        // If the whole function crashes for some reason
        return res.status(500).json({
            step: "Function Crashed",
            error: e.message
        });
    }
}