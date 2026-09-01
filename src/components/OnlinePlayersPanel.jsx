import React, { useState } from 'react';
import { Users, Award, Play, Eye, MessageSquare } from 'lucide-react';
import { GlobalChatPanel } from './GlobalChatPanel';

export function OnlinePlayersPanel({ onlineUsers, activeMatches = [], globalMessages = [], currentUserEmail, onSendChallenge, onNotifyPlayer, onWatchMatch, socket, playerName, friendsData }) {
  const [selectedTimeControl, setSelectedTimeControl] = useState('blitz5');
  const [activeTab, setActiveTab] = useState('players'); // 'players', 'matches', 'chat', 'friends'

  // Filter out current user from the challenge options list
  const otherUsers = onlineUsers.filter(u => u.email !== currentUserEmail?.toLowerCase());

  // Determine if current user is playing
  const currentUser = onlineUsers.find(u => u.email === currentUserEmail?.toLowerCase());
  const isCurrentUserPlaying = currentUser?.status === 'playing';

  return (
    <div className="online-players-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
      <div className="lobby-tabs-header">
        <button 
          className={`lobby-tab-btn ${activeTab === 'players' ? 'active' : ''}`}
          onClick={() => setActiveTab('players')}
        >
          <Users size={16} /> <span className="tab-label">Players</span>
        </button>
        <button 
          className={`lobby-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          <Award size={16} /> <span className="tab-label">Friends</span>
        </button>
        <button 
          className={`lobby-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <Eye size={16} /> <span className="tab-label">Matches</span>
        </button>
        <button 
          className={`lobby-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} /> <span className="tab-label">Chat</span>
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
                      <div 
                        className="player-info" 
                        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                        onClick={() => {
                          if (socket) {
                            socket.emit('request_public_profile', { email: player.email });
                          }
                        }}
                        title={`View ${player.name}'s Profile`}
                      >
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

      {activeTab === 'friends' && (
        <div className="friends-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {friendsData?.friendRequests?.length > 0 && (
            <div className="friend-requests-section">
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', fontSize: '0.85rem' }}>Pending Requests</h4>
              {friendsData.friendRequests.map((req, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                  <span>{req.name} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>({req.elo})</span></span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => socket.emit('accept_friend_request', { userEmail: currentUserEmail, senderEmail: req.email })}>Accept</button>
                    <button className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => socket.emit('decline_friend_request', { userEmail: currentUserEmail, senderEmail: req.email })}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="friends-section">
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>My Friends</h4>
            {(!friendsData?.friends || friendsData.friends.length === 0) ? (
              <div className="empty-players">You haven't added any friends yet.</div>
            ) : (
              friendsData.friends.map((friend, i) => {
                const isOnline = onlineUsers.some(u => u.email === friend.email.toLowerCase());
                const friendStatus = onlineUsers.find(u => u.email === friend.email.toLowerCase())?.status;
                
                return (
                  <div key={i} className="player-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.5rem' }} onClick={() => {
                    if (socket) socket.emit('request_public_profile', { email: friend.email });
                  }}>
                    <div className="player-details">
                      <span className="player-name">
                        <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`} style={{ 
                          display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', 
                          background: isOnline ? '#10b981' : '#6b7280', marginRight: '6px' 
                        }}></span>
                        {friend.name}
                      </span>
                      <span className="player-elo">ELO: {friend.elo}</span>
                      {isOnline && <span className="player-status" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginLeft: '14px' }}>{friendStatus === 'playing' ? 'In Game' : 'In Lobby'}</span>}
                    </div>
                    <div className="player-actions" onClick={(e) => e.stopPropagation()}>
                      {isOnline && friendStatus === 'lobby' ? (
                        <button 
                          className="btn-primary challenge-btn"
                          onClick={() => onSendChallenge(friend.name, friend.email, selectedTimeControl)}
                          disabled={isCurrentUserPlaying}
                        >
                          <Play size={14} /> Play
                        </button>
                      ) : isOnline && friendStatus === 'playing' ? (
                        <button className="btn-secondary challenge-btn" disabled>
                          Playing
                        </button>
                      ) : (
                        <button className="btn-secondary challenge-btn" disabled>
                          Offline
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
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

      {activeTab === 'chat' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: '1rem' }}>
          <GlobalChatPanel 
            socket={socket} 
            playerName={playerName} 
            globalMessages={globalMessages} 
          />
        </div>
      )}
    </div>
  );
}
