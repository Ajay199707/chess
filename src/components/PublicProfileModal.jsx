import React from 'react';
import { Trophy, History, X } from 'lucide-react';

export const PublicProfileModal = ({ profile, onClose, onViewReplay, socket, currentUserEmail }) => {
  if (!profile) return null;

  return (
    <div className="login-overlay-container" style={{ zIndex: 1050 }}>
      <div className="login-card" style={{ maxWidth: '400px', width: '100%', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy size={18} className="text-gold" />
            <h3 style={{ margin: 0 }}>Player Profile</h3>
          </div>
          <button className="icon-only-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="stats-section current-elo-banner" style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '1rem', textAlign: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-gold)' }}>{profile.name}</h4>
          <span className="elo-score-val" style={{ fontSize: '2rem', fontWeight: 'bold' }}>{profile.elo || 1200}</span>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {profile.onlineMatchesPlayed} Online Matches Played
          </div>
          {currentUserEmail && currentUserEmail.toLowerCase() !== profile.email.toLowerCase() && (() => {
            const isFriend = friendsData?.friends?.some(f => f.email.toLowerCase() === profile.email.toLowerCase());
            const hasIncomingRequest = friendsData?.friendRequests?.some(r => r.email.toLowerCase() === profile.email.toLowerCase());
            const hasSentRequest = friendsData?.sentRequests?.some(r => r.email.toLowerCase() === profile.email.toLowerCase());

            if (isFriend) {
              return (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ color: 'var(--color-emerald)', fontSize: '0.85rem' }}>✓ Friends</span>
                </div>
              );
            }
            if (hasSentRequest) {
              return (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Friend Request Pending...</span>
                </div>
              );
            }
            if (hasIncomingRequest) {
              return (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button className="btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => {
                    socket.emit('accept_friend_request', { userEmail: currentUserEmail, senderEmail: profile.email });
                  }}>Accept Request</button>
                  <button className="btn-danger" style={{ padding: '0.5rem 1rem' }} onClick={() => {
                    socket.emit('decline_friend_request', { userEmail: currentUserEmail, senderEmail: profile.email });
                  }}>Decline</button>
                </div>
              );
            }

            return (
              <button className="btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1rem' }} onClick={() => {
                socket.emit('send_friend_request', { senderEmail: currentUserEmail, targetEmail: profile.email });
              }}>
                Add Friend
              </button>
            );
          })()}
        </div>

        <div className="stats-section match-history-section">
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-gold)' }}><History size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/> Recent Matches</h4>
          
          <div className="match-history-list" style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(!profile.matches || profile.matches.length === 0) ? (
              <div className="empty-moves" style={{ padding: '1rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>No recent online matches.</div>
            ) : (
              profile.matches.map((match) => {
                const isWhite = profile.email.toLowerCase() === match.whiteEmail;
                const opponentName = isWhite ? match.blackName : match.whiteName;
                const resultColor = 
                  (match.result === 'white' && isWhite) || (match.result === 'black' && !isWhite) ? 'var(--color-emerald)' :
                  (match.result === 'draw' ? 'var(--text-muted)' : 'var(--color-danger)');
                const resultText = 
                  (match.result === 'white' && isWhite) || (match.result === 'black' && !isWhite) ? 'WIN' :
                  (match.result === 'draw' ? 'DRAW' : 'LOSS');

                return (
                  <div key={match.id} className="match-history-card" onClick={() => onViewReplay(match, profile.email)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer' }}>
                    <div className="match-history-left" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div className="match-opponent" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>vs {opponentName}</div>
                      <div className="match-meta" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {new Date(match.date).toLocaleDateString()} • {match.timeControl}
                      </div>
                    </div>
                    <div className="match-history-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: resultColor, fontWeight: 'bold', fontSize: '0.85rem' }}>{resultText}</span>
                        {isWhite && match.whiteEloChange !== undefined && (
                          <span style={{ fontSize: '0.7rem', color: match.whiteEloChange >= 0 ? 'var(--color-emerald)' : 'var(--color-danger)' }}>
                            ({match.whiteEloChange >= 0 ? '+' : ''}{match.whiteEloChange})
                          </span>
                        )}
                        {!isWhite && match.blackEloChange !== undefined && (
                          <span style={{ fontSize: '0.7rem', color: match.blackEloChange >= 0 ? 'var(--color-emerald)' : 'var(--color-danger)' }}>
                            ({match.blackEloChange >= 0 ? '+' : ''}{match.blackEloChange})
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>as {isWhite ? 'White' : 'Black'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
