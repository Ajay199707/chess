import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

try {
  if (!fs.existsSync(DB_FILE)) {
    console.log("❌ No db.json file found yet. No feedback has been submitted.");
    process.exit(0);
  }

  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const feedbacks = data.feedbacks || [];

  console.log(`\n=== 📊 USER FEEDBACKS (${feedbacks.length}) ===\n`);

  if (feedbacks.length === 0) {
    console.log("No feedback submitted yet.");
  } else {
    feedbacks.reverse().forEach((fb, index) => {
      console.log(`[#${index + 1}] 🏷️  Type: ${fb.type.toUpperCase()}`);
      console.log(`👤 Name: ${fb.name} (${fb.email})`);
      console.log(`⭐ Rating: ${fb.rating}/5`);
      console.log(`🕒 Time: ${new Date(fb.timestamp).toLocaleString()}`);
      console.log(`💬 Message: "${fb.message}"`);
      console.log("-".repeat(50));
    });
  }
} catch (err) {
  console.error("Error reading database:", err);
}
