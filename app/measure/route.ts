import { NextResponse } from "next/server";

/**
 * Standalone HTML measure page — no React layout.
 * iOS Measure–style: first point stays “in the scene” (screen position follows tilt);
 * second point is always the center reticle until you tap to lock.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#1a1a1a" />
  <title>Measure — AgriFlow</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; background: #000; color: #fff; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.25rem; background: #f0f4f1; color: #1a2e24; }
    .card { width: 100%; max-width: 22rem; background: #fff; border-radius: 1.5rem; padding: 2rem; box-shadow: 0 12px 40px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 1.35rem; margin-bottom: 0.5rem; font-weight: 700; }
    .sub { color: #5c7268; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.45; }
    .btn { border: none; border-radius: 9999px; padding: 0.95rem 1rem; font-size: 1rem; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #22c55e; color: #fff; width: 100%; }
    .btn-primary:active { background: #16a34a; }
    .hidden { display: none !important; }
    .note { font-size: 0.68rem; color: #94a3af; margin-top: 1rem; line-height: 1.4; }
    #camRoot { position: fixed; inset: 0; background: #000; z-index: 50; display: flex; flex-direction: column; }
    .camStage { flex: 1; position: relative; min-height: 0; background: #000; }
    #vid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    #hud { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
    #touchLayer { position: absolute; inset: 0; z-index: 10; touch-action: none; }
    #topBar { position: absolute; top: 0; left: 0; right: 0; padding: max(16px, env(safe-area-inset-top)) 16px 12px; z-index: 20; display: flex; justify-content: space-between; pointer-events: auto; }
    .iconBtn { width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.2); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .hint { position: absolute; top: max(64px, env(safe-area-inset-top)); left: 0; right: 0; text-align: center; color: #fff; font-size: 15px; font-weight: 500; text-shadow: 0 1px 4px #000; pointer-events: none; z-index: 15; padding: 0 24px; }
    #dock { flex-shrink: 0; padding: 12px 24px max(20px, env(safe-area-inset-bottom)); z-index: 25; display: flex; align-items: center; justify-content: space-between; gap: 16px; pointer-events: auto; background: rgba(0,0,0,0.65); border-top: 1px solid rgba(255,255,255,0.1); }
    .dockHint { flex: 1; text-align: center; font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 500; }
    .dockSide { width: 52px; height: 52px; border-radius: 50%; background: rgba(60,60,60,0.9); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 20px; display: flex; align-items: center; justify-content: center; }
    #result { background: #f0f4f1; color: #1a2e24; }
    #result .card { background: #fff; }
    .big { font-size: 2rem; font-weight: 800; color: #15803d; margin: 0.5rem 0 1rem; }
    input.h { width: 100%; padding: 1rem; font-size: 1.75rem; font-weight: 700; text-align: center; border: 2px solid #e2e8f0; border-radius: 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <div id="intro" class="wrap">
    <div class="card">
      <h1>Measure Plant Height</h1>
      <p class="sub">Tap the <strong>base</strong> of your plant on screen, then tap the <strong>top</strong>. The camera will freeze and show the measured height.</p>
      <button type="button" class="btn btn-primary" id="btnStart">Start Measurement</button>
      <p class="note">Chrome or Safari over HTTPS (ngrok).</p>
    </div>
  </div>

  <div id="camRoot" class="hidden">
    <div class="camStage">
      <video id="vid" playsinline muted autoplay></video>
      <canvas id="hud"></canvas>
      <div id="touchLayer"></div>
    </div>
    <div id="topBar">
      <button type="button" class="iconBtn" id="btnClose" aria-label="Close">×</button>
      <button type="button" class="iconBtn" id="btnTrash" aria-label="Clear">⌫</button>
    </div>
    <div id="hint" class="hint">Tap the <strong>base</strong> of your plant</div>
    <div id="dock">
      <button type="button" class="dockSide" id="btnUndo" title="Undo" aria-label="Undo">↶</button>
      <div class="dockHint">① Tap base · ② Tap top of plant</div>
      <button type="button" class="dockSide" id="btnTrashDock" title="Clear" aria-label="Clear">⌫</button>
    </div>
    <div id="freezeOverlay" class="hidden" style="position:absolute;bottom:0;left:0;right:0;z-index:30;padding:20px 24px max(20px,env(safe-area-inset-bottom));background:rgba(0,0,0,0.75);border-top:1px solid rgba(255,255,255,0.15);text-align:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
      <p style="font-size:2rem;font-weight:800;color:#22c55e;margin-bottom:4px;" id="freezeVal">— cm</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:16px;">Estimated plant height</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button type="button" class="btn btn-primary" id="btnFreezeSync" style="flex:1;max-width:160px;">Sync</button>
        <button type="button" class="btn" id="btnFreezeRetry" style="flex:1;max-width:160px;background:#fff;color:#1a2e24;">Retry</button>
      </div>
    </div>
  </div>

  <div id="result" class="wrap hidden">
    <div class="card">
      <h1>Length</h1>
      <p class="big"><span id="heightVal">—</span> cm</p>
      <p class="sub">Estimate from camera. Sync to your dashboard or retry.</p>
      <button type="button" class="btn btn-primary" id="btnSync">Sync</button>
      <button type="button" class="btn btn-primary" id="btnRetry" style="margin-top:10px;background:#ecfdf5;color:#166534;">Retry</button>
    </div>
  </div>

  <div id="manual" class="wrap hidden">
    <div class="card">
      <h1>Manual height</h1>
      <p class="sub" id="manualWhy">Camera unavailable.</p>
      <input type="number" class="h" id="manualInput" inputmode="decimal" placeholder="0" />
      <button type="button" class="btn btn-primary" id="btnManualSend">Send</button>
      <button type="button" class="btn btn-primary" id="btnManualBack" style="margin-top:10px;background:#f1f5f9;color:#334155;">Back</button>
    </div>
  </div>

  <div id="done" class="wrap hidden" style="background:#15803d;color:#fff;">
    <div class="card" style="background:transparent;box-shadow:none;color:#fff;">
      <h1>Synced</h1>
      <p class="sub" style="color:#dcfce7;">You can close this tab.</p>
    </div>
  </div>

<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session_id') || '';
  var plantId = params.get('plant_id') || 'unknown';
  var stream = null;
  var points = [];
  var liveStart = null;
  var liveStartSmooth = null;
  var orientBase = null;
  var needOrientBase = false;
  var orientSupported = false;
  var onOrientFn = null;
  var onMoveFn = null;
  var lastPanClient = null;
  var lastRealTouchUpAt = -1e9;
  var starting = false;
  var hud = null, hudCtx = null;
  var CM_SCALE = 0.2;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function getStageSize() {
    var stage = document.querySelector('.camStage');
    if (!stage) return { rw: 0, rh: 0 };
    return { rw: stage.clientWidth, rh: stage.clientHeight };
  }

  /** Reticle center in the given element's local coords (stage vs layer rects can differ). */
  function getReticleCenterInLayer(layer) {
    var stage = document.querySelector('.camStage');
    if (!layer || !stage) {
      var s = getStageSize();
      return { x: s.rw / 2, y: s.rh * 0.42 };
    }
    var sr = stage.getBoundingClientRect();
    var lr = layer.getBoundingClientRect();
    return {
      x: sr.left + sr.width / 2 - lr.left,
      y: sr.top + sr.height * 0.42 - lr.top,
    };
  }

  function $(id) { return document.getElementById(id); }
  function showEl(el) { if (el) el.classList.remove('hidden'); }

  function showScreen(name) {
    ['intro', 'camRoot', 'result', 'manual', 'done'].forEach(function (x) {
      var el = $(x);
      if (el) el.classList.add('hidden');
    });
    if (name === 'cam') showEl($('camRoot'));
    else if ($(name)) showEl($(name));
  }

  function stopCam() {
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    var v = $('vid');
    if (v) v.srcObject = null;
  }

  function resizeHud() {
    var stage = document.querySelector('.camStage');
    if (!hud || !stage || $('camRoot').classList.contains('hidden')) return;
    var r = stage.getBoundingClientRect();
    hud.width = Math.floor(r.width * (window.devicePixelRatio || 1));
    hud.height = Math.floor(r.height * (window.devicePixelRatio || 1));
    hud.style.width = r.width + 'px';
    hud.style.height = r.height + 'px';
    redrawHud();
  }

  function redrawHud() {
    if (!hudCtx || !hud) return;
    var dpr = window.devicePixelRatio || 1;
    var w = hud.width, h = hud.height;
    hudCtx.setTransform(1,0,0,1,0,0);
    hudCtx.clearRect(0, 0, w, h);
    hudCtx.scale(dpr, dpr);
    var rw = hud.clientWidth, rh = hud.clientHeight;
    var cR = getReticleCenterInLayer(hud);
    var cx = cR.x, cy = cR.y;

    if (points.length === 0) {
      hudCtx.strokeStyle = 'rgba(255,255,255,0.95)';
      hudCtx.lineWidth = 2;
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, 52, 0, Math.PI * 2);
      hudCtx.stroke();
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, 4, 0, Math.PI * 2);
      hudCtx.fillStyle = '#fff';
      hudCtx.fill();
    }

    if (points.length === 1) {
      var p0 = points[0];
      var rc = liveStart || { x: cx, y: cy };
      // Moving white reticle (endpoint aimer) — draw first
      hudCtx.strokeStyle = 'rgba(255,255,255,0.95)';
      hudCtx.lineWidth = 2;
      hudCtx.beginPath();
      hudCtx.arc(rc.x, rc.y, 52, 0, Math.PI * 2);
      hudCtx.stroke();
      hudCtx.beginPath();
      hudCtx.arc(rc.x, rc.y, 4, 0, Math.PI * 2);
      hudCtx.fillStyle = '#fff';
      hudCtx.fill();
      // Dashed line from fixed start to moving reticle
      var lineDx = rc.x - p0.x, lineDy = rc.y - p0.y;
      var lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
      if (lineLen >= 2) {
        hudCtx.setLineDash([12, 10]);
        hudCtx.strokeStyle = 'rgba(255,255,255,0.9)';
        hudCtx.lineWidth = 2.5;
        hudCtx.beginPath();
        hudCtx.moveTo(p0.x, p0.y);
        hudCtx.lineTo(rc.x, rc.y);
        hudCtx.stroke();
        hudCtx.setLineDash([]);
      }
      // Green start dot — FIXED, drawn LAST on top
      hudCtx.beginPath();
      hudCtx.arc(p0.x, p0.y, 16, 0, Math.PI * 2);
      hudCtx.fillStyle = 'rgba(34,197,94,0.4)';
      hudCtx.fill();
      hudCtx.beginPath();
      hudCtx.arc(p0.x, p0.y, 10, 0, Math.PI * 2);
      hudCtx.fillStyle = '#22c55e';
      hudCtx.fill();
      hudCtx.strokeStyle = '#fff';
      hudCtx.lineWidth = 3;
      hudCtx.stroke();
    }
    if (points.length >= 2) {
      var p0 = points[0], p1 = points[1];
      drawMeasureLine(hudCtx, p0.x, p0.y, p1.x, p1.y, true);
    }
  }

  /** iOS Measure: small dot at moving “world” start, large reticle at center = second point. */
  function drawPhase2Preview(ctx, sx, sy, ex, ey) {
    var dx = ex - sx, dy = ey - sy;
    var len = Math.sqrt(dx * dx + dy * dy);
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (len >= 2) {
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  function drawMeasureLine(ctx, x0, y0, x1, y1, done) {
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 8) return;
    var ux = dx / len, uy = dy / len;
    var px = -uy, py = ux;

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    var tickEvery = 12;
    for (var d = tickEvery; d < len - tickEvery; d += tickEvery) {
      var bx = x0 + ux * d, by = y0 + uy * d;
      var major = (Math.floor(d / tickEvery) % 5 === 0);
      var tl = major ? 14 : 7;
      ctx.beginPath();
      ctx.moveTo(bx - px * tl / 2, by - py * tl / 2);
      ctx.lineTo(bx + px * tl / 2, by + py * tl / 2);
      ctx.stroke();
      if (major) {
        ctx.font = '600 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 3;
        var label = String(Math.floor(d / tickEvery) * 2);
        var lx = bx + px * 16, ly = by + py * 16;
        ctx.strokeText(label, lx, ly);
        ctx.fillText(label, lx, ly);
      }
    }

    function node(x, y) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    node(x0, y0);
    if (done) node(x1, y1);

    if (done) {
      var dyPx = Math.abs(y1 - y0);
      var cm = Math.max(1, Math.round(dyPx * CM_SCALE));
      var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      var txt = cm + ' cm';
      ctx.font = '700 17px system-ui, -apple-system, sans-serif';
      var tw = ctx.measureText(txt).width;
      var pad = 14, bw = tw + pad * 2, bh = 36;
      var rr = bh / 2;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + rr, -bh / 2);
      ctx.lineTo(bw / 2 - rr, -bh / 2);
      ctx.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + rr);
      ctx.lineTo(bw / 2, bh / 2 - rr);
      ctx.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - rr, bh / 2);
      ctx.lineTo(-bw / 2 + rr, bh / 2);
      ctx.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - rr);
      ctx.lineTo(-bw / 2, -bh / 2 + rr);
      ctx.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + rr, -bh / 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
  }

  function setHint() {
    var h = $('hint');
    if (!h) return;
    if (points.length === 0) {
      h.innerHTML = 'Aim the <strong>center dot</strong> at the base, then <strong>tap</strong>';
    } else if (points.length === 1) {
      h.innerHTML = 'Move phone — aim center dot at top, then <strong>tap</strong>';
    } else h.innerHTML = '';
  }

  function updatePreviewFromOrient(e) {
    if (points.length !== 1 || !hud) return;
    var s = getStageSize();
    var rw = s.rw, rh = s.rh;
    var layer = $('touchLayer');
    var center = getReticleCenterInLayer(layer || hud);
    if (needOrientBase && e.beta != null) {
      orientBase = { g: e.gamma || 0, b: e.beta || 0 };
      needOrientBase = false;
      liveStartSmooth = { x: center.x, y: center.y };
      lastPanClient = null;
    }
    if (!orientBase) {
      liveStart = { x: center.x, y: center.y };
      redrawHud();
      return;
    }
    var dg = (e.gamma != null ? e.gamma : 0) - orientBase.g;
    var db = (e.beta != null ? e.beta : 0) - orientBase.b;
    var scaleX = 11;
    var scaleY = 22;
    var tx = clamp(center.x - dg * scaleX, 12, rw - 12);
    var ty = clamp(center.y + db * scaleY, 12, rh - 12);
    if (!liveStartSmooth) {
      liveStartSmooth = { x: tx, y: ty };
    } else {
      liveStartSmooth.x += (tx - liveStartSmooth.x) * 0.26;
      liveStartSmooth.y += (ty - liveStartSmooth.y) * 0.26;
    }
    liveStart = { x: liveStartSmooth.x, y: liveStartSmooth.y };
    redrawHud();
  }

  function handlePointerUp(e) {
    e.preventDefault();
    if (e.isPrimary === false) return;
    if (e.button !== 0 && e.button !== undefined) return;
    var now = Date.now();
    if (e.pointerType === 'mouse' && now - lastRealTouchUpAt < 450) {
      return;
    }
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      lastRealTouchUpAt = now;
    }
    var layer = $('touchLayer');
    if (!layer) return;

    if (points.length === 0) {
      resizeHud();
      var c = getReticleCenterInLayer(layer);
      points.push({ x: c.x, y: c.y });
      liveStart = { x: c.x, y: c.y };
      liveStartSmooth = { x: c.x, y: c.y };
      needOrientBase = true;
      orientBase = null;
      lastPanClient = null;

      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (st) {
          orientSupported = st === 'granted';
          setHint();
          redrawHud();
        }).catch(function () { orientSupported = false; setHint(); });
      } else {
        orientSupported = typeof DeviceOrientationEvent !== 'undefined';
      }
      setHint();
      redrawHud();
      return;
    }

    if (points.length === 1) {
      var rc = liveStart || getReticleCenterInLayer(layer);
      points.push({ x: rc.x, y: rc.y });
      setHint();
      redrawHud();
      $('vid').pause();
      var dy = Math.abs(points[1].y - points[0].y);
      var cm = Math.max(1, Math.round(dy * CM_SCALE));
      $('freezeVal').textContent = cm + ' cm';
      showEl($('freezeOverlay'));
    }
  }

  function detachMeasureListeners() {
    if (onOrientFn) {
      window.removeEventListener('deviceorientation', onOrientFn, true);
      onOrientFn = null;
    }
    var tl = $('touchLayer');
    if (tl) {
      tl.removeEventListener('pointerup', handlePointerUp, { capture: true });
      if (onMoveFn) {
        tl.removeEventListener('pointermove', onMoveFn);
        onMoveFn = null;
      }
    }
    needOrientBase = false;
    orientBase = null;
    liveStart = null;
    liveStartSmooth = null;
    lastPanClient = null;
  }

  function undoPoint() {
    if (points.length > 0) points.pop();
    liveStart = null;
    liveStartSmooth = null;
    orientBase = null;
    needOrientBase = false;
    $('freezeOverlay').classList.add('hidden');
    try { $('vid').play(); } catch(e) {}
    setHint();
    redrawHud();
  }

  function clearPoints() {
    points = [];
    liveStart = null;
    liveStartSmooth = null;
    orientBase = null;
    needOrientBase = false;
    $('freezeOverlay').classList.add('hidden');
    try { $('vid').play(); } catch(e) {}
    setHint();
    redrawHud();
  }

  async function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('No camera API. Use HTTPS in Chrome/Safari.');
    }
    var tries = [
      { video: { facingMode: 'environment' }, audio: false },
      { video: true, audio: false }
    ];
    var last = null;
    for (var i = 0; i < tries.length; i++) {
      try { return await navigator.mediaDevices.getUserMedia(tries[i]); } catch (e) { last = e; }
    }
    throw last || new Error('Camera failed');
  }

  function startFlow(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    if (starting) return;
    starting = true;
    openCamera().then(function (s) {
      stream = s;
      var v = $('vid');
      v.srcObject = s;
      v.muted = true;
      v.setAttribute('playsinline', '');
      return v.play();
    }).then(function () {
      detachMeasureListeners();
      points = [];
      liveStart = null;
      liveStartSmooth = null;
      orientSupported = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'undefined';
      showScreen('cam');
      hud = $('hud');
      hudCtx = hud.getContext('2d');
      var tl = $('touchLayer');
      tl.addEventListener('pointerup', handlePointerUp, { capture: true, passive: false });

      onOrientFn = function (ev) { updatePreviewFromOrient(ev); };
      window.addEventListener('deviceorientation', onOrientFn, true);

      onMoveFn = function (me) {
        if (points.length !== 1 || !hud || !liveStart) return;
        if (orientSupported && orientBase) return;
        if (!lastPanClient) {
          lastPanClient = { x: me.clientX, y: me.clientY };
          return;
        }
        var dx = me.clientX - lastPanClient.x;
        var dy = me.clientY - lastPanClient.y;
        lastPanClient = { x: me.clientX, y: me.clientY };
        if (dx === 0 && dy === 0) return;
        var rw2 = hud.clientWidth, rh2 = hud.clientHeight;
        liveStart.x = clamp(liveStart.x + dx, 12, rw2 - 12);
        liveStart.y = clamp(liveStart.y + dy, 12, rh2 - 12);
        liveStartSmooth = { x: liveStart.x, y: liveStart.y };
        redrawHud();
      };
      tl.addEventListener('pointermove', onMoveFn, { passive: true });

      window.addEventListener('resize', resizeHud);
      window.addEventListener('orientationchange', function () { setTimeout(resizeHud, 300); });
      setTimeout(resizeHud, 100);
      setHint();
      redrawHud();
    }).catch(function (err) {
      console.error(err);
      $('manualWhy').textContent = (err && err.message) ? err.message : 'Camera error';
      showScreen('manual');
    }).finally(function () { starting = false; });
  }

  $('btnStart').addEventListener('click', startFlow);

  $('btnClose').onclick = function () {
    stopCam();
    detachMeasureListeners();
    window.removeEventListener('resize', resizeHud);
    showScreen('intro');
    clearPoints();
  };
  $('btnTrash').onclick = function () { clearPoints(); };
  var td = $('btnTrashDock');
  if (td) td.onclick = function () { clearPoints(); };
  $('btnUndo').onclick = function (e) { e.stopPropagation(); undoPoint(); };

  $('btnRetry').onclick = function () {
    clearPoints();
    stopCam();
    detachMeasureListeners();
    window.removeEventListener('resize', resizeHud);
    window.setTimeout(function () { startFlow(); }, 80);
  };
  $('btnManualBack').onclick = function () { showScreen('intro'); };

  function postHeight(cm) {
    if (!sessionId) { alert('Missing session_id.'); return; }
    fetch('/api/measurement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, plant_id: plantId, height_cm: cm })
    }).then(function (r) { if (!r.ok) throw new Error('Sync failed'); showScreen('done'); })
      .catch(function (e) { alert(e.message || 'Network error'); });
  }
  $('btnSync').onclick = function () { postHeight(Number($('heightVal').textContent)); };
  $('btnFreezeSync').onclick = function () { postHeight(parseInt($('freezeVal').textContent)); };
  $('btnFreezeRetry').onclick = function () {
    $('freezeOverlay').classList.add('hidden');
    clearPoints();
    try { $('vid').play(); } catch(e) {}
    setHint();
    redrawHud();
  };
  $('btnManualSend').onclick = function () { postHeight(Number($('manualInput').value)); };
})();
<\/script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
