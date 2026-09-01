import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe } from 'lucide-react';

export const GlobalChatPanel = ({ socket, playerName, globalMessages = [] }) => {
  const [message, setMessage] = useState('');
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages]);

  const sendMessage = () => {
    if (!message.trim() || !socket || !playerName) return;
    
    socket.emit('send_global_chat', { text: message.trim() });
    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };
  return (
    <div className="chat-panel global-chat-panel" style={{ flex: 1, height: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <div className="chat-header">
        <Globe size={18} className="text-gold" />
        <h3>Global Lobby Chat</h3>
      </div>

      <div className="chat-messages-container">
        {globalMessages.length === 0 ? (
          <div className="chat-empty">
            <p>Welcome to the lobby! Say hello!</p>
          </div>
        ) : (
          globalMessages.map((msg, index) => {
            const isSystem = msg.isSystem;
            let bubbleClass = "chat-bubble";
            if (isSystem) bubbleClass += " system";
            else if (msg.sender === playerName) bubbleClass += " self";
            else bubbleClass += " opponent";

            return (
              <div key={index} className={bubbleClass}>
                {!isSystem && (
                  <span className="chat-sender">
                    {msg.sender}
                    <span className="chat-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                )}
                <span className="chat-text">{msg.text}</span>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          maxLength={150}
        />
        <button className="send-message-btn" onClick={sendMessage} disabled={!message.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
