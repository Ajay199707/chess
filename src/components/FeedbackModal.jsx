import React, { useState } from 'react';
import { Star, MessageSquarePlus, X } from 'lucide-react';

export function FeedbackModal({ isOpen, onClose, onSubmit }) {
  const [feedbackType, setFeedbackType] = useState('review'); // 'review' | 'bug' | 'feature'
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    onSubmit({
      type: feedbackType,
      rating,
      message
    });

    // Reset fields on submit
    setTimeout(() => {
      setMessage('');
      setRating(5);
      setFeedbackType('review');
      setIsSubmitting(false);
      onClose();
    }, 300);
  };

  return (
    <div className="challenge-request-overlay feedback-modal-overlay">
      <div className="challenge-card feedback-card animate-scale-in">
        <button className="feedback-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="challenge-header feedback-header">
          <span className="challenge-icon feedback-title-icon"><MessageSquarePlus size={24} /></span>
          <h4>Share Your Thoughts</h4>
          <p className="login-subtitle">Your reviews help us refine our strategic mind!</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form feedback-form">
          {/* Feedback Type Segmented Selector */}
          <div className="input-group">
            <label>Feedback Type</label>
            <div className="btn-segmented feedback-type-selector">
              {[
                { val: 'review', label: '⭐ Review' },
                { val: 'bug', label: '🪲 Bug Report' },
                { val: 'feature', label: '💡 Feature Request' }
              ].map((t) => (
                <button
                  type="button"
                  key={t.val}
                  className={feedbackType === t.val ? 'active' : ''}
                  onClick={() => setFeedbackType(t.val)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="input-group">
            <label>Rating</label>
            <div className="star-rating-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`star-btn ${rating >= star ? 'active' : ''}`}
                >
                  <Star size={26} fill={rating >= star ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>

          {/* Feedback message textarea */}
          <div className="input-group">
            <label htmlFor="feedback-message">Message ({500 - message.length} chars left)</label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.substring(0, 500))}
              placeholder={
                feedbackType === 'bug'
                  ? 'Describe the bug and how to reproduce it...'
                  : feedbackType === 'feature'
                  ? 'What features would you love to see in Apex Chess?'
                  : 'Let us know your experience, strategic ideas, or general reviews!'
              }
              rows={4}
              required
              maxLength={500}
              className="feedback-textarea"
            />
          </div>

          {/* Action buttons */}
          <div className="challenge-actions feedback-actions">
            <button
              type="button"
              className="btn-danger"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? 'Sending...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
