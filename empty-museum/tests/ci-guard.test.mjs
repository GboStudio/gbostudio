import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text=path=>readFileSync(path,'utf8');
test('public site health follows Pages deployment, not a racing main push',()=>{
  const cfg=text('.github/workflows/tem-smoke.yml');
  assert.match(cfg,/workflow_run:\s*\n\s+workflows:\s*\["pages build and deployment"\]/);
  assert.match(cfg,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(cfg,/schedule:\s*\n\s+- cron:/);
  assert.doesNotMatch(cfg,/^\s+push:/m);
  assert.match(cfg,/node \.github\/scripts\/tem-e2e\.mjs/);
});
test('museum engine validates before PR merge and does not duplicate feature pushes',()=>{
  const cfg=text('.github/workflows/museum-3d-checks.yml');
  assert.match(cfg,/pull_request:/);
  assert.match(cfg,/push:\s*\n\s+branches: \[main\]/);
  assert.match(cfg,/validate_bake\.py --asset-dir empty-museum\/assets/);
  assert.match(cfg,/tem-e2e\.mjs/);
});
test('Blender build is manual, read-only and cannot generate PR commit emails',()=>{
  const cfg=text('.github/workflows/museum-v4-bake.yml');
  assert.match(cfg,/workflow_dispatch:/);
  assert.match(cfg,/contents: read/);
  assert.doesNotMatch(cfg,/git push|git commit|contents: write/);
  assert.doesNotMatch(cfg,/^\s+push:/m);
  assert.match(cfg,/actions\/upload-artifact/);
});
test('manual camera and joystick actions take precedence over old movement',()=>{
  const engine=text('empty-museum/engine3d.js'),nav=text('empty-museum/museum-v5.js');
  assert.match(engine,/if\(turning\|\|fwd\|\|strafe\)\s*\{\s*\/\/ Manual input wins/);
  assert.match(engine,/v5\.takeControl\(\)/);
  assert.match(engine,/v5\.releaseInputs\(\)/);
  assert.match(nav,/function takeControl\(\)/);
  assert.match(nav,/function releaseInputs\(\)/);
  assert.match(text('.github/scripts/tem-e2e.mjs'),/PASS MOBILE JOYSTICK LIVE DIRECTION CHANGE/);
});
