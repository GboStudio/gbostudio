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

test('the aisle can be walked end to end and back without getting stuck', () => {
  let pos = walk(0, 1, 0, 0.4, 400);
  assert.ok(pos.z > length - 8, 'did not reach the far end, z=' + pos.z);
  pos = walk(pos.x, pos.z, 0, -0.4, 400);
  assert.ok(pos.z < 2, 'did not return to the entrance, z=' + pos.z);
});

test('each room ends in a wall whose doorway still lets the aisle through', () => {
  assert.ok(ENFILADE.zs[0] < 12, 'the first room has no end wall');
  assert.ok(ENFILADE.opening > radius * 2 + 0.4);
  for (const z of ENFILADE.zs) {
    assert.equal(hitsObstacle(0, z, radius, obstacles), false, 'doorway blocked at z=' + z);
    assert.equal(hitsObstacle(3.2, z, radius, obstacles), true, 'end wall missing at z=' + z);
  }
  const through = walk(0, 1, 0, 0.4, 80);
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
