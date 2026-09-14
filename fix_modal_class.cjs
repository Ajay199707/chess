const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(/className="modal-overlay"/g, 'className="modal-backdrop"');

fs.writeFileSync('src/App.jsx', code);
