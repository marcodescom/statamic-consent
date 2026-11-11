// Builds dist/consent.js (IIFE, minified) and dist/consent.css from resources/.
// Run "npm run build" and commit dist/: sites use the prebuilt files.
import { build } from 'esbuild'

const banner = '/*! statamic-consent | consent banner, Google Consent Mode v2, consent gates */'

await build({
    entryPoints: ['resources/js/index.js'],
    outfile: 'dist/consent.js',
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2019'],
    banner: { js: banner },
    legalComments: 'none',
})

await build({
    entryPoints: ['resources/css/consent.css'],
    outfile: 'dist/consent.css',
    bundle: true,
    minify: true,
    banner: { css: banner },
    legalComments: 'none',
})

console.log('dist/consent.js and dist/consent.css built')
