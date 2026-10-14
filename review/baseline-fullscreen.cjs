const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE);
const repo = process.cwd();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vacuumtube-baseline-'));
setTimeout(() => { console.error('Baseline review timed out'); process.exit(1); }, 75000).unref();
(async () => {
 const app = await electron.launch({executablePath: require(path.join(repo, 'node_modules/electron')), args:[repo, '--portable', profile]});
 const page = await app.firstWindow();
 await page.waitForFunction(() => location.host === 'www.youtube.com', null, {timeout:30000});
 await app.evaluate(({app, BrowserWindow}) => { const win=BrowserWindow.getAllWindows()[0]; win.show();app.focus({steal:true});win.focus();win.webContents.focus(); });
 await page.waitForFunction(() => document.hasFocus());
 console.log('BASELINE_FULLSCREEN_RESULT:', await app.evaluate(({BrowserWindow}) => new Promise(resolve => {
  const win=BrowserWindow.getAllWindows()[0];
  const timer=setTimeout(()=>resolve({event:false,isFullScreen:win.isFullScreen()}),15000);
  win.once('enter-full-screen',()=>{clearTimeout(timer);resolve({event:true,isFullScreen:win.isFullScreen()})});
  win.setFullScreen(true);
 })));
 //The diagnostic result is captured even if the OS transition prevents normal exit.
 app.process().kill('SIGKILL');
 fs.rmSync(profile,{recursive:true,force:true});
})().catch(error=>{console.error(error);process.exit(1)});
