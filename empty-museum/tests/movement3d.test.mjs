import test from 'node:test';
import assert from 'node:assert/strict';
import {museumCameraMotion} from '../movement3d.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`expected ${a} to equal ${b}`);

test('joystick right moves to screen right at museum entrance',()=>{
  const v=museumCameraMotion(0,0,1);
  close(v.x,-1);close(v.z,0);
});
test('joystick left is opposite of right',()=>{
  const v=museumCameraMotion(0,0,-1);
  close(v.x,1);close(v.z,0);
});
test('joystick up walks forward along the aisle',()=>{
  const v=museumCameraMotion(0,1,0);
  close(v.x,0);close(v.z,1);
});
test('rotating 90 degrees rotates camera-relative strafing consistently',()=>{
  const right=museumCameraMotion(Math.PI/2,0,1);
  close(right.x,0);close(right.z,1);
  const fwd=museumCameraMotion(Math.PI/2,1,0);
  close(fwd.x,1);close(fwd.z,0);
});
test('forward and strafe remain perpendicular for arbitrary camera yaw',()=>{
  const yaw=1.27,f=museumCameraMotion(yaw,1,0),r=museumCameraMotion(yaw,0,1);
  close(f.x*r.x+f.z*r.z,0);
  close(Math.hypot(f.x,f.z),1);
  close(Math.hypot(r.x,r.z),1);
});
