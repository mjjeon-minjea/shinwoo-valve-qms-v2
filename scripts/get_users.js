import fs from 'fs';
import https from 'https';

const URL = 'https://qrmyhuipfkctgvzgdvmd.supabase.co/rest/v1/users?select=*';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybXlodWlwZmtjdGd2emdkdm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDA1NzIsImV4cCI6MjA4NDU3NjU3Mn0.066T-TgdnFfK_cJOdJPuHfSLpK0qxu_obi_diZBJMbo';

https.get(URL, { headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const users = JSON.parse(data);
    let out = "-- ==========================================\n-- 상용 DB(Production) 전체 사용자 추출본\n-- ==========================================\nDROP TABLE IF EXISTS public.users CASCADE;\nCREATE TABLE public.users (\n  id bigint PRIMARY KEY,\n  email text,\n  password text,\n  name text,\n  company text,\n  role text,\n  rank text,\n  date text,\n  status text\n);\nINSERT INTO public.users (id, email, password, name, company, role, rank, date, status) VALUES\n";
    const values = users.map(u => `(${u.id}, '${u.email || ''}', '${u.password || ''}', '${u.name || ''}', '${u.company || ''}', '${u.role || ''}', '${u.rank || ''}', '${u.date || ''}', '${u.status || 'Active'}')`);
    out += values.join(",\n") + ";\n";
    fs.writeFileSync('users_dump_utf8.sql', out, 'utf8');
  });
});
