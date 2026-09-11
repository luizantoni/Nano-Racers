import {build} from 'esbuild'
await build({entryPoints:['preview/main.ts'],bundle:true,format:'esm',outfile:'preview/app.js',sourcemap:true,target:'es2020'})
console.log('Preview built.')
