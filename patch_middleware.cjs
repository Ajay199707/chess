const fs = require('fs');
let code = fs.readFileSync('server/server.js', 'utf8');

code = code.replace(
  "const publicEvents = ['register', 'login', 'verify_session', 'disconnect'];",
  "const publicEvents = ['register', 'login', 'google_login', 'verify_session', 'disconnect'];"
);

fs.writeFileSync('server/server.js', code);
