import { Font } from '@react-pdf/renderer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(__dirname, '..', '..', 'assets', 'fonts');

let registered = false;
export function registerFonts() {
  if (registered) return;
  Font.register({
    family: 'Nohemi',
    fonts: [
      { src: join(fontsDir, 'Nohemi-Regular.ttf') },
      { src: join(fontsDir, 'Nohemi-Black.ttf'), fontWeight: 900 },
    ],
  });
  Font.register({
    family: 'Satoshi',
    fonts: [
      { src: join(fontsDir, 'Satoshi-Light.ttf'), fontWeight: 300 },
      { src: join(fontsDir, 'Satoshi-Regular.ttf'), fontWeight: 400 },
      { src: join(fontsDir, 'Satoshi-Medium.ttf'), fontWeight: 500 },
      { src: join(fontsDir, 'Satoshi-Bold.ttf'), fontWeight: 700 },
      { src: join(fontsDir, 'Satoshi-Black.ttf'), fontWeight: 900 },
    ],
  });
  Font.register({
    family: 'MangoGrotesque',
    fonts: [
      { src: join(fontsDir, 'MangoGrotesque-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
    ],
  });
  Font.register({
    family: 'GreatVibes',
    fonts: [
      { src: join(fontsDir, 'GreatVibes-Regular.ttf') },
    ],
  });
  Font.registerHyphenationCallback(word => [word]);
  registered = true;
}
