const fs = require('fs');
let code = fs.readFileSync('server/server.js', 'utf8');

// Add Match Schema right after User Schema
const matchSchemaLogic = `
const matchSchema = new mongoose.Schema({
  roomId: String,
  whiteEmail: String,
  whiteName: String,
  blackEmail: String,
  blackName: String,
  result: String,
  reason: String,
  pgn: String,
  createdAt: { type: Date, default: Date.now }
});
const Match = mongoose.model('Match', matchSchema);
`;
code = code.replace("const User = mongoose.model('User', userSchema);", "const User = mongoose.model('User', userSchema);\n" + matchSchemaLogic);

// Add request_match_history socket event right below request_leaderboard
const requestHistoryLogic = `
  socket.on('request_match_history', async () => {
    try {
      const email = socket.user.email;
      const matches = await Match.find({
        $or: [{ whiteEmail: email }, { blackEmail: email }]
      }).sort({ createdAt: -1 }).limit(20);
      socket.emit('match_history_data', matches);
    } catch (e) {
      console.error('Match history error', e);
    }
  });
`;
code = code.replace("socket.on('enter_lobby', () => {", requestHistoryLogic + "\n  socket.on('enter_lobby', () => {");

// Update game over logic inside make_move
const oldGameOverLogic = `        if (room.chess.isGameOver()) {
          room.status = 'completed';
          let winner = null;
          if (room.chess.isCheckmate()) {
            winner = room.chess.turn() === 'w' ? 'b' : 'w';
            
            // Basic ELO adjustment logic (winner +25, loser -25)
            const winnerEmail = room.players[winner];
            const loserEmail = room.players[winner === 'w' ? 'b' : 'w'];
            
            await User.updateOne({ email: winnerEmail }, { $inc: { elo: 25 } });
            await User.updateOne({ email: loserEmail }, { $inc: { elo: -25 } });
          }
          io.to(roomCode).emit('game_over', { reason: 'checkmate', winner });
        }`;

const newGameOverLogic = `        if (room.chess.isGameOver()) {
          room.status = 'completed';
          let winner = null;
          let result = 'draw';
          let reason = 'draw';

          if (room.chess.isCheckmate()) {
            winner = room.chess.turn() === 'w' ? 'b' : 'w';
            result = winner === 'w' ? 'white' : 'black';
            reason = 'checkmate';
            
            const winnerEmail = room.players[winner];
            const loserEmail = room.players[winner === 'w' ? 'b' : 'w'];
            await User.updateOne({ email: winnerEmail }, { $inc: { elo: 25 } });
            await User.updateOne({ email: loserEmail }, { $inc: { elo: -25 } });
          } else if (room.chess.isStalemate()) {
            reason = 'stalemate';
          } else if (room.chess.isThreefoldRepetition()) {
            reason = 'repetition';
          } else if (room.chess.isInsufficientMaterial()) {
            reason = 'insufficient';
          } else if (room.chess.isDraw()) {
            reason = '50-move';
          }

          try {
            const whiteUser = await User.findOne({ email: room.players.w });
            const blackUser = await User.findOne({ email: room.players.b });

            await Match.create({
              roomId: roomCode,
              whiteEmail: room.players.w,
              whiteName: whiteUser ? whiteUser.name : 'Unknown',
              blackEmail: room.players.b,
              blackName: blackUser ? blackUser.name : 'Unknown',
              result,
              reason,
              pgn: room.chess.pgn()
            });
          } catch(err) {
            console.error('Failed to save match history', err);
          }

          io.to(roomCode).emit('game_over', { reason, winner });
        }`;

code = code.replace(oldGameOverLogic, newGameOverLogic);

fs.writeFileSync('server/server.js', code);
