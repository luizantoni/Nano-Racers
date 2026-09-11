import {build} from 'esbuild'
await build({entryPoints:['scripts/tests.ts'],bundle:true,format:'esm',platform:'node',outfile:'scripts/.tests.mjs'})
await import('./.tests.mjs')
