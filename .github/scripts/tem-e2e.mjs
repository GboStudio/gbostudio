import {chromium} from 'playwright';

/* THE UNREAL MUSEUM — browser acceptance test for the SINGLE PBR viewer.
   Covers actual exploration, not the abandoned frame-by-frame V5 gallery. */
const base=process.env.TEM_BASE_URL||'https://gbostudio.fr/empty-museum/';
const browsers=[
  {name:'desktop',viewport:{width:1200,height:760},mobile:false},
  {name:'mobile',viewport:{width:390,height:844},mobile:true}
];
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
let failures=0;
for(const mode of browsers){
  const context=await browser.newContext({
    viewport:mode.viewport,
    isMobile:mode.mobile,
    hasTouch:mode.mobile,
    deviceScaleFactor:mode.mobile?2:1
  });
  const page=await context.newPage();
  const pageErrors=[],consoleErrors=[],requests=[];
  page.on('pageerror',e=>pageErrors.push(e.stack||String(e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('requestfailed',r=>requests.push(r.url()+' => '+r.failure()?.errorText));
  try{
    const response=await page.goto(base+'?visit=immersive',{waitUntil:'domcontentloaded',timeout:45000});
    if(!response?.ok())throw Error('The Unreal Museum homepage HTTP '+response?.status());
    await page.locator('#walkOverlay').waitFor({state:'attached',timeout:12000});
    await page.waitForFunction(()=>{
      return window.__TUM_PREMIUM_READY===true ||
        (document.querySelector('#walkOverlay')?.hidden===false
          &&!document.querySelector('.museum-v5-shell'));
    },null,{timeout:50000});
    const state=await page.evaluate(()=>{
      const overlay=document.querySelector('#walkOverlay');
      const stick=document.querySelector('.museum-v5-joystick');
      const c=document.querySelector('#walkCanvas');
      let available=false;
      try{const test=document.createElement('canvas');available=!!(test.getContext('webgl')||test.getContext('experimental-webgl'));}catch(e){}
      return {
        premium:window.__TUM_PREMIUM_READY===true,
        visible:overlay?.hidden===false,
        free:document.querySelector('#museumFreeToggle')?.getAttribute('aria-pressed'),
        isFree:document.querySelector('.museum-v5-shell')?.classList.contains('is-free'),
        stickDisplay:stick?getComputedStyle(stick).display:'missing',
        canvasWidth:c?.width||0,canvasHeight:c?.height||0,
        webgl:available,
        progress:document.querySelector('#walkProgress')?.textContent||''
      };
    });
    console.log('MUSEUM STATE',mode.name,JSON.stringify(state));
    if(!state.visible)throw Error('Museum walkthrough overlay is hidden');
    if(state.webgl&&!state.premium)throw Error('Premium immersive engine failed despite WebGL support');
    if(state.premium){
      if(state.free!=='true'||!state.isFree)throw Error('Museum did not start in free exploration');
      if(state.canvasWidth<=0||state.canvasHeight<=0)throw Error('3D canvas was not resized');
      const beforeZ=await page.locator('#walkOverlay').evaluate(el=>Number(el.dataset.tourCameraZ||0));
      if(mode.mobile && (state.stickDisplay==='none'||state.stickDisplay==='missing'))
        throw Error('Mobile joystick is not visible');
      if(mode.mobile){
        for(const selector of ['.joystick-ring','#museumTour','#museumFreeToggle']){
          const bounds=await page.locator(selector).evaluate(el=>{
            const r=el.getBoundingClientRect(),v=window.visualViewport;
            const x=v?.offsetLeft||0,y=v?.offsetTop||0;
            const w=v?.width||window.innerWidth,h=v?.height||window.innerHeight;
            return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,x,y,w,h};
          });
          if(!(bounds.left>=bounds.x-1&&bounds.right<=bounds.x+bounds.w+1
            &&bounds.top>=bounds.y-1&&bounds.bottom<=bounds.y+bounds.h+1))
            throw Error('Mobile control outside visual viewport: '+selector+' '+JSON.stringify(bounds));
        }
      }
      try{
        if(mode.mobile){
          const bounds=await page.locator('.joystick-ring').boundingBox();
          if(!bounds)throw Error('No interactive joystick zone');
          const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2-30;
          await page.mouse.move(x,y);await page.mouse.down();
        }else{
          await page.keyboard.down('w');
        }
        // SwiftShader WebGL software rendering can run only a few frames per second.
        // Test actual 3D camera position, not the integer metres rounded in the HUD.
        await page.waitForFunction((origin)=>{
          const z=Number(document.querySelector('#walkOverlay')?.dataset.tourCameraZ||0);
          return Number.isFinite(z) && z>origin+.035;
        },beforeZ,{polling:350,timeout:45000});
      }finally{
        if(mode.mobile)await page.mouse.up().catch(()=>{});
        else await page.keyboard.up('w').catch(()=>{});
      }
      const afterZ=await page.locator('#walkOverlay').evaluate(el=>Number(el.dataset.tourCameraZ||0));
      console.log('WALK WORLD Z',mode.name,beforeZ,'→',afterZ);
      if(!(afterZ>beforeZ+.035))throw Error('Visitor did not move forward in the premium museum');
      const hit=await page.locator('#museumTour').evaluate(btn=>{
        const r=btn.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        const top=document.elementFromPoint(x,y);
        const layer=btn.closest('.museum-v5-shell');
        return {top:top?.id||top?.className||top?.nodeName,
          buttonVisible:getComputedStyle(btn).visibility,
          buttonPointer:getComputedStyle(btn).pointerEvents,
          shellZ:getComputedStyle(layer).zIndex,
          shellPointer:getComputedStyle(layer).pointerEvents};
      });
      console.log('GUIDED BUTTON HIT TARGET',mode.name,JSON.stringify(hit));
      if(String(hit.top)!=='museumTour')
        throw Error('Guided tour button is covered by '+hit.top);
      // Mobile: tap fixed-screen coordinates like an actual finger.
      // Playwright locator.click() may scroll the 3D viewport before clicking.
      async function tapTour(){
        if(!mode.mobile){
          await page.locator('#museumTour').click({timeout:20000});
          return;
        }
        const box=await page.locator('#museumTour').boundingBox();
        if(!box)throw Error('Cannot locate guided tour button on mobile');
        const x=box.x+box.width/2,y=box.y+box.height/2;
        await page.touchscreen.tap(x,y);
      }
      await tapTour();
      await page.waitForFunction(()=>document.querySelector('#museumTour')?.getAttribute('aria-pressed')==='true',null,{timeout:15000});
      await tapTour();
      await page.waitForFunction(()=>document.querySelector('#museumTour')?.getAttribute('aria-pressed')==='false',null,{timeout:15000});
      console.log('PASS',mode.name,'PBR gallery, default free roam, movement, guided mode');
    }else{
      console.log('WebGL not available in this environment; accessible fallback shown:',mode.name);
    }
    if(mode.mobile){
      const host=await page.locator('.walk-close').count();
      if(!host)throw Error('No visible way to leave the immersive museum');
    }
  }catch(e){
    failures++;
    console.error('FAIL',mode.name,e?.stack||String(e));
    console.error('BROWSER PAGE ERRORS',JSON.stringify(pageErrors.slice(0,10)));
    console.error('BROWSER CONSOLE ERRORS',JSON.stringify(consoleErrors.slice(0,10)));
    console.error('FAILED REQUESTS',JSON.stringify(requests.slice(0,12)));
    await page.screenshot({path:'/tmp/tem-'+mode.name+'-failure.png',fullPage:true}).catch(()=>{});
  }finally{await context.close();}
}
await browser.close();
if(failures>0)process.exit(1);
