const fs = require('fs');
let code = fs.readFileSync('server/server.js', 'utf8');

const googleLoginLogic = `
  socket.on('google_login', ({ credential }) => {
    try {
      // Decode the Google JWT to extract user profile
      const decoded = jwt.decode(credential);
      if (!decoded || !decoded.email) {
        return socket.emit('auth_response', { success: false, message: 'Invalid Google token' });
      }
      
      const email = decoded.email;
      const name = decoded.name || 'Google User';
      
      // Auto-register or login
      let user = users.get(email);
      if (!user) {
        user = { email, name, passwordHash: 'GOOGLE_AUTH', elo: 1200 };
        users.set(email, user);
      }
      
      socket.user = user; // Attach identity
      const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
      
      socket.emit('auth_response', { 
        success: true, 
        name: user.name, 
        email: user.email, 
        stats: { elo: user.elo }, 
        token 
      });
    } catch (e) {
      socket.emit('auth_response', { success: false, message: 'Google login error' });
    }
  });
`;

// Insert the new logic right below the login handler
code = code.replace(
  /socket\.emit\('auth_response', \{ \n      success: true, \n      name: user\.name, email: user\.email, stats: \{ elo: user\.elo \}, \n      token \n    \}\);\n  \}\);/,
  match => match + '\n' + googleLoginLogic
);

fs.writeFileSync('server/server.js', code);
