import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.wav':'audio/wav','.png':'image/png'}
http.createServer((req,res)=>{try{const url=decodeURIComponent((req.url||'/').split('?')[0]);const relative=url==='/'?'preview/index.html':url.slice(1);if(!['preview/','assets/'].some(p=>relative.startsWith(p))){res.writeHead(404);res.end();return}const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('Mini RC preview: http://127.0.0.1:4173'))
