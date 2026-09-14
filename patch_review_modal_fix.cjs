const fs = require('fs');
let code = fs.readFileSync('src/components/GameReviewModal.jsx', 'utf8');

code = code.replace(
  /export const GameReviewModal = \(\{ gameHistory, onClose, initialTheme \}\) => \{/,
  `export const GameReviewModal = ({ gameHistory, onClose, initialTheme, pieceStyle }) => {`
);

fs.writeFileSync('src/components/GameReviewModal.jsx', code);
