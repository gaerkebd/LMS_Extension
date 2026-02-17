/**
 * Icon Generator Script
 * Run this to create PNG icons from the SVG files
 *
 * Prerequisites: Install sharp
 *   npm install sharp --save-dev
 *
 * Usage:
 *   node scripts/create-icons.js
 */

const fs = require('fs');
const path = require('path');

// Try to use sharp if available
async function createIcons() {
  try {
    const sharp = require('sharp');

    const sizes = [16, 48, 128];
    const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

    for (const size of sizes) {
      const svgPath = path.join(iconsDir, `icon${size}.svg`);
      const pngPath = path.join(iconsDir, `icon${size}.png`);

      if (fs.existsSync(svgPath)) {
        await sharp(svgPath)
          .resize(size, size)
          .png()
          .toFile(pngPath);
        console.log(`Created: icon${size}.png`);
      } else {
        console.log(`SVG not found: ${svgPath}`);
        // Create a simple colored square as fallback
        await createFallbackIcon(sharp, pngPath, size);
      }
    }

    console.log('\\nIcons created successfully!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('Sharp not installed. Creating placeholder icons...');
      console.log('For proper icons, run: npm install sharp --save-dev');
      console.log('Then run this script again.\\n');

      // Create minimal placeholder using pure Node.js
      createPlaceholderIcons();
    } else {
      console.error('Error creating icons:', error);
    }
  }
}

async function createFallbackIcon(sharp, outputPath, size) {
  // Create a simple red square icon
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#e63946"/>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
  console.log(`Created fallback: ${path.basename(outputPath)}`);
}

function createPlaceholderIcons() {
  // This creates a simple message about manual icon creation
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
  const readmePath = path.join(iconsDir, 'ICONS_README.txt');

  const content = `Icon Creation Instructions
==========================

The extension requires PNG icons at these sizes:
- icon16.png  (16x16 pixels)
- icon48.png  (48x48 pixels)
- icon128.png (128x128 pixels)

Option 1: Use an online converter
---------------------------------
1. Open each SVG file in a browser
2. Use a tool like https://svgtopng.com/
3. Convert to the required size

Option 2: Install sharp and run the script
------------------------------------------
1. Run: npm install sharp --save-dev
2. Run: node scripts/create-icons.js

Option 3: Create your own icons
-------------------------------
Design your own icons and save them as PNG files
in this directory with the correct names and sizes.

Temporary workaround:
--------------------
You can test the extension without icons, but Chrome
will show a default puzzle piece icon instead.
`;

  fs.writeFileSync(readmePath, content);
  console.log('Created: assets/icons/ICONS_README.txt');
  console.log('Please follow the instructions in that file to create icons.');
}

createIcons();
