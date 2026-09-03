import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export function OfficeModePiP({ children, onClose }) {
  const [pipWindow, setPipWindow] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let activePipWindow = null;

    async function openPiP() {
      if (!('documentPictureInPicture' in window)) {
        alert("Your browser does not support the Office Mode (Document Picture-in-Picture) feature. Please use a recent version of Chrome or Edge.");
        onClose();
        return;
      }

      try {
        // Request a small, square-ish window suitable for a chessboard
        activePipWindow = await window.documentPictureInPicture.requestWindow({
          width: 450,
          height: 600,
        });

        // Copy all CSS styles and links from the main document head to the PiP window head
        const styles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'));
        styles.forEach(style => {
          activePipWindow.document.head.appendChild(style.cloneNode(true));
        });

        // Add a class to body for any PiP-specific CSS rules (like hiding scrollbars)
        activePipWindow.document.body.classList.add('in-pip-mode');
        activePipWindow.document.body.style.margin = '0';
        activePipWindow.document.body.style.padding = '0';
        activePipWindow.document.body.style.background = 'var(--bg-app)';
        activePipWindow.document.body.style.display = 'flex';
        activePipWindow.document.body.style.flexDirection = 'column';
        activePipWindow.document.body.style.height = '100vh';

        // When the user closes the PiP window, notify parent
        activePipWindow.addEventListener("pagehide", () => {
          onClose();
        });

        setPipWindow(activePipWindow);
      } catch (error) {
        console.error("Failed to open Office Mode PiP", error);
        onClose();
      }
    }

    openPiP();

    // Global Boss Key (Esc) on the main window to close the PiP
    const handleMainKeyDown = (e) => {
      if (e.key === 'Escape' && activePipWindow) {
        activePipWindow.close();
      }
    };
    
    // Global Boss Key (Esc) inside the PiP window itself
    const handlePipKeyDown = (e) => {
      if (e.key === 'Escape' && activePipWindow) {
        activePipWindow.close();
      }
    };

    window.addEventListener('keydown', handleMainKeyDown);

    return () => {
      window.removeEventListener('keydown', handleMainKeyDown);
      if (activePipWindow) {
        activePipWindow.removeEventListener('keydown', handlePipKeyDown);
        activePipWindow.close();
      }
    };
  }, []);

  // Attach keydown listener to the PiP window once it's created
  useEffect(() => {
    if (pipWindow) {
      const handlePipKeyDown = (e) => {
        if (e.key === 'Escape') {
          pipWindow.close();
        }
      };
      pipWindow.addEventListener('keydown', handlePipKeyDown);
      return () => pipWindow.removeEventListener('keydown', handlePipKeyDown);
    }
  }, [pipWindow]);

  if (!pipWindow) return null;

  return createPortal(
    <div 
      ref={containerRef} 
      className="pip-content-wrapper" 
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {children}
    </div>,
    pipWindow.document.body
  );
}
