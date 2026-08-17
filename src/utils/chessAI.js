// Chess Bot AI using Minimax with Alpha-Beta Pruning, Move Ordering, and Positional Tables (PST)

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (PST) from White's perspective
// Higher values encourage the bot to place pieces on those squares.
// For Black, the indices are mirrored horizontally/vertically.

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MIDDLEGAME_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

function getPiecePST(type, r, c, isWhite) {
  const row = isWhite ? 7 - r : r;
  const col = isWhite ? c : 7 - c;

  switch (type) {
    case 'p': return PAWN_PST[row][col];
    case 'n': return KNIGHT_PST[row][col];
    case 'b': return BISHOP_PST[row][col];
    case 'r': return ROOK_PST[row][col];
    case 'q': return QUEEN_PST[row][col];
    case 'k': return KING_MIDDLEGAME_PST[row][col];
    default: return 0;
  }
}

// Evaluate full board state
function evaluateBoard(chess) {
  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = board[r][c];
      if (square) {
        const value = PIECE_VALUES[square.type];
        const pstBonus = getPiecePST(square.type, r, c, square.color === 'w');
        const pieceVal = value + pstBonus;

        if (square.color === 'w') {
          score += pieceVal;
        } else {
          score -= pieceVal;
        }
      }
    }
  }

  // Factor in checkmate/draw immediately in evaluation if possible
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    return 0;
  }

  return score;
}

// Move sorting for alpha-beta optimization
// Sorts by: MVV-LVA (Most Valuable Victim, Least Valuable Aggressor), promotions, and check creation
function sortMoves(chess, moves) {
  return moves.map(move => {
    let score = 0;

    // Capture score (MVV-LVA)
    if (move.captured) {
      score += PIECE_VALUES[move.captured] * 10 - PIECE_VALUES[move.piece];
      score += 1000; // Base capture incentive
    }

    // Promotion score
    if (move.promotion) {
      score += PIECE_VALUES[move.promotion] + 2000;
    }

    // Checks are good
    chess.move(move);
    if (chess.inCheck()) {
      score += 500;
    }
    chess.undo();

    return { move, score };
  })
  .sort((a, b) => b.score - a.score)
  .map(item => item.move);
}

// Minimax with Alpha-Beta Pruning
function minimax(chess, depth, alpha, beta, isMaximizing) {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = sortMoves(chess, chess.moves({ verbose: true }));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalVal = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, evalVal);
      if (beta <= alpha) break; // Prune
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evalVal = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, evalVal);
      if (beta <= alpha) break; // Prune
    }
    return minEval;
  }
}

// Public API for Bot choice
export const getBestMove = (chess, difficulty = 'medium') => {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  // 1. Easy Mode: 50% Random move, 50% search depth 1
  if (difficulty === 'easy') {
    if (Math.random() < 0.4) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    return getMinimaxBestMove(chess, 1);
  }

  // 2. Medium Mode: Search depth 2 (very responsive, decent play)
  if (difficulty === 'medium') {
    return getMinimaxBestMove(chess, 2);
  }

  // 3. Hard Mode: Search depth 3 (strong chess play, 100-300ms calculations)
  return getMinimaxBestMove(chess, 3);
};

function getMinimaxBestMove(chess, depth) {
  const moves = sortMoves(chess, chess.moves({ verbose: true }));
  let bestMove = null;
  const isWhite = chess.turn() === 'w';

  let alpha = -Infinity;
  let beta = Infinity;

  if (isWhite) {
    let bestScore = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
    }
  } else {
    let bestScore = Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();

      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      beta = Math.min(beta, score);
    }
  }

  // Fallback to random if bestMove is not resolved (should not occur)
  return bestMove || moves[Math.floor(Math.random() * moves.length)];
}
