/* Run: node --test empty-museum/tests/visitor-collision.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VISITOR,
  ENFILADE,
  slideVisitor,
  separateVisitor,
  hitsObstacle,
  staticObstacles,
  visitorBounds,
  frameObstacle,
  frameOuterHalfWidth
} from '../origin-room-geometry.mjs';

const length = 142;
const radius = VISITOR.radius;
const bounds = visitorBounds(length, radius);
const obstacles = staticObstacles(length);
obstacles.push(frameObstacle({side: 1, z: 9.2, outerHalf: frameOuterHalfWidth(2.4)}));
obstacles.push(frameObstacle({side: -1, z: 5.7, outerHalf: frameOuterHalfWidth(2.76)}));

function walk(x, z, dx, dz, steps) {
  for (let i = 0; i < steps; i++) {
    const next = slideVisitor(x, z, x + dx, z + dz, radius, obstacles, bounds);
    x = next.x;
    z = next.z;
    assert.ok(!hitsObstacle(x, z, radius, obstacles), 'inside an obstacle at ' + x.toFixed(2) + ',' + z.toFixed(2));
    assert.ok(x >= bounds.minX - 1e-6 && x <= bounds.maxX + 1e-6);
    assert.ok(z >= bounds.minZ - 1e-6 && z <= bounds.maxZ + 1e-6);
  }
  return {x, z};
}

function steer(x, z, targetX, dz, steps) {
  let pos = {x, z};
  for (let i = 0; i < steps; i++) {
    const dx = Math.max(-0.35, Math.min(0.35, targetX - pos.x));
    pos = walk(pos.x, pos.z, dx, dz, 1);
  }
  return pos;
}

function traverse(zStart, dz) {
  let pos = {x: 0, z: zStart};
  for (let i = 0; i < 500; i++) {
    const nearDoor = pos.z > 14.2 && pos.z < 19.5;
    const targetX = nearDoor ? 2.6 : 0;
    const dx = Math.max(-0.35, Math.min(0.35, targetX - pos.x));
    const next = walk(pos.x, pos.z, dx, dz, 1);
    if (next.z === pos.z && next.x === pos.x) break;
    pos = next;
    if (dz > 0 && pos.z > length - 7) break;
    if (dz < 0 && pos.z < 1.5) break;
  }
  return pos;
}

test('the aisle can be walked end to end and back without getting stuck', () => {
  const far = traverse(1, 0.4);
  assert.ok(far.z > length - 8, 'did not reach the far end, z=' + far.z);
  const home = traverse(far.z, -0.4);
  assert.ok(home.z < 2, 'did not return to the entrance, z=' + home.z);
});

test('each room ends in a wall whose doorway still lets the aisle through', () => {
  assert.ok(ENFILADE.zs[0] > 16 && ENFILADE.zs[0] < 17, 'the entrance hall has no end wall');
  assert.ok(ENFILADE.firstDoor.x1 - ENFILADE.firstDoor.x0 > radius * 2 + 0.4);
  assert.equal(hitsObstacle(0, ENFILADE.zs[0], radius, obstacles), true, 'the centered end wall is open');
  assert.equal(hitsObstacle(2.6, ENFILADE.zs[0], radius, obstacles), false, 'the side door is blocked');
  for (const z of ENFILADE.zs.slice(1)) {
    assert.equal(hitsObstacle(0, z, radius, obstacles), false, 'doorway blocked at z=' + z);
    assert.equal(hitsObstacle(3.2, z, radius, obstacles), true, 'end wall missing at z=' + z);
  }
  let through = steer(0, 1, 2.6, 0.4, 50);
  through = steer(through.x, through.z, 0, 0.4, 40);
  assert.ok(through.z > ENFILADE.zs[1], 'could not walk into the second room, z=' + through.z);
});

test('corners and obstacles push the visitor back to a free spot', () => {
  const corner = slideVisitor(0, 1, 20, -5, radius, obstacles, bounds);
  assert.ok(Math.abs(corner.x - bounds.maxX) < 0.02 || corner.x < bounds.maxX);
  assert.ok(!hitsObstacle(corner.x, corner.z, radius, obstacles));
  const out = separateVisitor(corner.x, corner.z, radius, obstacles, bounds);
  const home = walk(out.x, out.z, -0.25, 0.05, 12);
  assert.ok(home.x < out.x - 1, 'could not leave the side wall, x=' + home.x);
  let buried = {x: 4.4, z: 9.2};
  for (let i = 0; i < 12; i++) buried = separateVisitor(buried.x, buried.z, radius, obstacles, bounds);
  assert.ok(!hitsObstacle(buried.x, buried.z, radius, obstacles));
  const freed = walk(buried.x, buried.z, -0.25, 0, 10);
  assert.ok(freed.x < 1.5, 'could not get back to the aisle, x=' + freed.x);
});
