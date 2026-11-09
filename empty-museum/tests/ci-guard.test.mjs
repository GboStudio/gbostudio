import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text=path=>readFileSync(path,'utf8');
test('public smoke waits for exact successful Pages revision on push',()=>{
  const cfg=text('.github/workflows/tem-smoke.yml');
  assert.match(cfg,/push:\s*\n\s+branches: \[main\]/);
  assert.match(cfg,/wait-pages-deployment\.py/);
  assert.ok(cfg.includes('--sha "${GITHUB_SHA}"'),'CI must wait for the exact pushed SHA');
  assert.match(cfg,/actions: read/);
  assert.match(cfg,/github\.event_name == 'push'/);
  assert.match(cfg,/schedule:\s*\n\s+- cron:/);
  assert.doesNotMatch(cfg,/^\s+workflow_run:/m);
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
  assert.match(engine,/if\(turning\|\|fwd\|\|strafe\|\|input\.lookX\|\|input\.lookY\)\s*\{\s*\/\/ Manual input wins/);
  assert.match(engine,/v5\.takeControl\(\)/);
  assert.match(engine,/v5\.releaseInputs\(\)/);
  assert.match(nav,/function takeControl\(\)/);
  assert.match(nav,/function releaseInputs\(\)/);
  assert.match(text('.github/scripts/tem-e2e.mjs'),/PASS MOBILE JOYSTICK LIVE DIRECTION CHANGE/);
  const e2e=text('.github/scripts/tem-e2e.mjs');
  assert.match(e2e,/page\.mouse\.click\(x,y\)/);
  assert.doesNotMatch(e2e,/locator\('#museumTour'\)\.click\(/);
});
