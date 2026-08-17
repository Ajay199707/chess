import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Smile } from 'lucide-react';

const PRESETS = ["GLHF! 🎮", "Nice move! 🧠", "Oops! 😅", "Thanks! 👍", "GG! 🏆"];
const EMOJIS = ["👏", "😎", "🤔", "😮", "😢", "🔥"];

export const ChatPanel = ({ socket, roomCode, playerName, chatHistory = [], setChatHistory }) => {
  const [message, setMessage] = useState('');
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const sendMessage = (text, isReaction = false) => {
    if (!text.trim() || !socket || !roomCode) return;
    
    socket.emit('send_chat', { text, isReaction });
    if (!isReaction) {
      setMessage('');
    }
    setShowEmojiMenu(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage(message);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <MessageSquare size={18} className="text-gold" />
        <h3>Room Chat</h3>
      </div>

      <div className="chat-messages-container">
        {chatHistory.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Send a greeting!</p>
          </div>
        ) : (
          chatHistory.map((msg, index) => {
            const isSystem = msg.isSystem;
            let bubbleClass = "chat-bubble";
            if (isSystem) bubbleClass += " system";
            else if (msg.sender === playerName) bubbleClass += " self";
            else bubbleClass += " opponent";

            return (
              <div key={index} className={`chat-row ${isSystem ? 'system' : ''}`}>
                {!isSystem && (
                  <div className="chat-meta">
                    <span className="chat-sender">{msg.sender}</span>
                    {msg.color && (
                      <span className={`chat-tag ${msg.color}`}>
                        {msg.color.toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <div className={`${bubbleClass} ${msg.isReaction ? 'reaction' : ''}`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick reaction presets */}
      <div className="quick-reactions">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={() => sendMessage(emoji, true)}
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="presets-bar">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            className="preset-btn"
            onClick={() => sendMessage(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Input controls */}
      <div className="chat-input-row">
        <button
          className="emoji-toggle-btn"
          onClick={() => setShowEmojiMenu(!showEmojiMenu)}
          title="Toggle emoji list"
        >
          <Smile size={20} />
        </button>

        {showEmojiMenu && (
          <div className="emoji-dropdown">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="dropdown-emoji-item"
                onClick={() => sendMessage(emoji, true)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          maxLength={100}
        />
        
        <button 
          className="send-message-btn" 
          onClick={() => sendMessage(message)}
          disabled={!message.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
