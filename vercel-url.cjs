
const { spawn } = require('child_process');
const cp = spawn('npx.cmd', ['--yes', 'vercel', 'env', 'add', 'VITE_SUPABASE_URL', 'production'], { shell: true });
cp.stdout.on('data', (d) => {
  const str = d.toString();
  console.log('OUT:', str);
  if (str.includes('value')) cp.stdin.write('https://qrmyhuipfkctgvzgdvmd.supabase.co\n');
  if (str.includes('sensitive')) cp.stdin.write('N\n');
});
cp.stderr.on('data', d => console.log('ERR:', d.toString()));
cp.on('close', () => console.log('Done'));

