import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROOM, buildLayout, findArchitectureConflicts} from './room-layout.mjs';

const layout = buildLayout();

test('the sample room is one open marble gallery with no back wall', () => {
  assert.equal(ROOM.width, 7.2);
  assert.equal(ROOM.openSky, true);
  assert.equal(ROOM.wallColor, '#E4E0DA');
  assert.ok(ROOM.hallLength > 10 && ROOM.hallLength < ROOM.length);
  assert.equal(ROOM.daylightK, 5600);
  assert.equal(ROOM.pictureK, 3000);
  assert.equal(layout.frames.some(frame => frame.wall === 'north' || frame.wall === 'endLeft' || frame.wall === 'endRight'), false);
});

test('large frames are in front and smaller frames recede on both walls', () => {
  for (const wall of ['left', 'right']) {
    const frames = layout.frames.filter(frame => frame.wall === wall);
    assert.ok(frames.length >= 5, wall);
    assert.equal(frames[0].hero, true);
    assert.ok(frames[0].width > frames[1].width);
    const depths = frames.map(frame => frame.z);
    const sorted = [...depths].sort((a, b) => a - b);
    assert.deepEqual(depths, sorted);
  }
  assert.equal(layout.frames.filter(frame => frame.pictureLight).length, layout.frames.length);
  assert.equal(layout.frames.filter(frame => frame.hero).length, 2);
});

test('frames do not cross a pilaster or the portal', () => {
  assert.deepEqual(findArchitectureConflicts(layout), []);
});

test('the public gallery does not load the sample room', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const engine = readFileSync(new URL('../engine3d.js', import.meta.url), 'utf8');
  const loader = readFileSync(new URL('../engine-loader.js', import.meta.url), 'utf8');
  const baker = readFileSync(new URL('./bake_salle_echantillon.py', import.meta.url), 'utf8');
  const blanc = readFileSync(new URL('./bake_musee_blanc.py', import.meta.url), 'utf8');
  assert.equal(index.includes('salle-echantillon'), false);
  assert.equal(engine.includes('salle-echantillon'), false);
  assert.match(loader, /salle-echantillon\.html/);
  assert.match(loader, /salle-temoin\.html/);
  assert.match(loader, /engine3d\.js/);
  assert.doesNotMatch(baker, /export_colors\s*=/);
  assert.match(baker, /export_vertex_color=/);
  assert.match(baker, /use_pass_color = False/);
  assert.match(baker, /def neutralize_and_scale/);
  assert.doesNotMatch(blanc, /export_colors\s*=/);
  assert.match(blanc, /export_vertex_color=/);
  assert.match(blanc, /use_pass_color = False/);
  assert.match(blanc, /def neutralize/);
  assert.match(blanc, /hide_render = True/);
});

test('commerce stays a demonstration', () => {
  const contract = JSON.parse(readFileSync(new URL('../project-contract.json', import.meta.url), 'utf8'));
  assert.equal(contract.commercialState, 'demo-no-live-payments');
  assert.equal(contract.sampleRoom.commerce, 'demo-no-live-payments');
  assert.equal(contract.sampleRoom.isolatedFromPublicGallery, true);
  assert.equal(contract.sampleRoom.lightmap, 'luminance');
});
