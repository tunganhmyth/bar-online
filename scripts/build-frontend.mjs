import { build } from 'esbuild';
await build({
  entryPoints: ['frontend/club-scene.js'],
  outfile: 'src/main/resources/static/js/club-scene.js',
  bundle: true,
  minify: true,
  target: ['es2022'],
  format: 'iife',
  legalComments: 'eof',
  logLevel: 'info'
});
