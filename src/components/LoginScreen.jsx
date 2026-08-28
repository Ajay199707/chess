import React, { useState, useEffect } from 'react';
import { Shield, Key, Mail, User, ArrowLeftRight } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export function LoginScreen({ socket, onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleAuthResponse = (res) => {
      setLoading(false);
      if (res.success) {
        onAuthSuccess(
          { name: res.name, email: res.email, stats: res.stats },
          res.token
        );
      } else {
        setError(res.message || "Authentication failed.");
      }
    };

    socket.on('auth_response', handleAuthResponse);
    return () => {
      socket.off('auth_response', handleAuthResponse);
    };
  }, [socket, onAuthSuccess]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!socket) return;
    setError('');

    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (isRegister && !name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    if (isRegister) {
      socket.emit('register', { name, email, password });
    } else {
      socket.emit('login', { email, password });
    }
  };

  return (
    <div className="login-overlay-container">
      <div className="login-card animate-fade-in">
        <div className="login-card-header">
          <div className="login-logo-circle">
            👑
          </div>
          <h3>Let's Build Our Strategic Mind</h3>
          <p className="login-subtitle">
            {isRegister ? "Create a free account to track your ratings & ELO" : "Sign in to join the online multiplayer lobby"}
          </p>
        </div>

        {error && (
          <div className="login-error-alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="input-group">
              <label htmlFor="name-input">Full Name</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  id="name-input"
                  type="text"
                  placeholder="e.g., Grandmaster Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label htmlFor="email-input">Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                id="email-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password-input">Password</label>
            <div className="input-with-icon">
              <Key size={16} className="input-icon" />
              <input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary login-submit-btn" disabled={loading}>
            {loading ? "Authenticating..." : isRegister ? "Sign Up & Play" : "Log In"}
          </button>
        </form>

        <div className="google-login-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (socket) {
                setLoading(true);
                // Hardcode empty clientId since we handle verification securely via audience checks,
                // but we need to pass clientId to backend if we want backend to verify properly.
                // However, our backend doesn't strictly need it if we pass it dynamically, but we'll use a placeholder
                socket.emit('google_login', { 
                  credential: credentialResponse.credential, 
                  clientId: "757539697967-e199pg2lct0us4j403ebmtqm3spaepva.apps.googleusercontent.com" 
                });
              }
            }}
            onError={() => {
              setError("Google Login Failed");
            }}
            theme="filled_black"
            text={isRegister ? "signup_with" : "signin_with"}
            shape="pill"
          />
        </div>

        <div className="login-card-footer">
          <span>
            {isRegister ? "Already have an account?" : "New to the chess lobby?"}
          </span>
          <button 
            type="button" 
            className="btn-text-gold toggle-auth-mode-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            disabled={loading}
          >
            {isRegister ? "Log In Instead" : "Register Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
