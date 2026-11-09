import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
let failed=false;
try{
  const page=await browser.newPage({viewport:{width:1280,height:840}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const origin=process.env.TEM_BASE_URL||'http://127.0.0.1:8765/empty-museum/';
  const response=await page.goto(new URL('commerce-configurator.html',origin).href,{waitUntil:'networkidle'});
  assert.equal(response?.status(),200);
  await page.locator('#formats [data-format="normal"]').waitFor();
  assert.equal(await page.locator('#bookWall').isDisabled(),true,'First four modules reserved for partners');
  await page.locator('#module').selectOption('5');
  await page.locator('#formats [data-format="normal"]').click();
  assert.equal(await page.locator('#wallGrid [data-slot]').count(),4);
  await page.locator('#formats [data-format="small"]').click();
  assert.equal(await page.locator('#wallGrid [data-slot]').count(),16);
  await page.locator('#bookWall').click();
  assert.match(await page.locator('#occupancy').textContent(),/1 \/ 16/);
  await page.locator('#formats [data-format="very_large"]').click();
  assert.match(await page.locator('#error').textContent(),/découpage ne peut pas changer/);
  assert.equal(await page.locator('#wallGrid [data-slot]').count(),16);
  await page.locator('[data-tab="aisle"]').click();
  await page.locator('[data-distance="landmark"]').click();
  await page.locator('button[data-days="1"]').click();
  await page.locator('[data-range="landmark"]').fill('90');
  await page.locator('#saveRanges').click();
  assert.match(await page.locator('#aisleDetails').textContent(),/90 m/);
  assert.match(await page.locator('#aislePrice').textContent(),/495/);
  await page.locator('#bookAisle').click();
  assert.match(await page.locator('#bookAisle').textContent(),/occupée/);
  await page.locator('[data-tab="management"]').click();
  assert.equal((await page.locator('#metricReservations').textContent()).trim(),'2');
  await page.locator('[data-tab="walls"]').click();
  await page.locator('[data-wall-price="small"][data-term="monthly"]').fill('11');
  await page.locator('#saveWallPrices').click();
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#module').selectOption('5');
  assert.equal(await page.locator('[data-wall-price="small"][data-term="monthly"]').inputValue(),'11');
  await page.locator('[data-tab="aisle"]').click();
  assert.equal(await page.locator('[data-range="landmark"]').inputValue(),'90');
  assert.equal(await page.locator('#wallGrid [data-slot]').count(),16);
  assert.match(await page.locator('#wallPrice').textContent(),/11/);
  // Exercise the REAL museum entry, not just the administration prototype.
  const front=await page.goto(origin,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(front?.status(),200);
  await page.waitForFunction(()=>Boolean(window.TEM?.getWallDisplaySlots&&window.TEM?.openFloor),null,{timeout:45000});
  assert.equal(await page.evaluate(()=>window.TEM.getWallDisplaySlots().length),116);
  assert.equal(await page.evaluate(()=>window.TEM.getFloorSlots().length),4);
  await page.locator('[data-plan="floor"]').click();
  await page.locator('#floorQuotedPrice').waitFor({state:'visible'});
  assert.match(await page.locator('#floorQuotedPrice').textContent(),/145/);
  await page.locator('#floorDurationDays').selectOption('7');
  await page.locator('#floorVisibilityTier').selectOption('gallery');
  assert.match(await page.locator('#floorQuotedPrice').textContent(),/1\\s?245/);
  await page.locator('#floorClose').click();
    assert.deepEqual(errors,[],'No uncaught browser script errors');
  console.log('PASS: configurator geometry, exclusivity, premium prices and storage persistence.');
}catch(error){
  failed=true;
  console.error(error);
}finally{
  await browser.close();
}
if(failed)process.exitCode=1;
