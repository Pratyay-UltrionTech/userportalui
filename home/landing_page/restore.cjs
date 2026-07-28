const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'coonara_final.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract ALL data:image/svg+xml;base64 src values
const re = /src="(data:image\/svg\+xml;base64,[^"]+)"/g;
const keys = [
  'hero', 'ext_wash', 'int_vac', 'win_clean',
  'steam_clean', 'prem_polish', 'tyre_shine',
  'detailing', 'cafe', 'woolies', 'shops', 'relax'
];

const urls = [];
let m;
while ((m = re.exec(html)) !== null) {
  urls.push(m[1]);
}

console.log('Found ' + urls.length + ' SVG images in HTML (need ' + keys.length + ')');

let out = 'export const IMAGES = {\n';
keys.forEach((k, i) => {
  if (i < urls.length) {
    out += '  ' + k + ': "' + urls[i] + '",\n';
  }
});
out += '};\n';

const dest = path.join(__dirname, 'src', 'assets', 'images.js');
fs.writeFileSync(dest, out, 'utf8');
console.log('Restored images.js with ' + urls.length + ' base64 SVGs');
console.log('Done!');
