// Source-of-truth smoke guard: verifies critical coherence without altering site code.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {WALL_FORMATS,AISLE_DURATIONS,DISTANCE_LEVELS,DEFAULT_COMMERCE_CONFIG} from '../../empty-museum/commerce-model.mjs';
const read=path=>readFileSync(path,'utf8');
const config=JSON.parse(read('empty-museum/project-contract.json'));
const entry=read('empty-museum/index.html');
const loader=read('empty-museum/engine-loader.js');
const e2e=read('.github/scripts/tem-commerce-e2e.mjs');
const tests=[
  ['Single canonical museum project',()=>assert.equal(config.project,'THE UNREAL MUSEUM')],
  ['Single main branch',()=>assert.equal(config.branch,'main')],
  ['Canonical immersive route',()=>assert.equal(config.visitQuery,'visit=immersive')],
  ['Public identity on main entry',()=>assert.match(entry,/THE UNREAL MUSEUM/i)],
  ['Entry leads to immersive museum',()=>assert.ok(entry.includes('?visit=immersive'))],
  ['Museum explicitly labelled as demonstration',()=>assert.ok(entry.includes('VERSION DÉMONSTRATION'))],
  ['Active WebGL renderer loaded',()=>assert.ok(loader.includes('engine3d.js?'))],
  ['Fallback renderer preserved',()=>assert.ok(loader.includes('walk.js?'))],
  ['3m wall modules',()=>assert.equal(DEFAULT_COMMERCE_CONFIG.wall.moduleLengthM,config.wallModuleLengthM)],
  ['1/2/4/8/16 wall subdivision',()=>assert.deepEqual(WALL_FORMATS.map(f=>f.count),config.wallSizes)],
  ['Daily/weekly/monthly aisle placements',()=>assert.deepEqual(AISLE_DURATIONS.map(x=>x.days),config.aisleDurationsDays)],
  ['Visibility distance levels',()=>assert.deepEqual(DISTANCE_LEVELS.map(x=>x.meters),config.aisleDistanceMetres)],
  ['Both monthly and annual wall prices',()=>assert.ok(config.wallBilling.every(term=>WALL_FORMATS.every(f=>Number.isFinite(DEFAULT_COMMERCE_CONFIG.wall.pricing[f.id][term]))))],
  ['Unique configurator duration selector',()=>assert.ok(e2e.includes('button[data-days="1"]')&&!e2e.includes("locator('[data-days=\"1\"]')"))],
  ['Decision register available',()=>assert.ok(existsSync('empty-museum/PROJECT_STATE.md'))],
  ['Agent instructions available',()=>assert.ok(existsSync('AGENTS.md'))]
];
let fail=0;
for(const [label,fn] of tests){try{fn();console.log('PASS '+label)}catch(error){fail++;console.error('::error::FAIL '+label+': '+error.message)}}
console.log('Museum coherence: '+tests.length+' checks, '+fail+' errors. Known design and cross-PR differences are tracked in PROJECT_STATE.md.');
if(fail)process.exitCode=1;
