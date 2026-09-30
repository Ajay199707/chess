const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
if (!pkg.scripts) pkg.scripts = {};
pkg.scripts.build = "echo 'No build required'";
fs.writeFileSync('server/package.json', JSON.stringify(pkg, null, 2));
