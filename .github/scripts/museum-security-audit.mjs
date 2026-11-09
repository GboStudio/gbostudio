/**
 * Read-only repository security guard. Flags known unsafe changes; not a CVE scanner.
 * Avoids third-party dependencies and makes no external requests.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8');
const files=execFileSync('git',['ls-files','empty-museum'],{encoding:'utf8'}).trim().split('\n')
  .filter(p=>/\.(?:js|mjs|html|json|sql|yml|yaml|py)$/.test(p));
let errors=0;
const check=(label,fn)=>{try{fn();console.log('PASS security: '+label)}catch(e){errors++;console.error('::error::Security '+label+': '+e.message)}};
const secrets=[
  ['GitHub classic PAT',/ghp_[A-Za-z0-9]{36,}/g],
  ['GitHub fine-grained PAT',/github_pat_[A-Za-z0-9_]{50,}/g],
  ['Supabase service key',/sb_secret_[A-Za-z0-9_-]{20,}/g],
  ['Stripe live key',/sk_live_[A-Za-z0-9]{20,}/g],
  ['AWS access key',/AKIA[0-9A-Z]{16}/g],
  ['Private key PEM',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]
];
check('no recognizable committed credentials in museum source',()=>{
  for(const path of files){
    const content=read(path);
    for(const [kind,pattern] of secrets){
      pattern.lastIndex=0;
      if(pattern.test(content))throw Error(kind+' appears in '+path+'. Revoke any exposed credential; do not print it in CI.');
    }
  }
});
check('disabled live commerce and disabled cloud authentication',()=>{
  assert.match(read('empty-museum/cloud-config.js'),/enabled:\s*false/);
  assert.match(read('empty-museum/commerce-model.mjs'),/SIMULATIONS/);
  assert.match(read('empty-museum/project-contract.json'),/"commercialState":\s*"demo-no-live-payments"/);
});
check('pinned Three.js CDN and no unpinned active imports',()=>{
  const entry=read('empty-museum/index.html');
  assert.match(entry,/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.186\.1\//);
  assert.doesNotMatch(entry,/(?:cdn\.jsdelivr\.net|unpkg\.com)\/[^"'\s<>]*@(?:latest|next|master)\b/i);
  assert.match(entry,/http-equiv="Content-Security-Policy"/);
  assert.doesNotMatch(entry,/\son[a-z]+\s*=/i);
});
check('images and 3D uploads must use preflight policy',()=>{
  assert.match(read('empty-museum/app.js'),/validateRasterFile\(f\)/);
  assert.match(read('empty-museum/floor.js'),/validateRasterFile\(f\)/);
  assert.match(read('empty-museum/models3d.js'),/inspectGLTF\(json\)/);
  assert.match(read('empty-museum/models3d.js'),/validateSTLFile\(file\)/);
});
console.log('Security guard: '+files.length+' source files checked; '+errors+' failures.');
if(errors)process.exitCode=1;
