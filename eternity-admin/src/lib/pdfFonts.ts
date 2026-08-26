import { Font } from '@react-pdf/renderer';
import bodoniRegular from '../assets/fonts/BodoniModa-Regular.woff';
import bodoniMedium from '../assets/fonts/BodoniModa-Medium.woff';
import bodoniItalic from '../assets/fonts/BodoniModa-Italic.woff';
import chivoMono from '../assets/fonts/ChivoMono-Regular.woff';

let registered = false;

/** Registers the brand fonts with @react-pdf/renderer. Idempotent — call from anywhere before rendering a PDF. */
export function registerPdfFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: 'Bodoni Moda',
    fonts: [
      { src: bodoniRegular, fontWeight: 400 },
      { src: bodoniMedium, fontWeight: 500 },
      { src: bodoniItalic, fontStyle: 'italic', fontWeight: 400 },
    ],
  });
  Font.register({
    family: 'Chivo Mono',
    fonts: [{ src: chivoMono, fontWeight: 400 }],
  });
}
