const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const mobileDir = path.join(rootDir, 'mobile-app');

console.log('Building standalone mobile HTML bundle...');

// Read index.html
let html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8');

// Read style.css
const css = fs.readFileSync(path.join(publicDir, 'css', 'style.css'), 'utf-8');

// Replace stylesheet link with inline <style>
html = html.replace(
  '<link rel="stylesheet" href="css/style.css">',
  `<style>\n${css}\n</style>`
);

// Inline all images from public/images as base64 data URIs for 100% offline standalone mobile app
const imagesDir = path.join(publicDir, 'images');
if (fs.existsSync(imagesDir)) {
  const imageFiles = fs.readdirSync(imagesDir);
  for (const file of imageFiles) {
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(imagesDir, file);
    let mime = 'image/jpeg';
    if (ext === '.svg') mime = 'image/svg+xml;charset=utf-8';
    else if (ext === '.png') mime = 'image/png';
    else if (ext === '.webp') mime = 'image/webp';
    
    const fileData = fs.readFileSync(filePath);
    const base64 = fileData.toString('base64');
    const dataUri = `data:${mime};base64,${base64}`;
    
    // Replace all occurrences of images/file
    const regex = new RegExp(`images/${file}`, 'g');
    html = html.replace(regex, dataUri);
    console.log(`Inlined images/${file} (${(base64.length / 1024).toFixed(1)} KB base64)`);
  }
}

// Offline socket mock to prevent crashes if offline
const socketMock = `
<script>
window.io = window.io || function() {
  var listeners = {};
  return {
    on: function(ev, cb) { listeners[ev] = listeners[ev] || []; listeners[ev].push(cb); },
    emit: function(ev, data) {},
    disconnect: function() {},
    connected: false
  };
};
</script>
`;

html = html.replace('<script src="/socket.io/socket.io.js"></script>', socketMock);

// Read JS files in order
const jsFiles = [
  'audio.js',
  'network.js',
  'games/chess.js',
  'games/uno.js',
  'games/chain-reaction.js',
  'games/mini-militia.js',
  'games/ludo.js',
  'games/slither.js',
  'games/bomberman.js',
  'games/carrom.js',
  'games/connect4.js',
  'lobby.js'
];

for (const jsFile of jsFiles) {
  const filePath = path.join(publicDir, 'js', jsFile);
  const jsContent = fs.readFileSync(filePath, 'utf-8');
  const tagToReplace = `<script src="js/${jsFile}"></script>`;
  html = html.replace(
    tagToReplace,
    `<script>\n/* --- ${jsFile} --- */\n${jsContent}\n</script>`
  );
}

// Write to mobile-app/standaloneBundle.js as exported string
const bundleContent = `// Auto-generated standalone offline bundle of Sudarshan Game Suite
// Contains full HTML + CSS + JS for all 9 games (Chess, Uno, Chain Reaction, Mini Militia, Ludo, Slither, Bomberman, Carrom, Connect 4)
export const STANDALONE_HTML = ${JSON.stringify(html)};
`;

fs.writeFileSync(path.join(mobileDir, 'standaloneBundle.js'), bundleContent, 'utf-8');

const constantsDir = path.join(mobileDir, 'src', 'constants');
if (!fs.existsSync(constantsDir)) {
  fs.mkdirSync(constantsDir, { recursive: true });
}
fs.writeFileSync(path.join(constantsDir, 'standaloneBundle.js'), bundleContent, 'utf-8');

console.log(`Bundle generated successfully! Size: ${(bundleContent.length / 1024).toFixed(1)} KB`);
