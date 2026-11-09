import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const browser=await chromium.launch({
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
let failures=0;
for(const device of [
  {name:'desktop',width:1280,height:800,touch:false},
  {name:'mobile',width:390,height:844,touch:true}
]){
  const ctx=await browser.newContext({
    viewport:{width:device.width,height:device.height},
    hasTouch:device.touch,isMobile:device.touch,
    deviceScaleFactor:device.touch?2:1
  });
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
    const url='http://127.0.0.1:8765/empty-museum/blender/reference-room-v12-preview.html';
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response?.status(),200);
    await page.waitForFunction(()=>window.__TEM_V12_READY===true,null,{timeout:90000});
    const report=await page.evaluate(()=>({
      state:document.documentElement.dataset.roomV12,
      model:window.__TEM_V12_STATE,
      width:document.querySelector('#v12Canvas').width,
      height:document.querySelector('#v12Canvas').height
    }));
    assert.equal(report.state,'cycles-baked');
    assert.ok(report.model.surfaces>=1 && report.model.surfaces<=12);
    assert.deepEqual(report.model.room,[9.2,6.4,14]);
    assert.ok(report.width>300 && report.height>300);
    assert.deepEqual(errors,[]);
    const path='/tmp/museum-v12-'+device.name+'.png';
    const screenshot=await page.screenshot({path,timeout:90000});
    const png=PNG.sync.read(screenshot);
    let visible=0,measured=0;
    for(let y=Math.floor(png.height*.20);y<Math.floor(png.height*.77);y+=12){
      for(let x=Math.floor(png.width*.19);x<Math.floor(png.width*.82);x+=12){
        const i=(y*png.width+x)*4;
        const diff=Math.abs(png.data[i]-228)+Math.abs(png.data[i+1]-227)+Math.abs(png.data[i+2]-223);
        if(diff>43)visible++;
        measured++;
      }
    }
    const visibleFraction=visible/measured;
    console.log('V12 VISIBILITY ACCEPTANCE',device.name,visibleFraction);
    assert.ok(visibleFraction>.08,
      'Museum appears empty: 3D camera may be looking away or model not visible');
    console.log('V12 ACTUAL WEBGL RENDER',device.name,path,JSON.stringify(report));
  }catch(e){
    failures++;
    console.error('V12 staging FAILED',device.name,String(e));
    console.error('browser errors',errors);
    await page.screenshot({path:'/tmp/museum-v12-'+device.name+'-failure.png',timeout:10000}).catch(()=>{});
  }finally{await ctx.close();}
}
await browser.close();
if(failures)process.exitCode=1;
