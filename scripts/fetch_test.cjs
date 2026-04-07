const prodUrl = "https://qrmyhuipfkctgvzgdvmd.supabase.co";
const prodAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybXlodWlwZmtjdGd2emdkdm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDA1NzIsImV4cCI6MjA4NDU3NjU3Mn0.066T-TgdnFfK_cJOdJPuHfSLpK0qxu_obi_diZBJMbo";

async function testFetch() {
    console.log("Fetching dev_notes...");
    const res = await fetch(`${prodUrl}/rest/v1/dev_notes?select=id,title`, {
        headers: { "apikey": prodAnonKey, "Authorization": `Bearer ${prodAnonKey}` }
    });
    console.log("dev_notes status:", res.status);
    const data = await res.json();
    console.log("dev_notes items:", data.length);
}
testFetch();
