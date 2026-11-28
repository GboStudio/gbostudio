/* A painting on an empty hall frame is display only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canDecorateSlot} from '../origin-hall-layout.mjs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

function freePlaces(wallSlots, ceilingSlots = [], floorSlots = []) {
  return wallSlots.filter(slot => !slot.piece && !slot.reservedForAds).length
    + ceilingSlots.filter(slot => slot.unlocked && !slot.piece).length
    + floorSlots.filter(slot => !slot.piece).length;
}

test('decorating a free hall slot does not change the free-slot count or the expose flow', () => {
  const wall = [
    {id: 'M006-large-1', isCommercial: true, piece: null, reservedForAds: false},
    {id: 'M006-large-2', isCommercial: true, piece: null, reservedForAds: false},
    {id: 'real', isCommercial: true, piece: {title: 'Oeuvre'}, reservedForAds: false},
    {id: 0, isCommercial: false, piece: {title: 'The Partner Collection'}, reservedForAds: true}
  ];
  const before = freePlaces(wall, [{unlocked: true, piece: null}], [{piece: null}]);
  for (const slot of wall) {
    if (!canDecorateSlot(slot)) continue;
    slot.displayOnly = true;
  }
  assert.equal(freePlaces(wall, [{unlocked: true, piece: null}], [{piece: null}]), before);
  assert.equal(canDecorateSlot(wall[2]), false);
  assert.equal(canDecorateSlot(wall[3]), false);
  assert.equal(wall.filter(slot => slot.displayOnly).length, 2);
  const look = read('origin-room-look.js');
  const engine = read('engine3d.js');
  assert.match(look, /origin-hall-display/);
  assert.match(look, /art\.raycast = \(\) => \{\}/);
  assert.doesNotMatch(look, /slot\.piece\s*=/);
  assert.match(engine, /else window\.TEM\.openExhibit\(slot\.size,slot\.price,slot\.id\)/);
  assert.match(engine, /PLACES LIBRES/);
});
