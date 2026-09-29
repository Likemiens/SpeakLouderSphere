import { defineConfig } from 'vite';

// `npm run dev`   -> demo & configurator (index.html) with hot reload
// `npm run build` -> the embeddable widget in dist/ (ES module + classic <script> build)
export default defineConfig({
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2020',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'SpeakLouderSphere',
      formats: ['es', 'iife'],
      fileName: (format) =>
        format === 'es' ? 'speak-louder-sphere.js' : 'speak-louder-sphere.iife.js',
    },
  },
});
