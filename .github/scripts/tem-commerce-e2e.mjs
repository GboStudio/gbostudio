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
  assert.match(await page.locator('#aislePrice').textContent(),/990/);
  await page.locator('#bookAisle').click();
  assert.match(await page.locator('#bookAisle').textContent(),/occupée/);
  await page.locator('[data-tab="management"]').click();
  assert.equal((await page.locator('#metricReservations').textContent()).trim(),'2');
  await page.locator('[data-tab="walls"]').click();
  await page.locator('[data-wall-price="small"][data-term="monthly"]').fill('11');
  await page.locator('#saveWallPrices').click();
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-wall-price="small"][data-term="monthly"]').inputValue(),'11');
  assert.equal(await page.locator('#wallGrid [data-slot]').count(),16);
  assert.match(await page.locator('#wallPrice').textContent(),/11/);
  assert.deepEqual(errors,[],'No uncaught browser script errors');
  console.log('PASS: configurator geometry, exclusivity, premium prices and storage persistence.');
}catch(error){
  failed=true;
  console.error(error);
}finally{
  await browser.close();
}
if(failed)process.exitCode=1;
