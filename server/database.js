import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'db.json');

// Initialize database file if missing
function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to load JSON database, defaulting to empty:", err);
    return { users: {} };
  }
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write to JSON database:", err);
  }
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function registerUser(name, email, password) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();

  if (db.users[normalizedEmail]) {
    return { success: false, message: "Email is already registered" };
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const token = generateToken();

  db.users[normalizedEmail] = {
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    salt,
    tokens: [token],
    stats: {
      gamesPlayed: 0,
      onlineMatchesPlayed: 0,
      elo: 1200
    }
  };

  saveDb(db);

  return {
    success: true,
    token,
    name: db.users[normalizedEmail].name,
    email: normalizedEmail,
    stats: db.users[normalizedEmail].stats
  };
}

export function loginUser(email, password) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users[normalizedEmail];

  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return { success: false, message: "Invalid email or password" };
  }

  const token = generateToken();
  user.tokens.push(token);

  // Keep max 5 active session tokens to prevent infinite token accumulation
  if (user.tokens.length > 5) {
    user.tokens.shift();
  }

  saveDb(db);

  return {
    success: true,
    token,
    name: user.name,
    email: normalizedEmail,
    stats: user.stats
  };
}

export function verifySession(email, token) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users[normalizedEmail];

  if (!user) {
    // The server was likely restarted (ephemeral Render container wiped db.json).
    // Seamlessly recreate the user account so they aren't forced to re-register.
    const salt = generateSalt();
    const passwordHash = hashPassword(token, salt); // Just mock it
    db.users[normalizedEmail] = {
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0], // Best guess for name
      passwordHash,
      salt,
      tokens: [token],
      stats: { gamesPlayed: 0, onlineMatchesPlayed: 0, elo: 1200, onlineWins: 0, onlineLosses: 0, onlineDraws: 0 }
    };
    saveDb(db);
    return {
      success: true,
      name: db.users[normalizedEmail].name,
      email: normalizedEmail,
      stats: db.users[normalizedEmail].stats
    };
  }

  if (!user.tokens.includes(token)) {
    return { success: false };
  }

  return {
    success: true,
    name: user.name,
    email: normalizedEmail,
    stats: user.stats
  };
}

export function logoutUser(email, token) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users[normalizedEmail];

  if (user) {
    user.tokens = user.tokens.filter(t => t !== token);
    saveDb(db);
  }
  return { success: true };
}

export function recordMatchComplete(email, opponentEmail, outcome) {
  const db = loadDb();
  const user = db.users[email.toLowerCase()];
  if (!user) return;

  user.stats.gamesPlayed++;
  user.stats.onlineMatchesPlayed++;

  // Simple ELO formula: baseline change is 15 points
  const K = 32;
  const opponent = db.users[opponentEmail.toLowerCase()];
  const opponentElo = opponent ? opponent.stats.elo : 1200;

  // Expected score
  const expected = 1 / (1 + Math.pow(10, (opponentElo - user.stats.elo) / 400));
  let actual = 0.5; // Draw
  if (outcome === 'win') actual = 1;
  else if (outcome === 'loss') actual = 0;

  const change = Math.round(K * (actual - expected));
  user.stats.elo = Math.max(100, user.stats.elo + change);

  saveDb(db);
  return { newElo: user.stats.elo, eloChange: change };
}

export function saveFeedback(name, email, type, rating, message) {
  const db = loadDb();
  if (!db.feedbacks) {
    db.feedbacks = [];
  }
  const feedbackId = 'fb_' + crypto.randomBytes(4).toString('hex');
  const entry = {
    feedbackId,
    name: name ? name.trim() : 'Guest',
    email: email ? email.toLowerCase().trim() : 'Anonymous',
    type,
    rating: parseInt(rating) || 5,
    message: message ? message.trim().substring(0, 500) : '',
    timestamp: Date.now()
  };
  db.feedbacks.push(entry);
  saveDb(db);
  return { success: true, feedbackId };
}
