import React from 'react';
import { Trophy, History } from 'lucide-react';

export const ProfilePanel = ({ stats, matchHistory, onResetStats, onViewReplay, userProfile }) => {
  return (
    <div className="stats-panel profile-panel">
      <div className="panel-header">
        <Trophy size={18} className="text-gold" />
        <h3>🏆 Player Profile</h3>
      </div>

      <div className="stats-section current-elo-banner">
        <h4>{userProfile?.name || 'Guest'} - ELO Rating</h4>
        <span className="elo-score-val">{stats.elo || 1200}</span>
      </div>

      <div className="stats-section match-history-section">
        <h4><History size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/> Recent Matches (Online)</h4>
        
        <div className="match-history-list" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {(!matchHistory || matchHistory.length === 0) ? (
            <div className="empty-moves" style={{ padding: '1rem 0' }}>No recent online matches.</div>
          ) : (
            matchHistory.map((match) => {
              const isWhite = userProfile?.email?.toLowerCase() === match.whiteEmail;
              const opponentName = isWhite ? match.blackName : match.whiteName;
              const resultColor = 
                (match.result === 'white' && isWhite) || (match.result === 'black' && !isWhite) ? 'var(--color-emerald)' :
                (match.result === 'draw' ? 'var(--text-muted)' : 'var(--color-danger)');
              const resultText = 
                (match.result === 'white' && isWhite) || (match.result === 'black' && !isWhite) ? 'WIN' :
                (match.result === 'draw' ? 'DRAW' : 'LOSS');

              return (
                <div key={match.id} className="match-history-card" onClick={() => onViewReplay(match)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer' }}>
                  <div className="match-history-left" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div className="match-opponent" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>vs {opponentName}</div>
                    <div className="match-meta" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {new Date(match.date).toLocaleDateString()} • {match.timeControl}
                    </div>
                  </div>
                  <div className="match-history-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ color: resultColor, fontWeight: 'bold', fontSize: '0.85rem' }}>{resultText}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>as {isWhite ? 'White' : 'Black'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="stats-section">
        <h4>🌐 Online Stats</h4>
        <div className="stats-row">
          <span>Overall:</span>
          <strong>{stats.online.wins}W - {stats.online.losses}L - {stats.online.draws}D</strong>
        </div>
      </div>

      <div className="stats-section">
        <h4>🤖 vs Chess Bot AI</h4>
        <div className="stats-row">
          <span>Easy:</span>
          <strong>{stats.vsBot.easy.wins}W - {stats.vsBot.easy.losses}L - {stats.vsBot.easy.draws}D</strong>
        </div>
        <div className="stats-row">
          <span>Medium:</span>
          <strong>{stats.vsBot.medium.wins}W - {stats.vsBot.medium.losses}L - {stats.vsBot.medium.draws}D</strong>
        </div>
        <div className="stats-row">
          <span>Hard:</span>
          <strong>{stats.vsBot.hard.wins}W - {stats.vsBot.hard.losses}L - {stats.vsBot.hard.draws}D</strong>
        </div>
      </div>

      <div className="stats-section">
        <h4>👥 Pass & Play (Local)</h4>
        <div className="stats-row">
          <span>Wins P1 / P2:</span>
          <strong>{stats.local.p1Wins}W - {stats.local.p2Wins}W - {stats.local.draws}D</strong>
        </div>
      </div>

      <button 
        className="btn-outline-gold full-width"
        onClick={onResetStats}
        style={{ marginTop: '0.5rem' }}
      >
        Reset Statistics
      </button>
    </div>
  );
};
