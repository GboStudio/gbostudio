import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeWallSlots, DEFAULT_COMMERCE_CONFIG} from '../commerce-model.mjs';
import {ROOM, buildLayout, findArchitectureConflicts, sideBays} from './room-layout.mjs';

const layout = buildLayout();

test('each bay is a 0.50 m pilaster plus one 3.00 m commercial module', () => {
  assert.equal(ROOM.pilaster + ROOM.field, ROOM.bayPitch);
  assert.equal(ROOM.bayPitch, 3.5);
  assert.equal(ROOM.field, DEFAULT_COMMERCE_CONFIG.wall.moduleLengthM);
  for (const bay of sideBays()) {
    assert.equal(bay.pilaster.maxZ - bay.pilaster.minZ, 0.5);
    assert.equal(bay.field.maxZ - bay.field.minZ, 3);
    assert.equal(bay.field.minZ, bay.pilaster.maxZ);
  }
  assert.equal(sideBays().length, 5);
  assert.equal(sideBays().at(-1).field.maxZ, ROOM.length);
});

test('Versailles panels are 3.50/3 m and three of them fill a bay', () => {
  assert.ok(Math.abs(ROOM.panel - 1.167) < 0.001);
  assert.equal(ROOM.panel * ROOM.panelsPerBay, ROOM.bayPitch);
  assert.ok(Math.abs(ROOM.length / ROOM.panel - 15) < 1e-9);
  assert.ok(Math.abs(ROOM.width / ROOM.panel - 9) < 1e-9);
});

test('representative wall carries every commercial frame size', () => {
  const left = layout.frames.filter(frame => frame.wall === 'left');
  assert.deepEqual(
    [...new Set(left.map(frame => frame.format))].sort(),
    ['large', 'medium', 'normal', 'small', 'very_large']
  );
  const counts = {very_large: 1, large: 2, normal: 4, medium: 8, small: 16};
  for (const [format, count] of Object.entries(counts)) {
    assert.equal(left.filter(frame => frame.format === format).length, count, format);
  }
});

test('frame cells match the commercial subdivision exactly', () => {
  const sample = makeWallSlots(DEFAULT_COMMERCE_CONFIG, 1, 'very_large')[0];
  const hero = layout.frames.find(frame => frame.wall === 'left' && frame.format === 'very_large');
  assert.equal(hero.width, sample.widthM);
  assert.equal(hero.height, sample.heightM);
  assert.ok(hero.artWidth > 0.4 && hero.artHeight > 0.4);
  assert.ok(hero.moulding <= 0.14 && hero.moulding >= 0.12);
});

test('no frame, moulding or cartel crosses a pilaster, a door or another frame', () => {
  const hits = findArchitectureConflicts(layout);
  assert.deepEqual(hits, []);
});

test('premium plinth is the contractual 1.80 × 1.50 m footprint under 2.50 m', () => {
  assert.equal(layout.plinth.length, 1.8);
  assert.equal(layout.plinth.width, 1.5);
  assert.ok(layout.plinth.height + layout.plinth.sculptureHeight <= layout.plinth.maxObjectHeight);
  assert.equal(layout.plinth.maxObjectHeight, 2.5);
  const aisle = Math.abs(layout.plinth.x) - layout.plinth.width / 2;
  assert.ok(aisle > 1.2, 'plinth stays on the side of the aisle');
});

test('lightmap budget is far above the rejected 27 px/m bake', () => {
  assert.ok(ROOM.floorPxPerM >= 128);
  assert.ok(ROOM.wallPxPerM >= 80);
  assert.equal(layout.lightmap.floor.w, ROOM.length * ROOM.floorPxPerM);
  assert.equal(layout.lightmap.floor.h, ROOM.width * ROOM.floorPxPerM);
  assert.ok(layout.lightmap.floor.x + layout.lightmap.floor.w <= ROOM.lightmapSize);
  assert.ok(layout.lightmap.floor.y + layout.lightmap.floor.h <= ROOM.lightmapSize);
});

test('the public gallery entry does not load the test room', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const engine = readFileSync(new URL('../engine3d.js', import.meta.url), 'utf8');
  const loader = readFileSync(new URL('../engine-loader.js', import.meta.url), 'utf8');
  const baker = readFileSync(new URL('./bake_salle_temoin.py', import.meta.url), 'utf8');
  assert.equal(index.includes('salle-temoin'), false);
  assert.equal(engine.includes('salle-temoin'), false);
  assert.match(loader, /salle-temoin\.html/);
  assert.match(loader, /engine3d\.js/);
  assert.doesNotMatch(baker, /export_colors\s*=/);
  assert.match(baker, /export_vertex_color=/);
});
