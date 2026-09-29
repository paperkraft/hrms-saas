const fs = require('fs');
const path = require('path');

const versionData = {
  version: Date.now().toString(),
  timestamp: new Date().toISOString()
};

const dir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(
  path.join(dir, 'version.json'),
  JSON.stringify(versionData, null, 2)
);

console.log('✅ Generated version.json with build ID:', versionData.version);
