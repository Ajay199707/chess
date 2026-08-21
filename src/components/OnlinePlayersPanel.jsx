import React, { useState } from 'react';
import { Users, Award, Play, Eye } from 'lucide-react';

export function OnlinePlayersPanel({ onlineUsers, activeMatches = [], currentUserEmail, onSendChallenge, onNotifyPlayer, onWatchMatch }) {
  const [selectedTimeControl, setSelectedTimeControl] = useState('blitz5');
  const [activeTab, setActiveTab] = useState('players'); // 'players' or 'matches'

  // Filter out current user from the challenge options list
  const otherUsers = onlineUsers.filter(u => u.email !== currentUserEmail?.toLowerCase());

  // Determine if current user is playing
  const currentUser = onlineUsers.find(u => u.email === currentUserEmail?.toLowerCase());
  const isCurrentUserPlaying = currentUser?.status === 'playing';

  return (
    <div className="online-players-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button 
          onClick={() => setActiveTab('players')}
          style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'players' ? '#f59e0b' : 'inherit', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Users size={16} /> Players ({onlineUsers.length})
        </button>
        <button 
          onClick={() => setActiveTab('matches')}
          style={{ flex: 1, background: 'none', border: 'none', color: activeTab === 'matches' ? '#f59e0b' : 'inherit', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Eye size={16} /> Live Matches ({activeMatches.length})
        </button>
      </div>

      {activeTab === 'players' && (
        <>
          {/* Time control selector for challenges */}
          <div className="challenge-settings" style={{ marginTop: '1rem' }}>
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
                          <div className="in-game-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span className="status-tag playing">In Match</span>
                            {!isCurrentUserPlaying && (
                              <button
                                className="btn-challenge-primary btn-notify-next"
                                onClick={() => onNotifyPlayer && onNotifyPlayer(player.email, player.name)}
                                title={`Notify ${player.name} that you're waiting for next match`}
                                style={{ padding: '0.375rem 0.5rem', background: '#3b82f6', color: 'white' }}
                              >
                                🔔 Notify
                              </button>
                            )}
                          </div>
                        ) : (
                          !isCurrentUserPlaying && (
                            <button
                              className="btn-challenge-primary"
                              onClick={() => onSendChallenge(player.email, player.name, selectedTimeControl)}
                              title={`Challenge ${player.name} to a match`}
                            >
                              <Play size={10} /> Challenge
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'matches' && (
        <div className="players-list-scroll" style={{ marginTop: '1rem' }}>
          {activeMatches.length === 0 ? (
            <span className="empty-players">No matches are currently being played.</span>
          ) : (
            <div className="online-players-list">
              {activeMatches.map((match) => (
                <div key={match.id} className="online-player-row in-game">
                  <div className="player-info" style={{ flex: 1 }}>
                    <div className="player-details">
                      <span className="player-name-text" style={{ fontSize: '0.85rem' }}>
                        ⚪ {match.white} <span style={{ opacity: 0.6 }}>({match.whiteElo})</span>
                      </span>
                      <span className="player-name-text" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        ⚫ {match.black} <span style={{ opacity: 0.6 }}>({match.blackElo})</span>
                      </span>
                    </div>
                  </div>
                  <div className="player-action">
                    <button
                      className="btn-challenge-primary"
                      onClick={() => onWatchMatch && onWatchMatch(match.id)}
                      title="Watch this match"
                      style={{ background: '#10b981' }}
                    >
                      <Eye size={12} style={{ marginRight: '4px' }} /> Watch
                    </button>
                    {match.spectators > 0 && (
                      <div style={{ fontSize: '0.7rem', textAlign: 'center', marginTop: '4px', opacity: 0.7 }}>
                        {match.spectators} watching
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
