const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const assetPath = '/app/dist/dashboard/_nuxt/15iKeOIE.js';
const runtimePath = path.join(path.dirname(assetPath), '_r28SxnQ.js');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const source = fs.readFileSync(assetPath, 'utf8');
const anchor = 'await t.getQR(e.session.server.id,e.session.name)));return(c,u)=>';
const replacement = 'await t.getQR(e.session.server.id,e.session.name)));const qrRefreshTimer=setInterval(()=>{if(!o.value)a()},5000);Ki(()=>clearInterval(qrRefreshTimer));he(i,error=>{if(error)n.value=null});return(c,u)=>';

// These aliases belong to the pinned dashboard build: Ki is onUnmounted.
if (!source.includes('a3 as Ki') || !runtime.includes('wo=u2("um")') ||
    !runtime.includes('wo as a3') || source.split(anchor).length !== 2) {
  throw new Error('Dashboard QR component changed; review the refresh patch');
}

fs.writeFileSync(assetPath, source.replace(anchor, replacement));
execFileSync(process.execPath, ['--check', assetPath], { stdio: 'inherit' });

function replaceOnce(file, before, after) {
  const contents = fs.readFileSync(file, 'utf8');
  if (contents.split(before).length !== 2) {
    throw new Error(`Expected exactly one recovery anchor in ${file}`);
  }
  fs.writeFileSync(file, contents.replace(before, after));
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

replaceOnce('/app/dist/core/engines/gows/session.gows.core.js',
  "this.logger.warn(data, 'Failed QR item event');\n                this.status = enums_dto_1.WAHASessionStatus.FAILED;",
  "this.logger.warn(data, 'Failed QR item event');\n                this.setStatus(enums_dto_1.WAHASessionStatus.FAILED, { reason: { event: data.Event === 'timeout' ? 'qr.timeout' : data.Event } });");
replaceOnce('/app/dist/core/manager.core.js',
  'this.sessions[name] = session;\n        this.updateSessions();',
  "this.sessions[name] = session;\n        this.updateSessions();\n        require('/app/qr-timeout-recovery.cjs').attach(this, session, logger);");
