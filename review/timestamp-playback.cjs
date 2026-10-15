const assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {_electron:electron}=require(process.env.PLAYWRIGHT_MODULE || '/home/codex/tools/browser-tests/node_modules/playwright');
const repo=process.env.REVIEW_REPO || '/home/codex/Projects/VacuumTube';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vt-timestamp-'));
const packaged=process.env.REVIEW_EXECUTABLE;
const media=fs.readFileSync(path.join(__dirname,'clock.webm')).toString('base64');
const id='dQw4w9WgXcQ';
let app;
setTimeout(()=>{console.error('Timestamp test timed out');process.exit(1)},90000).unref();
(async()=>{
 app=await electron.launch({executablePath:packaged || require(path.join(repo,'node_modules/electron')),args:[...(packaged?[]:[repo]),'--no-sandbox','--portable',profile]});
 const page=await app.firstWindow();
 await page.waitForURL(/^https:\/\/www\.youtube\.com\/tv/);
 page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 await app.context().route('https://www.youtube.com/**', route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><body class="WEB_PAGE_TYPE_WATCH"><div class="html5-video-player"><video muted src="data:video/webm;base64,${media}"></video></div><script>
 window.ytcfg={data_:{HL:'en'}};
 window._yttv={fixture:{instance:{resolveCommand:()=>true}}};
 window.yt={player:{utils:{videoElement_:document.createElement('video')}}};
 document.querySelector('.html5-video-player').getVideoData=()=>({isLive:false,video_id:'${id}'});
 </script></body></html>`}));
 await page.goto(`https://www.youtube.com/tv#/watch?v=${id}`);
 await page.waitForFunction(()=>window.ytcfg && Number.isFinite(document.querySelector('video').duration));
 await page.waitForTimeout(1000);
 await page.evaluate(id=>{location.hash='/watch?v='+id},id);
 await app.evaluate(({app,BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();app.focus({steal:true});w.focus();w.webContents.focus()});
 await page.waitForFunction(()=>document.hasFocus());
 await page.evaluate(()=>document.querySelector('video').play());
 await page.waitForFunction(()=>document.querySelector('video').currentTime>=2);
 await page.evaluate(()=>document.querySelector('video').pause());
 const state=await page.evaluate(()=>({url:location.href,active:document.querySelector('video').currentTime,duration:document.querySelector('video').duration,detached:!window.yt.player.utils.videoElement_.isConnected,templateDuration:String(window.yt.player.utils.videoElement_.duration)}));
 console.log('REAL_MEDIA_STATE',state);
 assert.equal(state.detached,true);assert.equal(state.templateDuration,'NaN');assert.ok(state.active>=2);
 async function copy(shift) {
  await app.evaluate(({clipboard})=>clipboard.writeText('sentinel'));
  await app.evaluate(({BrowserWindow},shift)=>{const w=BrowserWindow.getAllWindows()[0];const modifiers=process.platform==='darwin'?['meta',...(shift?['shift']:[])]:['control','shift'];w.webContents.sendInputEvent({type:'keyDown',keyCode:'C',modifiers});w.webContents.sendInputEvent({type:'keyUp',keyCode:'C',modifiers});},shift);
  for(let i=0;i<30;i++){const value=await app.evaluate(({clipboard})=>clipboard.readText());if(value!=='sentinel')return value;await page.waitForTimeout(100)}
  throw new Error('Clipboard did not change');
 }
 assert.equal(await copy(false),`https://youtu.be/${id}`);
 const timestamp=process.platform==='darwin' && process.env.EXPECT_TIMESTAMP!=='false';
 assert.equal(await copy(true),`https://youtu.be/${id}${timestamp?'?t='+Math.floor(state.active):''}`);
 console.log('PASS: copy actual elapsed playback time with detached global template');
 for(const second of [83.9,0]){
  await page.evaluate(second=>new Promise(resolve=>{const v=document.querySelector('video');v.addEventListener('seeked',resolve,{once:true});v.currentTime=second}),second);
  assert.equal(await copy(true),`https://youtu.be/${id}${timestamp?'?t='+Math.floor(second):''}`);
  console.log('PASS: real media seek and copy',second);
 }
 console.log('TIMESTAMP_PLAYBACK_PASSED');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(app)await app.close().catch(()=>{});fs.rmSync(profile,{recursive:true,force:true})});
