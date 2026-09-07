const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const target = \                    <button className="btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowGameReview(true)}>
                      <Search size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                      Review Game
                    </button>

                    {gameMode === 'online-2p' ? (
                      isSpectator ? (
                        <p className="spectator-msg">Waiting for players to request rematch...</p>
                      ) : restartOfferPending ? (
                        <div className="rematch-proposal-box">
                          <p className="rematch-proposal-text font-pulse">?? Opponent offered a Rematch!</p>
                          <div className="btn-actions-row">
                            <button className="btn-primary" onClick={() => handleRespondRestart(true)}>
                              Accept
                            </button>
                            <button className="btn-danger" onClick={() => handleRespondRestart(false)}>
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : rematchRequestSent ? (
                        <div className="rematch-status-box">
                          <p className="rematch-status-text font-pulse">? Waiting for opponent to accept...</p>
                        </div>
                      ) : (
                        <button className="btn-primary" onClick={handleOfferRestart}>
                          <RotateCcw size={16} /> Request Rematch
                        </button>
                      )
                    ) : (
                      <button className="btn-primary" onClick={handleOfferRestart}>
                        <RotateCcw size={16} /> Play Again
                      </button>
                    )}\;

const replacement = \                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                    <button className="btn-primary" onClick={() => setShowGameReview(true)}>
                      <Search size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                      Review Game
                    </button>

                    {gameMode === 'online-2p' ? (
                      isSpectator ? (
                        <p className="spectator-msg" style={{ width: '100%' }}>Waiting for players to request rematch...</p>
                      ) : restartOfferPending ? (
                        <div className="rematch-proposal-box" style={{ width: '100%' }}>
                          <p className="rematch-proposal-text font-pulse">?? Opponent offered a Rematch!</p>
                          <div className="btn-actions-row">
                            <button className="btn-primary" onClick={() => handleRespondRestart(true)}>Accept</button>
                            <button className="btn-danger" onClick={() => handleRespondRestart(false)}>Decline</button>
                          </div>
                        </div>
                      ) : rematchRequestSent ? (
                        <div className="rematch-status-box" style={{ width: '100%' }}>
                          <p className="rematch-status-text font-pulse">? Waiting for opponent to accept...</p>
                        </div>
                      ) : (
                        <button className="btn-primary" onClick={handleOfferRestart}>
                          <RotateCcw size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Request Rematch
                        </button>
                      )
                    ) : (
                      <button className="btn-primary" onClick={handleOfferRestart}>
                        <RotateCcw size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Play Again
                      </button>
                    )}
                  </div>\;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx updated!');
