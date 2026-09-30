import React, { useState, useEffect } from 'react';
import { X, Trophy, Medal } from 'lucide-react';

export function LeaderboardModal({ isOpen, onClose, socket }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !socket) return;

    setLoading(true);
    socket.emit('request_leaderboard');

    const handleData = (data) => {
      setLeaderboard(data);
      setLoading(false);
    };

    socket.on('leaderboard_data', handleData);
    return () => {
      socket.off('leaderboard_data', handleData);
    };
  }, [isOpen, socket]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-[#2C211A] border-2 border-[#C6A664] rounded-lg p-6 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#C6A664] hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-[#C6A664] mb-6 flex items-center gap-2">
          <Trophy size={28} /> Global Top Players
        </h2>

        {loading ? (
          <div className="text-center text-gray-400 py-8">Fetching ranks...</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No players ranked yet.</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {leaderboard.map((player, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between p-3 rounded bg-[#1A120B] border ${index < 3 ? 'border-[#C6A664]' : 'border-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="font-bold text-xl flex items-center justify-center w-8">
                    {index === 0 && <span className="text-yellow-400">👑</span>}
                    {index === 1 && <span className="text-gray-300">🥈</span>}
                    {index === 2 && <span className="text-orange-400">🥉</span>}
                    {index > 2 && <span className="text-gray-500">#{index + 1}</span>}
                  </div>
                  <div>
                    <div className="font-bold text-gray-200">{player.name}</div>
                    <div className="text-xs text-gray-400">{player.gamesPlayed || 0} Games Played</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#C6A664]">{player.elo}</span>
                  <span className="text-xs text-gray-500">ELO</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
