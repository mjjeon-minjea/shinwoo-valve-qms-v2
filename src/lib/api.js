import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const api = {
    fetch: async (url, options = {}) => {
        // Parse URL to map to Supabase tables
        // URL format: '/table_name' or '/table_name/id'
        const endpoint = url.split('?')[0]; // Remove query params
        const pathParts = endpoint.split('/').filter(p => p !== '');
        const table = pathParts[0]; // e.g., 'users', 'inspections'

        console.log(`[Supabase API] ${options.method || 'GET'} ${table}`);

        // Normalize body: If string, parse it. If object, use as is.
        let requestBody = options.body;
        if (typeof requestBody === 'string') {
            try {
                requestBody = JSON.parse(requestBody);
            } catch (e) {
                console.warn('Failed to parse body as JSON in api.fetch', e);
            }
        }

        if (options.method === 'POST') {
            const { data, error } = await supabase.from(table).insert(requestBody).select();
            if (error) throw error;
            return {
                ok: true,
                json: async () => data[0]
            };
        }
        else if (options.method === 'PUT' || options.method === 'PATCH') {
            const id = pathParts[1]; // e.g., '1' from '/users/1'
            // If body has id, remove it to avoid changing PK
            const updateData = { ...requestBody };
            delete updateData.id; 

            const { data, error } = await supabase.from(table).update(updateData).eq('id', id).select();
            if (error) throw error;
            return {
                ok: true,
                json: async () => data[0]
            };
        }
        else if (options.method === 'DELETE') {
            const id = pathParts[1];
            
            let query = supabase.from(table).delete();

            if (id) {
                // Delete specific item
                query = query.eq('id', id);
            } else {
                // Delete ALL items (Batch Delete)
                // Supabase requires a WHERE clause for safety. We use a condition that is always true for our data.
                // Assuming IDs are generated strings or valid numbers, neq '0' usually matches all.
                query = query.neq('id', '0'); 
            }

            const { error } = await query;
            
            if (error) throw error;
            return {
                ok: true,
                json: async () => ({ success: true })
            };
        }
        else {
            // GET
            const { data, error } = await supabase.from(table).select('*');
            if (error) throw error;
            return {
                ok: true,
                json: async () => data
            };
        }
    }
};
