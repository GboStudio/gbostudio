/* Run: node --test empty-museum/tests/flush-frames.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import mix from '../gallery-mix.js';
import {
  FRAME,
  frameAnchorX,
  frameWallGap,
  frameLocalToWorldX,
  commercialFrameZ,
  frameOuterHalfWidth,
  pilasterLayout,
  sameWallOverlap,
  LEGACY_FRAME_SIZE_M,
  wallInnerFaceX
} from '../origin-room-geometry.mjs';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');

function checkFlush(frame) {
  const gap = frameWallGap(frame.side, frame.anchorX);
  assert.ok(gap >= 0.01 - 1e-6 && gap <= 0.02 + 1e-6,
    frame.id + ' gap ' + gap.toFixed(4) + ' m is outside 1–2 cm');
  assert.equal(frame.anchorX, frameAnchorX(frame.side));
  const back = frameLocalToWorldX(frame.side, frame.anchorX, FRAME.backLocalZ);
  const art = frameLocalToWorldX(frame.side, frame.anchorX, FRAME.artLocalZ);
  assert.ok(Math.abs(art) < Math.abs(back) - 0.004, frame.id + ' does not face the room');
  const face = wallInnerFaceX(frame.side);
  const through = frame.side > 0 ? back - face : face - back;
  assert.ok(through < -0.009, frame.id + ' cuts the wall by ' + through);
}

test('every hanging frame sits 1–2 cm off its wall and faces the room', () => {
  const app = read('app.js');
  const sizes = app.match(/SLOT_SIZES=\[([^\]]+)\]/)[1]
    .split(',').map(s => s.replace(/['"\s]/g, ''));
  const frames = [];
  for (const id of [0, 1, 2, 3]) {
    const side = id % 2 ? 1 : -1;
    const [w, h] = LEGACY_FRAME_SIZE_M[sizes[id % sizes.length]];
    frames.push({
      id: 'partner-' + id,
      side, w, h,
      z: 5.7 + id * 3.5,
      anchorX: frameAnchorX(side),
      outerHalf: frameOuterHalfWidth(w, {plaque: true})
    });
  }
  for (const panel of mix.allWallSlots()) {
    const side = panel.parentBayId % 2 ? 1 : -1;
    const slot = {
      side,
      z: 5.7 + panel.parentBayId * 3.5,
      xM: panel.xM,
      widthM: panel.widthM
    };
    frames.push({
      id: panel.id,
      side,
      w: panel.widthM,
      h: panel.heightM,
      z: commercialFrameZ(slot),
      anchorX: frameAnchorX(side),
      outerHalf: frameOuterHalfWidth(panel.widthM, {plaque: false})
    });
  }
  assert.equal(frames.length, 120);
  const posts = pilasterLayout({length: 142, bays: 38});
  assert.ok(posts.length > 40);
  for (const frame of frames) {
    checkFlush(frame);
    for (const post of posts) {
      const overlap = sameWallOverlap(frame, post);
      assert.ok(overlap <= 0.001,
        frame.id + ' intersects a pilaster by ' + overlap.toFixed(3) + ' m at z ' + post.z.toFixed(2));
    }
  }
});

test('the marble look is wired, and the progress bar no longer prints a length', () => {
  const engine = read('engine3d.js');
  const walk = read('walk.js');
  const look = read('origin-room-look.js');
  assert.match(look, /export const enabled = true/);
  assert.match(engine, /ORIGIN_ROOM_LOOK_ENABLED \? frameAnchorX\(side\) : side\*\(HALF-\.39\)/);
  assert.match(engine, /mouldedFrameGeometry/);
  assert.match(engine, /installOriginRoomLook/);
  assert.match(engine, /getPieces\(\)\.length\+" CRÉATIONS · "\+frees\+" PLACES LIBRES"/);
  assert.doesNotMatch(engine, /Math\.floor\(LENGTH\)\+" M/);
  assert.match(walk, /all\.length \+ " CRÉATIONS · " \+/);
  assert.doesNotMatch(walk, /Math\.floor\(length\) \+ " M/);
  assert.match(engine, /renderer\.toneMappingExposure = \.91/);
});
