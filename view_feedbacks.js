import https from 'https';

const BACKEND_URL = 'https://chess-smdm.onrender.com/api/feedbacks';

console.log(`\nFetching feedbacks from live cloud server...\n`);

https.get(BACKEND_URL, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const feedbacks = JSON.parse(data);
      if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
        console.log("❌ No feedback has been submitted to the live server yet.");
        return;
      }
      
      console.log(`=== 📊 LIVE USER FEEDBACKS (${feedbacks.length}) ===\n`);
      
      feedbacks.reverse().forEach((fb, index) => {
        console.log(`[#${index + 1}] 🏷️  Type: ${fb.type.toUpperCase()}`);
        console.log(`👤 Name: ${fb.name} (${fb.email})`);
        console.log(`⭐ Rating: ${fb.rating}/5`);
        console.log(`🕒 Time: ${new Date(fb.timestamp).toLocaleString()}`);
        console.log(`💬 Message: "${fb.message}"`);
        console.log("-".repeat(50));
      });
    } catch (err) {
      console.error("Error parsing response:", err);
    }
  });
}).on('error', (err) => {
  console.error("Failed to connect to the cloud server:", err.message);
});
