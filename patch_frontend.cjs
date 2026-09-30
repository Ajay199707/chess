const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// Overwrite the BACKEND_PROD_URL so that it strictly uses our new localhost server during dev/staging
code = code.replace(
  /const BACKEND_PROD_URL = "[^"]+";/,
  'const BACKEND_PROD_URL = "http://localhost:3001"; // TODO: Update to your own Render URL before going to prod'
);

// We can also ensure isDev is always true for now so it connects to localhost
code = code.replace(
  "const isDev = window.location.port && window.location.port !== '3001';",
  "const isDev = true; // Hardcoded to use local backend during dev"
);

fs.writeFileSync('src/App.jsx', code);
