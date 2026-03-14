import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ====================================================
// 로컬 JSON 서버(3001포트)를 사용하는 테이블 목록
// Supabase에 없고 로컬 db.json 에만 있는 리소스들
// ====================================================
const LOCAL_JSON_TABLES = [
    'process_inspections',
    'inspections',
    'users',
    'notices',
    'resources',
    'settings',
    'inquiries',
    'weekly_reports',
    'calendar_events',
];

const LOCAL_SERVER = 'http://localhost:3001';

// 로컬 JSON 서버 전용 fetch 래퍼
const localFetch = async (url, options = {}) => {
    const fullUrl = `${LOCAL_SERVER}${url}`;
    const fetchOptions = {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    };
    if (options.body !== undefined) {
        fetchOptions.body = typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body);
    }
    const res = await fetch(fullUrl, fetchOptions);
    return res;
};

export const api = {
    fetch: async (url, options = {}) => {
        // URL 파싱: '/table_name' 또는 '/table_name/id' 형식
        const endpoint = url.split('?')[0];
        const pathParts = endpoint.split('/').filter(p => p !== '');
        const table = pathParts[0]; // e.g., 'process_inspections'

        // ── 로컬 JSON 서버 라우팅 ──────────────────────────────────
        // LOCAL_JSON_TABLES 목록에 있는 테이블은 로컬 서버를 사용
        if (LOCAL_JSON_TABLES.includes(table)) {
            return localFetch(url, options);
        }
        // ─────────────────────────────────────────────────────────

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
                json: async () => data[0]
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
