const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE || '/home/codex/tools/browser-tests/node_modules/playwright');
const repo = process.env.REVIEW_REPO || process.cwd();
const darwin = process.platform === 'darwin';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vacuumtube-native-review-'));
const id = 'dQw4w9WgXcQ';
const copy = darwin ? 'Meta+c' : 'Control+Shift+c';
let app;
const failures=[];
(async () => {
 app = await electron.launch({ executablePath: require(path.join(repo, 'node_modules/electron')), args: [repo, '--no-sandbox', '--portable', profile, '--deeplink', `https://www.youtube.com/watch?v=${id}`] });
 const page = await app.firstWindow();
 page.on('pageerror', error => console.log('PAGE_ERROR:', error.message));
 await page.waitForFunction(() => window.yt?.player?.utils?.videoElement_ && document.body.classList.contains('WEB_PAGE_TYPE_WATCH'), { timeout: 60000 });
 await page.waitForTimeout(1500);
 app.process().stdout.on('data', b => process.stdout.write(b));
 await app.evaluate(({ app, BrowserWindow }) => {
  app.on('before-quit',()=>console.log('REVIEW_BEFORE_QUIT'));
  for(const win of BrowserWindow.getAllWindows()) {
   win.webContents.on('before-input-event',(e,i)=>console.log('NATIVE_INPUT',i.type,i.key,i.meta,i.control));
   win.webContents.on('will-prevent-unload',()=>console.log('REVIEW_UNLOAD_BLOCKED'));
  }
 });
 const press = chord => app.evaluate(({BrowserWindow}, chord) => {
  const parts=chord.toLowerCase().split('+'); const key=parts.pop();
  const modifiers=parts.map(p=>p==='control'?'control':p);
  const win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());win.focus();win.webContents.focus();
  win.webContents.sendInputEvent({type:'keyDown',keyCode:key.toUpperCase(),modifiers});
  if(!win.isDestroyed())win.webContents.sendInputEvent({type:'keyUp',keyCode:key.toUpperCase(),modifiers});
 },chord);
 const read = () => app.evaluate(({clipboard}) => clipboard.readText());
 const write = text => app.evaluate(({clipboard}, text) => clipboard.writeText(text), text);
 async function check(name, fn) { try { await fn(); console.log('PASS:', name); } catch(e) { failures.push(name); console.error('FAIL:',name,e.message); } }
 async function expectClipboard(value) {
  for (let n=0;n<30;n++) { if (await read() === value) return; await page.waitForTimeout(100); }
  assert.equal(await read(), value);
 }
 console.log('PLATFORM:', process.platform);
 console.log('ACTUAL_VIDEO:', await page.evaluate(() => ({uri:window.yt.player.utils.videoElement_.baseURI, duration:String(window.yt.player.utils.videoElement_.duration), live:document.querySelector('.html5-video-player')?.getVideoData?.()?.isLive})));
 await check('copy actual TV video through production shortcut and native clipboard', async () => {
  await write('sentinel'); await press(copy); await expectClipboard(`https://youtu.be/${id}`);
 });
 if (darwin) {
  await check('timestamp uses current second on actual TV hash route', async () => {
   await page.evaluate(() => { const v=window.yt.player.utils.videoElement_; Object.defineProperties(v,{currentTime:{value:83.9,configurable:true},duration:{value:300,configurable:true}}); });
   await press('Meta+Shift+c'); await expectClipboard(`https://youtu.be/${id}?t=83`);
  });
 }
 await page.evaluate(() => {
  const root=document.createElement('div'); root.id='review-controls'; root.style='position:fixed;z-index:2147483647;top:0;left:0;background:white;color:black';
  root.innerHTML='<input id="review-input" value="input selection"><textarea id="review-textarea">textarea selection</textarea><div id="review-editable" contenteditable>editable selection</div><p id="review-text">page selection</p><div id="review-shadow"></div>';
  document.body.append(root); for(const el of [root,...root.querySelectorAll('*')])el.style.setProperty('user-select','text','important');
  root.querySelector('#review-shadow').attachShadow({mode:'open'}).innerHTML='<input value="shadow selection">';
 });
 for (const [selector, expected] of [['#review-input','input selection'],['#review-textarea','textarea selection'],['#review-editable','editable selection'],['#review-text','page selection'],['#review-shadow input','shadow selection']]) {
  await check(`native text copy ${selector}`, async () => {
   await page.locator(selector).evaluate(el => { document.getSelection().removeAllRanges(); if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement){el.focus();el.select();}else{ el.focus();const range=document.createRange();range.selectNodeContents(el);document.getSelection().addRange(range); } });
   console.log('SELECTION:',await page.evaluate(()=>({active:document.activeElement.id,editable:document.activeElement.isContentEditable,selected:String(document.getSelection()),userSelect:getComputedStyle(document.activeElement).userSelect})));
   await write('sentinel'); await press(darwin ? 'Meta+c':'Control+c'); await expectClipboard(expected);
  });
 }
 await check('focused input without selection preserves clipboard', async () => {
  await page.locator('#review-input').evaluate(el=>{document.getSelection().removeAllRanges();el.focus();el.setSelectionRange(0,0)});
  await write('sentinel');await press(darwin?'Meta+c':'Control+c'); await page.waitForTimeout(200);assert.equal(await read(),'sentinel');
 });
 await page.evaluate(()=>{document.querySelector('#review-controls').remove();document.getSelection().removeAllRanges();document.activeElement.blur()});
 if (darwin) {
  await check('copy then Command-Q exits the real app', async () => {
   let beforeQuit=false;
   app.process().stdout.on('data', b=>{if(b.toString().includes('REVIEW_BEFORE_QUIT'))beforeQuit=true});
   await app.evaluate(({app})=>app.on('before-quit',()=>console.log('REVIEW_BEFORE_QUIT')));
   await press('Meta+c');
   const closed=app.waitForEvent('close',{timeout:10000});
   await press('Meta+q').catch(()=>{});await closed;assert.equal(beforeQuit,true);app=null;
  });
 }
 assert.deepEqual(failures,[]);console.log('NATIVE_REVIEW_PASSED');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(app)await app.close().catch(()=>{});fs.rmSync(profile,{recursive:true,force:true})});
