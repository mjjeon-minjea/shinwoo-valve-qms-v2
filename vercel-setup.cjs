
const { spawn, execSync } = require('child_process');

function addEnv(key, value) {
  return new Promise((resolve) => {
    console.log('Adding ' + key);
    const cp = spawn('npx.cmd', ['--yes', 'vercel', 'env', 'add', key, 'production'], { shell: true });
    
    cp.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('What¡¯s the value')) {
        cp.stdin.write(value + '\n');
      } 
      if (output.includes('Mark as sensitive')) {
        cp.stdin.write('N\n');
      }
    });

    cp.stderr.on('data', data => console.log(data.toString()));
    cp.on('close', resolve);
  });
}

(async () => {
   try {
     execSync('npx.cmd --yes vercel env rm VITE_SUPABASE_URL production -y', {stdio:'ignore'});
     execSync('npx.cmd --yes vercel env rm VITE_SUPABASE_ANON_KEY production -y', {stdio:'ignore'});
   } catch(e) {}
   
   await addEnv('VITE_SUPABASE_URL', 'https://qrmyhuipfkctgvzgdvmd.supabase.co');
   await addEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybXlodWlwZmtjdGd2emdkdm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDA1NzIsImV4cCI6MjA4NDU3NjU3Mn0.066T-TgdnFfK_cJOdJPuHfSLpK0qxu_obi_diZBJMbo');
   
   console.log('Env variables configured. Triggering redeploy...');
   try {
       execSync('npx.cmd --yes vercel deploy --prod --yes', {stdio:'inherit'});
       console.log('Redeploy success!');
   } catch(e) {
       console.log('Deploy error', e.message);
   }
})();

