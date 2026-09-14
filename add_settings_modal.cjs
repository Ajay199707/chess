const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const settingsModal = `
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Settings2 size={24} /> Settings & Themes</h2>
              <button className="icon-only-btn" onClick={() => setIsSettingsOpen(false)}><X size={24}/></button>
            </div>
            
            <div className="modal-body settings-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              
              <div className="setting-row">
                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Board Theme</label>
                <select 
                  value={boardTheme} 
                  onChange={(e) => setBoardTheme(e.target.value)}
                  className="select-dropdown"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                >
                  <option value="emerald">Classic Emerald</option>
                  <option value="wood">Walnut Wood</option>
                  <option value="slate">Midnight Slate</option>
                  <option value="cyberpunk">Neon Cyberpunk</option>
                </select>
              </div>

              <div className="setting-row">
                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Piece Style</label>
                <select 
                  value={pieceStyle} 
                  onChange={(e) => setPieceStyle(e.target.value)}
                  className="select-dropdown"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                >
                  <option value="staunton">Classic Staunton</option>
                  <option value="neo">Unicode Neo</option>
                  <option value="minimalist">Minimalist Geometric</option>
                  <option value="cyber">Neon Cyber</option>
                  <option value="tokens">3D Wood & Marble Tokens</option>
                </select>
              </div>

              <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <label style={{ fontWeight: '600' }}>Sound Effects</label>
                <button 
                  className={\`btn \${soundEnabled ? 'btn-primary' : 'btn-secondary'}\`}
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  {soundEnabled ? 'On' : 'Off'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}`;

if (!code.includes('{isSettingsOpen && (')) {
  code = code.replace(/\{showGameReview && \(/, settingsModal + '\n      {showGameReview && (');
}

fs.writeFileSync('src/App.jsx', code);
