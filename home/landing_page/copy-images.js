const fs = require('fs');
const path = require('path');

const brain = 'C:\\Users\\krish\\.gemini\\antigravity\\brain\\788e0302-fff2-42fd-85c4-58c46705b6e1';
const pub = path.join(__dirname, 'public', 'images');

// Create directories
['services', 'hero', 'neighbourhood', 'why'].forEach(d => {
  fs.mkdirSync(path.join(pub, d), { recursive: true });
});

const copies = [
  ['hero_car_wash_1777440774128.png',    'hero/car-wash-hero.jpg'],
  ['exterior_wash_1777440800424.png',    'services/exterior.jpg'],
  ['interior_vacuum_1777440825507.png',  'services/interior.jpg'],
  ['window_cleaning_1777440840755.png',  'services/window.jpg'],
  ['steam_cleaning_1777440858380.png',   'services/steam.jpg'],
  ['premium_polish_1777440885902.png',   'services/polish.jpg'],
  ['tyre_shining_1777440902419.png',     'services/tyre.jpg'],
  ['why_us_detailing_1777440918955.png', 'why/detailing.jpg'],
  ['cafe_local_1777440933609.png',       'neighbourhood/cafe.jpg'],
  ['woolworths_store_1777440962434.png', 'neighbourhood/woolies.jpg'],
  ['local_shops_1777440978222.png',      'neighbourhood/shops.jpg'],
  ['relax_outdoor_1777440994848.png',    'neighbourhood/relax.jpg'],
];

copies.forEach(([src, dest]) => {
  const srcPath = path.join(brain, src);
  const destPath = path.join(pub, dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log('Copied:', dest);
  } else {
    console.warn('Missing:', src);
  }
});

console.log('All done!');
