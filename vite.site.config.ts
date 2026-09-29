import { cpSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// `npm run build:site` -> a static site for hosting (Vercel): the demo page,
// the examples and the ready-to-embed widget files under /dist.
const copyWidgetAndExamples = (): Plugin => ({
  name: 'copy-widget-and-examples',
  apply: 'build',
  closeBundle() {
    cpSync('dist', 'site/dist', { recursive: true });
    cpSync('examples', 'site/examples', { recursive: true });
  },
});

export default defineConfig({
  build: { outDir: 'site', emptyOutDir: true, target: 'es2020' },
  plugins: [copyWidgetAndExamples()],
});
