const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add Import
code = code.replace(
  "import { FeedbackModal } from './components/FeedbackModal';",
  "import { FeedbackModal } from './components/FeedbackModal';\nimport { LeaderboardModal } from './components/LeaderboardModal';"
);

// 2. Add State
code = code.replace(
  "const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);",
  "const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);\n  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);"
);

// 3. Add Button (Next to Feedback or in the main lobby menu)
// Let's find a good spot in the lobby view.
// In the lobby view, we have a section:
/*
  <button onClick={() => setGameMode('online-2p')} className="btn-primary flex items-center justify-center gap-2">
    <Globe size={20} /> Play Online Multiplayer
  </button>
*/
const targetButton = `<button onClick={() => setGameMode('online-2p')} className="btn-primary flex items-center justify-center gap-2">
                  <Globe size={20} /> Play Online Multiplayer
                </button>`;

const newButtons = `<button onClick={() => setGameMode('online-2p')} className="btn-primary flex items-center justify-center gap-2">
                  <Globe size={20} /> Play Online Multiplayer
                </button>
                <button onClick={() => setIsLeaderboardOpen(true)} className="btn-secondary flex items-center justify-center gap-2 mt-3 w-full p-3 rounded font-bold bg-[#1A120B] border border-[#C6A664] text-[#C6A664] hover:bg-[#3E2723]">
                  <Trophy size={20} /> Global Leaderboard
                </button>`;

code = code.replace(targetButton, newButtons);

// 4. Add the component render at the end of the return statement
code = code.replace(
  "{isFeedbackOpen && (",
  "<LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} socket={socket} />\n      {isFeedbackOpen && ("
);

fs.writeFileSync('src/App.jsx', code);
