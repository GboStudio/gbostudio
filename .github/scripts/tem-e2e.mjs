import { chromium } from 'playwright';

/*
 * Public museum browser smoke test.
 * Verify the current 3D engine and UX, not an obsolete hardcoded number
 * of demo works or legacy tour controls that no longer exist.
 */
const base='https://gbostudio.fr/empty-museum/';
const modes=[
  {name:'desktop',viewport:{width:1440,height:900},hasTouch:false},
  {name:'mobile',viewport:{width:390,height:844},hasTouch:true}
];
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
let failures=0;
for(const mode of modes){
  const context=await browser.newContext({
    viewport:mode.viewport,
    hasTouch:mode.hasTouch,
    isMobile:mode.hasTouch,
    deviceScaleFactor:mode.hasTouch?2:1
  });
  const page=await context.newPage(),errors=[],consoleWarnings=[],failedRequests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',msg=>{if(msg.type()==='error')consoleWarnings.push(msg.text())});
  page.on('requestfailed',req=>failedRequests.push(req.url()+' :: '+req.failure()?.errorText));
  try{
    const response=await page.goto(base+'3d.html',{waitUntil:'domcontentloaded',timeout:40000});
    if(!response?.ok())throw Error('Museum 3D HTTP status '+(response?.status()??'unknown'));
    await page.waitForFunction(
      ()=>document.querySelector('#loader')?.classList.contains('hidden')
        || window.__TEM_GALLERY_FALLBACK_STARTED===true,
      null,{timeout:35000}
    );
    await page.waitForFunction(()=>{
      const str=document.querySelector('#navIndex')?.textContent||'';
      return /^\s*\d+\s*\/\s*\d+\s*$/.test(str)&&Number(str.split('/')[1])>0;
    },null,{timeout:20000});
    const start=await page.locator('#navIndex').textContent();
    const info=await page.evaluate(()=>({
      ready:window.__TEM_V4_READY===true,
      fallback:window.__TEM_GALLERY_FALLBACK_STARTED===true,
      nav:document.querySelector('#navIndex')?.textContent,
      works:document.querySelector('#totalPieces')?.textContent,
      canvasWidth:document.querySelector('#scene')?.width,
      canvasHeight:document.querySelector('#scene')?.height,
      marker:document.querySelector('#graphicsLabel')?.textContent,
      webglSupported:(()=>{
        try{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');const ok=!!gl;gl?.getExtension('WEBGL_lose_context')?.loseContext();return ok;}
        catch(e){return false;}
      })()
    }));
    console.log('RENDER',mode.name,JSON.stringify(info));
    if(!info.ready&&!info.fallback)throw Error('Neither museum WebGL nor canvas fallback initialized');
    if(info.fallback&&info.webglSupported)throw Error('Unexpected 2D fallback even though browser WebGL is available; investigate module/CDN failure');
    if(info.fallback)console.warn('EXPECTED FALLBACK',mode.name,'this Chromium environment has no usable WebGL context');
    if(!info.canvasWidth||!info.canvasHeight)throw Error('Museum canvas has zero dimensions');
    const total=Number(String(start).split('/')[1].trim());
    if(total!==Number(info.works))throw Error('Work counter mismatch '+total+' != '+info.works);

    await page.locator('#explore').click({timeout:8000});
    await page.waitForFunction(()=>document.querySelector('#intro')?.classList.contains('dismissed'),null,{timeout:8000});
    if(info.ready){
      const state=await page.evaluate(()=>({
        free:document.querySelector('#temFree')?.classList.contains('active')||false,
        directions:document.querySelector('#temDirections')?.classList.contains('visible')||false,
        display:getComputedStyle(document.querySelector('#temDirections')).display
      }));
      console.log('FREE ROAM ENTRY',mode.name,JSON.stringify(state));
      if(!state.free||!state.directions||state.display==='none')
        throw Error('Free-roam exploration controls missing after entering the 3D museum');
    }
    await page.locator('#next').click({timeout:8000});
    const next=await page.locator('#navIndex').textContent();
    if(start===next)throw Error('Next artwork does not change gallery index');
    await page.locator('#random').click({timeout:8000});
    await page.waitForFunction(()=>document.querySelector('#detail')?.classList.contains('open'),null,{timeout:8000});
    const art=(await page.locator('#detailTitle').textContent())?.trim();
    if(!art)throw Error('Artwork detail has no title');
    await page.locator('#closeDetail').click({timeout:8000});
    await page.waitForFunction(()=>!document.querySelector('#detail')?.classList.contains('open'),null,{timeout:8000});

    // Free/guided controls apply only to immersive 3D; fallback has its own navigation.
    if(info.ready){
      await page.locator('#temFree').click({timeout:8000});
      if(!await page.locator('#temFree').evaluate(el=>el.classList.contains('active')))
        throw Error('Free navigation mode cannot be activated');
      if(!await page.locator('#temDirections').evaluate(el=>el.classList.contains('visible')))
        throw Error('Navigation directions do not appear in free mode');
      await page.locator('#temGuide').click({timeout:8000});
      if(!await page.locator('#temGuide').evaluate(el=>el.classList.contains('active')))
        throw Error('Guided navigation mode cannot be activated');
    }
    console.log('PASS',mode.name,info.ready?'V5 WebGL navigation and guided/free controls':'2D accessible fallback navigation',start,'→',next,'art:',art);

    const home=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    if(!home?.ok())throw Error('Museum homepage HTTP status '+(home?.status()??'unknown'));
    await page.locator('#wall').waitFor({timeout:12000});
    if(await page.locator('a[href="./3d.html"]').count()===0)
      throw Error('Main museum page has no 3D entrance');
    if(await page.locator('#mur-total').count()===0)
      throw Error('Mur Total offer not present on the main page');
    if(await page.locator('a[href="./3d.html"].btn.dark').count()===0)
      throw Error('The primary visit CTA is not the new 3D museum');
    console.log('PASS',mode.name,'homepage main 3D entrance and Mur Total');

  }catch(e){
    failures++;
    console.error('FAIL',mode.name,e?.stack||String(e));
    console.error('PAGE ERRORS',JSON.stringify(errors.slice(0,12)));
    console.error('CONSOLE ERRORS',JSON.stringify(consoleWarnings.slice(0,12)));
    console.error('FAILED REQUESTS',JSON.stringify(failedRequests.slice(0,12)));
    await page.screenshot({path:'/tmp/tem-'+mode.name+'-failure.png',fullPage:true}).catch(()=>{});
  }finally{await context.close();}
}
await browser.close();
if(failures)process.exit(1);
