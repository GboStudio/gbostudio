import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const base = 'https://gbostudio.fr/empty-museum/';
const modes = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, hasTouch: true }
];

let errorCount=0;
for(const mode of modes) {
  const ctx=await browser.newContext({
    viewport:mode.viewport,hasTouch:mode.hasTouch,isMobile:mode.hasTouch,
    deviceScaleFactor:mode.hasTouch?2:1
  });
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(base+'3d.html', { waitUntil:'domcontentloaded', timeout:40000 });
    await page.waitForFunction(()=>document.querySelector('#loader')?.classList.contains('hidden'),null,{timeout:20000});
    await page.waitForFunction(()=>document.querySelector('#navIndex')?.textContent?.includes('/ 09'),null,{timeout:20000});
    const initial=(await page.locator('#navIndex').textContent()).trim();
    const renderInfo=await page.evaluate(()=>({
      mode:window.__TEM_GALLERY_FALLBACK_STARTED?'CANVAS FALLBACK':'WEBGL 3D',
      canvasWidth:document.querySelector('#scene')?.width,
      canvasHeight:document.querySelector('#scene')?.height,
      marker:document.querySelector('#graphicsLabel')?.textContent
    }));
    console.log('RENDER',mode.name,JSON.stringify(renderInfo));
    await page.locator('#next').click();
    const next=(await page.locator('#navIndex').textContent()).trim();
    if(initial===next)throw new Error('Next artwork does not change counter');
    await page.locator('#random').click();
    await page.waitForFunction(()=>document.querySelector('#detail')?.classList.contains('open'),null,{timeout:4000});
    const art=(await page.locator('#detailTitle').textContent()).trim();
    if(!art)throw new Error('Artwork detail title empty');
    await page.locator('#closeDetail').click();
    await page.waitForFunction(()=>!document.querySelector('#detail')?.classList.contains('open'),null,{timeout:4000});
    console.log('PASS',mode.name,'3d/fallback gallery:',initial,'->',next, 'detail:',art);
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#wall').waitFor({timeout:8000});
    const link=await page.locator('a[href="./3d.html"]').count();
    if(!link)throw new Error('No 3D gallery link on museum home');
    console.log('PASS',mode.name,'main museum and 3D navigation link');
    // The real museum on the homepage must now visit actual art instead of cruising.
    await page.waitForFunction(()=>document.querySelector('#museumTour') && document.querySelector('#walkOverlay'),null,{timeout:25000});
    await page.waitForFunction(()=>document.querySelector('#walkOverlay').hidden===false,null,{timeout:15000});
    const button=mode.hasTouch?'#museumAdvance':'#museumNextStop';
    const buttonInfo=await page.evaluate(sel=>{
      const el=document.querySelector(sel),b=el?.getBoundingClientRect(),cs=el?getComputedStyle(el):null;
      return {exists:!!el,display:cs?.display,visibility:cs?.visibility,
        box:b?{x:b.x,y:b.y,w:b.width,h:b.height}:null,
        viewportHeight:window.innerHeight,viewportWidth:window.innerWidth,
        overlayBox:document.querySelector('#walkOverlay')?.getBoundingClientRect()?.toJSON(),
        hitIsButton:b?el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)):false};
    },button);
    console.log('GUIDE BUTTON',mode.name,JSON.stringify(buttonInfo));
    if(buttonInfo.box && (buttonInfo.box.y<0 || buttonInfo.box.y+buttonInfo.box.h > buttonInfo.viewportHeight+3))
      throw new Error('Next-artwork button is outside the visible viewport');
    if(!buttonInfo.hitIsButton)throw new Error('Next-artwork button is covered by another layer');
    // Synthetic event avoids false click timeouts when the CI GPU renders at 1 FPS.
    await page.evaluate(sel=>document.querySelector(sel).click(),button);
    await page.waitForFunction(()=>document.querySelector('#walkOverlay')?.dataset.tourStop==='1',null,{timeout:24000});
    const firstArt=(await page.locator('#temTourTitle').textContent()).trim();
    const firstDescription=(await page.locator('#temTourDescription').textContent()).trim();
    if (!firstArt || !firstDescription)throw new Error('Guided stop missing title or description');
    await page.evaluate(sel=>document.querySelector(sel).click(),button);
    await page.waitForFunction(()=>document.querySelector('#walkOverlay')?.dataset.tourStop==='2',null,{timeout:24000});
    const secondArt=(await page.locator('#temTourTitle').textContent()).trim();
    if(firstArt===secondArt)throw new Error('Next artwork still shows the same piece');
    if(await page.locator('#temTourStory').isHidden())throw new Error('Artwork story panel hidden');
    console.log('PASS',mode.name,'guided visits actual artwork:',firstArt,'→',secondArt);
    // Pause immediately after requesting the next stop; camera must stay put
    // and then resume the same movement, not skip ahead or restart the hall.
    await page.evaluate(sel=>{
      document.querySelector(sel).click();
      document.querySelector('#museumTour').click();
      document.querySelector('#museumTour').click();
    },button);
    await page.waitForFunction(()=>document.querySelector('#walkOverlay')?.dataset.tourPaused==='true',null,{timeout:12000});
    const atPause=await page.evaluate(()=>Number(document.querySelector('#walkOverlay').dataset.tourCameraZ));
    await page.waitForTimeout(700);
    const stillPaused=await page.evaluate(()=>Number(document.querySelector('#walkOverlay').dataset.tourCameraZ));
    if(Math.abs(atPause-stillPaused)>0.04)
      throw new Error('Camera continued walking after guided-tour pause: '+atPause+' → '+stillPaused);
    await page.evaluate(()=>document.querySelector('#museumTour').click());
    await page.waitForFunction(()=>document.querySelector('#walkOverlay')?.dataset.tourPlaying==='true',null,{timeout:12000});
    await page.waitForFunction(()=>document.querySelector('#walkOverlay')?.dataset.tourStop==='3',null,{timeout:35000});
    const resumedArt=(await page.locator('#temTourTitle').textContent()).trim();
    if(resumedArt===secondArt)throw new Error('Guided tour did not advance after resume');
    console.log('PASS',mode.name,'pause and resume in-place:',secondArt,'→',resumedArt);

    // Verify actual UI controls do not start endless cruise.
    const cruising=await page.locator('#museumAdvance').getAttribute('aria-pressed');
    if(cruising==='true')throw new Error('Old endless cruise mode still active');
  }catch(err){
    errorCount++;
    console.error('FAIL',mode.name,String(err));
    console.error('Captured page errors:',errors.slice(0,6));
    await page.screenshot({path:'/tmp/tem-'+mode.name+'-failure.png',fullPage:true}).catch(()=>{});
  }finally{await ctx.close()}
}
await browser.close();
if(errorCount>0)process.exit(1);
