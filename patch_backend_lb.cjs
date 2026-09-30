const fs = require('fs');
let code = fs.readFileSync('server/server.js', 'utf8');

const leaderboardLogic = `
  socket.on('request_leaderboard', async () => {
    try {
      // Find top 10 players sorted by ELO descending
      const topPlayers = await User.find({}, 'name elo').sort({ elo: -1 }).limit(10);
      socket.emit('leaderboard_data', topPlayers);
    } catch (e) {
      console.error('Leaderboard error', e);
    }
  });
`;

// Insert logic inside io.on('connection')
code = code.replace(
  "socket.on('enter_lobby', () => {",
  leaderboardLogic + "\n  socket.on('enter_lobby', () => {"
);

// We need to whitelist request_leaderboard so unauthenticated players can still view it
code = code.replace(
  "const publicEvents = ['register', 'login', 'google_login', 'verify_session', 'disconnect'];",
  "const publicEvents = ['register', 'login', 'google_login', 'verify_session', 'disconnect', 'request_leaderboard'];"
);

fs.writeFileSync('server/server.js', code);
