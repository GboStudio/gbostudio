// Camera-relative movement for The Unreal Museum.
// The camera uses rotation.y = Math.PI + yaw and looks along +Z when yaw=0.
// Therefore screen-right points along world -X at the entrance, not +X.
export function museumCameraMotion(yaw, forward, strafe) {
  const s=Math.sin(yaw), c=Math.cos(yaw);
  return {
    x:s*forward-c*strafe,
    z:c*forward+s*strafe
  };
}
