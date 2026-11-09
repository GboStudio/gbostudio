import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const requireV4=existsSync('empty-museum/assets/entrance-v4-baked.glb');

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
  const page=await context.newPage(),errors=[],diagnostics=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')diagnostics.push(m.type()+': '+m.text());});
  page.on('requestfailed',r=>diagnostics.push('request failed: '+r.url()+' '+(r.failure()?.errorText||'')));
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
    if(requireV4){
      const baked=()=>document.querySelector('#walkOverlay')?.dataset.museumLighting==='cycles-baked-v4';
      try{
        await page.waitForFunction(baked,null,{timeout:35000});
      }catch(initialError){
        const lighting=await page.locator('#walkOverlay').getAttribute('data-museum-lighting').catch(()=>null);
        console.warn('PREVIEW BAKE FIRST ATTEMPT',device.name,JSON.stringify({lighting,diagnostics:diagnostics.slice(-12)}));
        // A shared SwiftShader runner may abort a cold GLB request while
        // compiling its first WebGL context. Keep the baked-geometry assertion,
        // but allow two fresh-load retries rather than failing on the first
        // transient asset timeout. Never report success on a V3 fallback.
        let restored=false;
        for(let attempt=1;attempt<=2&&!restored;attempt++){
          try{
            await page.reload({waitUntil:'domcontentloaded',timeout:45000});
            await page.waitForFunction(()=>window.__TUM_PREMIUM_READY===true,null,{timeout:65000});
            await page.waitForFunction(()=>document.querySelector('#walkOverlay')?.dataset.museumArchitecture==='physical-v3',null,{timeout:25000});
            await page.waitForFunction(baked,null,{timeout:50000});
            restored=true;
            console.log('PASS verified Blender bake after cold-render retry',device.name,attempt);
          }catch(error){
            console.warn('BAKED GLB RETRY FAILED',device.name,attempt,String(error).slice(0,200));
            if(attempt===2)throw error;
          }
        }
      }
      const primitiveCount=Number(await page.locator('#walkOverlay').getAttribute('data-museum-bake-primitives'));
      assert.ok(primitiveCount>0 && primitiveCount<=12,'Cycles baked scene must have a bounded draw-call count');
      console.log('PASS real Blender Cycles light-baked GLB',device.name,primitiveCount,'draw calls');
    }
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
      for(const selector of ['.joystick-ring','#museumTour','#museumFreeToggle']){
        const control=await page.locator(selector).evaluate(el=>{
          const r=el.getBoundingClientRect(),v=window.visualViewport;
          const ox=v?.offsetLeft||0,oy=v?.offsetTop||0;
          const vw=v?.width||window.innerWidth,vh=v?.height||window.innerHeight;
          const x=r.left+r.width/2,y=r.top+r.height/2;
          const hit=document.elementFromPoint(x,y);
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
            vw,vh,ox,oy,hit:hit===el||el.contains(hit),
            target:hit?.id||hit?.className||hit?.nodeName};
        });
        console.log('MOBILE CONTROL',selector,JSON.stringify(control));
        assert.ok(control.left>=control.ox-1 && control.right<=control.ox+control.vw+1
          && control.top>=control.oy-1 && control.bottom<=control.oy+control.vh+1,
          'Mobile control '+selector+' is clipped outside the visual viewport');
        assert.ok(control.hit,'Mobile control '+selector+' is not tappable above the 3D canvas');
      }
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
    console.error('Browser diagnostic warnings:',JSON.stringify(diagnostics.slice(-20)));
    await page.screenshot({path:'/tmp/museum-v3-'+device.name+'-failure.png'}).catch(()=>{});
  }finally{await context.close();}
}
await browser.close();
if(fail)process.exit(1);
