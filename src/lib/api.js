import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storageKey: 'qms-auth-v2'
    }
});

export const api = {
    fetch: async (url, options = {}) => {
        // URL 파싱: '/table_name' 또는 '/table_name/id' 형식
        const endpoint = url.split('?')[0];
        const pathParts = endpoint.split('/').filter(p => p !== '');
        const table = pathParts[0]; // e.g., 'process_inspections'

        console.log(`[Supabase API] ${options.method || 'GET'} ${table}`);

        // body 정규화: 문자열이면 파싱, 객체면 그대로 사용
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
                json: async () => {
                    if (pathParts[1] === 'batch') {
                        return { count: data ? data.length : 0 };
                    }
                    return data[0];
                }
            };
        }
        else if (options.method === 'PUT' || options.method === 'PATCH') {
            const id = pathParts[1];
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
                query = query.eq('id', id);
            } else {
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
            // GET: 서버의 Max Rows 제한(기본 1000건)을 우회하기 위해 재귀적으로 모든 데이터를 가져옵니다.
            let allData = [];
            let from = 0;
            const step = 1000;
            let hasMore = true;
            
            console.log(`[Supabase API] Fetching ALL pages for ${table}...`);
            
            while (hasMore && allData.length < 20000) { // 안전을 위해 최대 20,000건으로 제한
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .order('id', { ascending: false })
                    .range(from, from + step - 1);
                
                if (error) throw error;
                
                allData = [...allData, ...data];
                
                if (data.length < step) {
                    hasMore = false;
                } else {
                    from += step;
                }
            }
            
            console.log(`[Supabase API] Fetched total ${allData.length} records for ${table}`);
            
            return {
                ok: true,
                json: async () => allData
            };
        }
    }
};
