const fs = require('fs');
let code = fs.readFileSync('src/components/Chessboard.jsx', 'utf8');

if (!code.includes("pieceStyle = 'staunton'")) {
    code = code.replace(
        /onPremove = null,[\r\n]+\}\) => \{/,
        "onPremove = null,\n  pieceStyle = 'staunton',\n}) => {"
    );
}
fs.writeFileSync('src/components/Chessboard.jsx', code);
