import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

/* Landing-only visit entry: each approved anchor must open the same overlay
   as ?visit=immersive, and modified clicks must keep the browser default. */
const base=(process.env.TEM_BASE_URL||'http://127.0.0.1:8765/empty-museum/').replace(/\/?$/,'/');
const anchors=['visite','visit','tour','walk','visite-3d'];
const shots=process.env.TEM_VISIT_SHOTS||'/tmp/visit-anchors';
mkdirSync(shots,{recursive:true});

const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
const context=await browser.newContext({viewport:{width:1280,height:800}});
let failed=0;
async function overlayOpen(page){
  await page.waitForFunction(()=>{
    const overlay=document.querySelector('#walkOverlay');
    return overlay&&overlay.hidden===false&&window.__TUM_PREMIUM_READY===true;
  },null,{timeout:70000});
}
try{
  for(const anchor of anchors){
    const page=await context.newPage();
    const response=await page.goto(base+'index.html#'+anchor,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response?.status(),200,'index.html#'+anchor+' must be served');
    await overlayOpen(page);
    const url=page.url();
    assert.match(url,/visit=immersive/,'#'+anchor+' must rewrite to ?visit=immersive');
    assert.match(url,new RegExp('#'+anchor+'$'),'the anchor must stay in the URL');
    await page.screenshot({path:shots+'/visit-anchor-'+anchor+'.png'});
    console.log('PASS anchor opens visit',anchor,url);
    await page.close();
  }
  const page=await context.newPage();
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.evaluate(()=>{window.__landingStay=1;});
  await page.locator('a.editorial-primary').click();
  await overlayOpen(page);
  assert.equal(await page.evaluate(()=>window.__landingStay),1,'a normal click must not reload the page');
  assert.match(page.url(),/visit=immersive/);
  console.log('PASS normal click uses pushState',page.url());
  await page.close();

  const home=await context.newPage();
  await home.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:45000});
  const ctrlPopup=context.waitForEvent('page');
  await home.locator('a.editorial-primary').click({modifiers:['Control']});
  const ctrlPage=await ctrlPopup;
  await ctrlPage.waitForURL(/visit=immersive/,{timeout:20000});
  assert.match(ctrlPage.url(),/visit=immersive/,'Ctrl-click must open ?visit=immersive');
  console.log('PASS ctrl-click',ctrlPage.url());
  await ctrlPage.close();

  const middlePopup=context.waitForEvent('page');
  await home.locator('a.um-header-visit').click({button:'middle'});
  const middlePage=await middlePopup;
  await middlePage.waitForURL(/visit=immersive/,{timeout:20000});
  assert.match(middlePage.url(),/visit=immersive/,'middle-click must open ?visit=immersive');
  console.log('PASS middle-click',middlePage.url());
  await middlePage.close();
  await home.close();
}catch(error){
  failed=1;
  console.error(error);
}finally{
  await browser.close();
}
if(failed) process.exit(1);
