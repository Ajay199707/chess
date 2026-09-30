const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const safeRemoveItemFunc = `const safeRemoveItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('localStorage error:', e);
  }
};
`;

// Insert it right after safeSetItem
code = code.replace(
  /const safeSetItem = [\s\S]*?};\n/,
  match => match + '\n' + safeRemoveItemFunc
);

fs.writeFileSync('src/App.jsx', code);
