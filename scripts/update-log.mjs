import fs from 'node:fs'
const rows=[]
for(const dir of fs.readdirSync('design',{withFileTypes:true}).filter(d=>d.isDirectory()&&/^\d\d-/.test(d.name))){for(const file of fs.readdirSync(`design/${dir.name}`)){const match=file.match(/^(H\d-\d+)-.*_(\w+)\.md$/);if(!match)continue;const content=fs.readFileSync(`design/${dir.name}/${file}`,'utf8');const field=n=>content.match(new RegExp(`\\*\\*${n}:\\*\\* (.*)`))?.[1]||'—';rows.push(`| ${match[1]} | ${match[2]} | ${field('Cheapest killing test')} | ${field('Tested on')} | [Experiment](${dir.name}/${file}) |`)}}
fs.writeFileSync('design/hypothesis-log.md',`# Hypothesis Log\n\nGenerated from experiment files.\n\n| ID | Status | Cheapest test | Tested on | File |\n|---|---|---|---|---|\n${rows.join('\n')}\n`)
