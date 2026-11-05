import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
const setups=[
  {name:'desktop',width:1200,height:760,mobile:false},
  {name:'mobile',width:390,height:844,mobile:true}
];
let fail=0;
for(const device of setups){
  const context=await browser.newContext({
    viewport:{width:device.width,height:device.height},
    deviceScaleFactor:device.mobile?2:1,
    isMobile:device.mobile,
    hasTouch:device.mobile
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
    const response=await page.goto('http://127.0.0.1:8765/empty-museum/?visit=immersive',{
      waitUntil:'domcontentloaded',timeout:45000
    });
    assert.equal(response?.status(),200,'Local staging must serve the museum');
    await page.waitForFunction(()=>window.__TUM_PREMIUM_READY===true,null,{timeout:65000});
    await page.waitForFunction(()=>
      document.querySelector('#walkOverlay')?.dataset.museumArchitecture==='physical-v3',
      null,{timeout:25000}
    );
    const state=await page.evaluate(()=>{
      const overlay=document.querySelector('#walkOverlay');
      const canvas=document.querySelector('#walkCanvas');
      return {
        mode:overlay?.dataset.museumArchitecture,
        canvas:{width:canvas?.width,height:canvas?.height},
        visible:overlay?.hidden===false,
        initialZ:Number(overlay?.dataset.tourCameraZ),
        responsive:getComputedStyle(document.querySelector('.museum-v5-shell')).pointerEvents
      };
    });
    assert.equal(state.mode,'physical-v3','Physical architecture must initialize');
    assert.ok(state.visible && state.canvas.width>100 && state.canvas.height>100);
    assert.ok(Number.isFinite(state.initialZ),'Camera coordinates should be exposed for diagnostics');
    assert.deepEqual(errors,[],'No uncaught browser exceptions');
    if(device.mobile){
      const exit=await page.locator('.walk-close').evaluate(btn=>{
        const r=btn.getBoundingClientRect();
        const v=window.visualViewport;
        const vw=v?.width||window.innerWidth,vh=v?.height||window.innerHeight;
        const ox=v?.offsetLeft||0,oy=v?.offsetTop||0;
        const room=document.querySelector('#walkOverlay').getBoundingClientRect();
        const x=r.left+r.width/2,y=r.top+r.height/2;
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,vw,vh,ox,oy,
          roomWidth:room.width,roomHeight:room.height,
          hittable:document.elementFromPoint(x,y)===btn};
      });
      console.log('MOBILE EXIT CONTROL',JSON.stringify(exit));
      assert.ok(exit.left>=exit.ox && exit.right<=exit.ox+exit.vw+1
        && exit.top>=exit.oy && exit.bottom<=exit.oy+exit.vh+1,
        'Exit control must fit entirely inside the VISIBLE portrait viewport');
      assert.ok(exit.roomWidth<=exit.vw+1 && exit.roomHeight<=exit.vh+1,
        'WebGL room must not extend beyond the visible iPhone viewport');
      assert.ok(exit.hittable,'Exit control must receive touch input above the WebGL canvas');
    }
    try{
      await page.screenshot({path:'/tmp/museum-v3-'+device.name+'.png',timeout:60000});
    }catch(error){
      // Screenshots are supporting artifacts, not proof of browser validity.
      // Software-only SwiftShader frequently stalls during screenshot readback
      // even after the actual WebGL museum rendered and all assertions passed.
      console.warn('PREVIEW SCREENSHOT SKIPPED',device.name,String(error).slice(0,250));
    }
    console.log('PASS architectural staging',device.name,JSON.stringify(state));
  }catch(error){
    fail++;
    console.error('FAIL architectural staging',device.name,error.stack||String(error));
    console.error('Browser errors:',JSON.stringify(errors));
    await page.screenshot({path:'/tmp/museum-v3-'+device.name+'-failure.png'}).catch(()=>{});
  }finally{await context.close();}
}
await browser.close();
if(fail)process.exit(1);
