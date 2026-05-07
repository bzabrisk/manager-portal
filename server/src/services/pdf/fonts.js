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
      { src: join(fontsDir, 'Body: Nohemi-Regular.ttf') },
      { src: join(fontsDir, 'Headlines: Nohemi-Black.ttf'), fontWeight: 900 },
    ],
  });
  Font.register({
    family: 'MangoGrotesque',
    fonts: [
      { src: join(fontsDir, 'Alt Headlines: MangoGrotesque-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
    ],
  });
  registered = true;
}
