import React, { useState } from 'react';
import { X, HelpCircle, BookOpen, ShieldAlert, Award } from 'lucide-react';

export const Guidelines = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('how-to-play');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content guidelines-modal">
        <header className="modal-header">
          <div className="modal-title">
            <HelpCircle size={24} className="text-gold" />
            <h2>Chess Rules & Guidelines</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close guidelines">
            <X size={20} />
          </button>
        </header>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'how-to-play' ? 'active' : ''}`}
            onClick={() => setActiveTab('how-to-play')}
          >
            <BookOpen size={16} />
            How to Play
          </button>
          <button
            className={`tab-btn ${activeTab === 'special-moves' ? 'active' : ''}`}
            onClick={() => setActiveTab('special-moves')}
          >
            <Award size={16} />
            Special Moves
          </button>
          <button
            className={`tab-btn ${activeTab === 'multiplayer' ? 'active' : ''}`}
            onClick={() => setActiveTab('multiplayer')}
          >
            <ShieldAlert size={16} />
            Multiplayer Room Rules
          </button>
        </div>

        <div className="modal-body scrollable">
          {activeTab === 'how-to-play' && (
            <div className="tab-pane animate-fade-in">
              <h3>Basic Chess Rules</h3>
              <p>Chess is played on an 8x8 grid of alternating dark and light squares. Each player starts with 16 pieces: 1 King, 1 Queen, 2 Rooks, 2 Bishops, 2 Knights, and 8 Pawns.</p>
              
              <div className="pieces-guide-grid">
                <div className="piece-guide-card">
                  <strong>👑 King</strong>
                  <p>Moves 1 square in any direction. If the King is captured (Checkmate), the game ends.</p>
                </div>
                <div className="piece-guide-card">
                  <strong>👸 Queen</strong>
                  <p>Moves any number of vacant squares in any direction (straight or diagonal).</p>
                </div>
                <div className="piece-guide-card">
                  <strong>♜ Rook</strong>
                  <p>Moves any number of vacant squares horizontally or vertically.</p>
                </div>
                <div className="piece-guide-card">
                  <strong>♝ Bishop</strong>
                  <p>Moves any number of vacant squares diagonally.</p>
                </div>
                <div className="piece-guide-card">
                  <strong>♞ Knight</strong>
                  <p>Moves in an "L-shape": two squares vertically and one horizontally (or vice versa). Knights can jump over other pieces.</p>
                </div>
                <div className="piece-guide-card">
                  <strong>♟ Pawn</strong>
                  <p>Moves forward 1 square (or 2 squares on its first move). Captures diagonally forward. Pawns cannot move backwards.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'special-moves' && (
            <div className="tab-pane animate-fade-in">
              <h3>Special Game Mechanics</h3>
              <div className="mechanic-card">
                <h4>🏰 Castling</h4>
                <p>A move involving the King and a Rook. The King moves 2 squares towards a Rook, and the Rook jumps over the King. Allowed only if: neither piece has moved, the path is clear, and the King is not in check or passing through check.</p>
              </div>
              <div className="mechanic-card">
                <h4>⚔️ En Passant (In Passing)</h4>
                <p>If an opponent pawn moves 2 squares forward and lands adjacent to your pawn, you can capture it diagonally "in passing" as if it had only moved 1 square. This capture must be made on the very next turn.</p>
              </div>
              <div className="mechanic-card">
                <h4>🚀 Pawn Promotion</h4>
                <p>If your pawn reaches the furthest rank (the 8th rank for White, or 1st rank for Black), it is immediately promoted to a Queen, Rook, Bishop, or Knight of the same color.</p>
              </div>
            </div>
          )}

          {activeTab === 'multiplayer' && (
            <div className="tab-pane animate-fade-in">
              <h3>Online Matchmaking & Lobby Rules</h3>
              <div className="rules-list">
                <div className="rule-item">
                  <span className="rule-num">1</span>
                  <p><strong>Room Creation:</strong> Creating a room generates a unique 6-character room code. You can copy and share the link directly with your friend.</p>
                </div>
                <div className="rule-item">
                  <span className="rule-num">2</span>
                  <p><strong>Color Assignment:</strong> The first player who creates the room is assigned **White**. The second player to join is assigned **Black**. All subsequent connections enter as **Spectators**.</p>
                </div>
                <div className="rule-item">
                  <span className="rule-num">3</span>
                  <p><strong>Game Clock / Timers:</strong> If a timer (Bullet/Blitz/Rapid) is chosen, players must make their moves before their individual clock runs out. Running out of time results in an automatic loss (Timeout).</p>
                </div>
                <div className="rule-item">
                  <span className="rule-num">4</span>
                  <p><strong>Disconnections:</strong> If a player disconnects, they have **30 seconds** to reconnect to the lobby. After 30 seconds of absence, the remaining player is declared the winner by abandonment.</p>
                </div>
                <div className="rule-item">
                  <span className="rule-num">5</span>
                  <p><strong>Drawing & Undos:</strong> Players can offer draws or request move undos. These require the opponent's confirmation (Accept/Decline) to take effect.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Understood</button>
        </footer>
      </div>
    </div>
  );
};
