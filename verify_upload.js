
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFileName = '테스트_파일_입니다.txt';
const testFilePath = path.join(__dirname, testFileName);

// Create a dummy file
fs.writeFileSync(testFilePath, 'This is a test file contents.');

console.log(`Created test file: ${testFileName}`);

// We need to use 'form-data' and 'node-fetch' to simulate upload
// Since the environment has 'vite', it probably has node, but maybe not 'node-fetch' globally installed if it's not in package.json dependencies for the script runner?
// package.json has "node-fetch": "^3.3.2". Good.

async function uploadFile() {
    try {
        const fetch = (await import('node-fetch')).default;
        const { FormData } = await import('node-fetch'); // wait, node-fetch doesn't export FormData standardly in v3, it uses a polyfill or native? v3 is native-ish but might need 'formdata-polyfill' or similar if not on recent Node.
        // Actually, the project uses 'react', so it's a browser env mainly.
        // But for this Node script, we can use 'form-data' package if installed.
        // checking package.json... it has "node-fetch". Does it have "form-data"? No.

        // Alternative: Use the built-in 'fetch' if Node 18+.
        // Let's assume Node 18+.

        const fileContent = fs.readFileSync(testFilePath);
        const blob = new Blob([fileContent], { type: 'text/plain' });

        // We need a FormData that supports file uploads.
        // In Node 18, global FormData is available.
        const formData = new FormData();
        formData.append('file', blob, testFileName);

        console.log('Uploading file...');
        const response = await fetch('http://localhost:3001/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Upload successful!');
            console.log('Response:', JSON.stringify(result, null, 2));

            if (result.originalName === testFileName) {
                console.log('VERIFICATION PASSED: Filename matches.');
            } else {
                console.log(`VERIFICATION FAILED: Expected '${testFileName}', got '${result.originalName}'`);
                console.log(`Hex of received: ${Buffer.from(result.originalName).toString('hex')}`);
                console.log(`Hex of expected: ${Buffer.from(testFileName).toString('hex')}`);
            }
        } else {
            console.log(`Upload failed with status: ${response.status}`);
            console.log(await response.text());
        }
    } catch (error) {
        console.error('Error during upload:', error);
    } finally {
        // cleanup
        try { fs.unlinkSync(testFilePath); } catch (e) { /* ignore */ }
    }
}

uploadFile();
