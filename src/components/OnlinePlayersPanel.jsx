import React, { useState } from 'react';
import { Users, Award, Play } from 'lucide-react';

export function OnlinePlayersPanel({ onlineUsers, currentUserEmail, onSendChallenge }) {
  const [selectedTimeControl, setSelectedTimeControl] = useState('blitz5');

  // Filter out current user from the challenge options list
  const otherUsers = onlineUsers.filter(u => u.email !== currentUserEmail?.toLowerCase());

  return (
    <div className="online-players-panel">
      <div className="panel-header">
        <h3>
          <Users size={18} /> Online Players ({onlineUsers.length})
        </h3>
      </div>

      {/* Time control selector for challenges */}
      <div className="challenge-settings">
        <label htmlFor="challenge-time-select">Match Time Control:</label>
        <select
          id="challenge-time-select"
          value={selectedTimeControl}
          onChange={(e) => setSelectedTimeControl(e.target.value)}
          className="theme-select"
        >
          <option value="casual">Casual (Untimed)</option>
          <option value="bullet">1 min (Bullet)</option>
          <option value="blitz3">3 min (Blitz)</option>
          <option value="blitz5">5 min (Blitz)</option>
          <option value="rapid10">10 min (Rapid)</option>
        </select>
      </div>

      <div className="players-list-scroll">
        {otherUsers.length === 0 ? (
          <span className="empty-players">No other players online yet. Invite a friend to register!</span>
        ) : (
          <div className="online-players-list">
            {otherUsers.map((player) => {
              const isPlaying = player.status === 'playing';
              return (
                <div key={player.email} className={`online-player-row ${isPlaying ? 'in-game' : ''}`}>
                  <div className="player-info">
                    <span className="player-status-indicator"></span>
                    <div className="player-details">
                      <span className="player-name-text">{player.name}</span>
                      <span className="player-elo-text">
                        <Award size={10} /> {player.elo || 1200} ELO
                      </span>
                    </div>
                  </div>

                  <div className="player-action">
                    {isPlaying ? (
                      <span className="status-tag playing">In Match</span>
                    ) : (
                      <button
                        className="btn-challenge-primary"
                        onClick={() => onSendChallenge(player.email, selectedTimeControl)}
                        title={`Challenge ${player.name} to a match`}
                      >
                        <Play size={10} /> Challenge
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
