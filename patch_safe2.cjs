const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const target = `const safeSetItem = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.warn(\`Failed to write \${key} to localStorage:\`, e);
  }
};`;

const safeRemoveItemFunc = `\nconst safeRemoveItem = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {
    console.warn(\`Failed to remove \${key} from localStorage:\`, e);
  }
};`;

code = code.replace(target, target + safeRemoveItemFunc);

fs.writeFileSync('src/App.jsx', code);
