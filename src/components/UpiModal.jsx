import React from 'react';
import { X, Heart, Copy, IndianRupee } from 'lucide-react';

export function UpiModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="challenge-request-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div className="challenge-card animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem', position: 'relative' }}>
        <button className="icon-only-btn" style={{ position: 'absolute', top: '10px', right: '10px' }} onClick={onClose}>
          <X size={20} />
        </button>
        
        <h2 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Heart size={24} color="#d946ef" fill="#d946ef" />
          Support the Developer
        </h2>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Your support helps keep Apex Chess running! Use any UPI app (GPay, PhonePe, Paytm) to scan and pay with zero fees.
        </p>
        
        <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi%3A%2F%2Fpay%3Fpa%3D9514504711%40ptaxis%26pn%3DAjay%2520Viknesh%26cu%3DINR" 
            alt="UPI QR Code" 
            style={{ width: '200px', height: '200px', display: 'block' }}
          />
        </div>
        
        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>UPI ID</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <strong style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>9514504711@ptaxis</strong>
            <button 
              onClick={() => {
                navigator.clipboard.writeText('9514504711@ptaxis');
                alert('UPI ID copied to clipboard!');
              }}
              className="icon-only-btn" 
              title="Copy UPI ID"
              style={{ background: 'var(--color-emerald)', color: '#fff', padding: '0.5rem' }}
            >
              <Copy size={16} />
            </button>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Name: <strong>Ajay Viknesh</strong></div>
        </div>

        <a 
          href="upi://pay?pa=9514504711@ptaxis&pn=Ajay%20Viknesh&cu=INR"
          className="btn-primary full-width"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.875rem' }}
        >
          <IndianRupee size={18} />
          Open UPI App to Pay
        </a>
      </div>
    </div>
  );
}
