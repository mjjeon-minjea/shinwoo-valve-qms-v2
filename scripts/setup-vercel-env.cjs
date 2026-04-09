const { execSync } = require('child_process');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envMap = {};

envLocal.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envMap[match[1].trim()] = match[2].trim();
    }
});

const keysToSync = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const environments = ['production', 'preview', 'development'];

for (const key of keysToSync) {
    if (!envMap[key]) {
        console.log(`Key ${key} not found in .env.local! Skipping...`);
        continue;
    }
    
    const value = envMap[key];
    console.log(`\nSetting ${key}...`);
    
    try {
        console.log(`Removing old ${key}...`);
        execSync(`npx vercel env rm ${key} -y`, { stdio: 'pipe' });
    } catch (e) {
        // usually fails if key doesn't exist, ignore
    }
    
    // Create temp file without newline
    fs.writeFileSync('.temp_env_val', value, 'utf8');
    
    for (const env of environments) {
        try {
            execSync(`npx vercel env add ${key} ${env} < .temp_env_val`, { stdio: 'inherit' });
            console.log(`Successfully added ${key} to ${env}`);
        } catch (e) {
            console.error(`Failed to add ${key} to ${env}:`, e.message);
        }
    }
}

try {
    fs.unlinkSync('.temp_env_val');
} catch(e) {}

console.log('\nFinished syncing environment variables to Vercel.');
