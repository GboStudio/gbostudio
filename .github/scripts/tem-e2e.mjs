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
    await page.waitForFunction(()=>/\\d+ \\/ 09/.test(document.querySelector('#navIndex')?.textContent||''),null,{timeout:20000});
    const initial=(await page.locator('#navIndex').textContent()).trim();
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
  }catch(err){
    errorCount++;
    console.error('FAIL',mode.name,String(err));
    console.error('Captured page errors:',errors.slice(0,6));
    await page.screenshot({path:'/tmp/tem-'+mode.name+'-failure.png',fullPage:true}).catch(()=>{});
  }finally{await ctx.close()}
}
await browser.close();
if(errorCount>0)process.exit(1);
