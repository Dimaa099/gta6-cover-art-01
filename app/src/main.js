// Neon Coast Cover Studio — page wiring: state, controls, drag-to-pan,
// zoom, PNG export, and the ?shot= screenshot scenes (see shots.js).
// Everything runs offline: photos are local files or the vendored samples,
// fonts are vendored, no network request is ever made.

import { GRADES, LAYOUTS, SIZES, drawCoverArt, freshPanels, panelPhoto, panelRects } from './cover.js';
import { readShotScene, signalShotReady } from './shots.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const statusEl = $('status');

// ---- state ---------------------------------------------------------------
const state = {
  layout: 'grid9',
  grade: 'sunset',
  size: 'square',
  title: 'NEON COAST',
  subtitle: 'sunset heist in the city of lights',
  badge: 'HEAT',
  stars: 5,
  mode: 'mix',
  photos: [],
  panels: freshPanels(),
  selected: 0,
};

const SAMPLES = [
  { url: 'samples/boulevard.jpg', name: 'Boulevard sample' },
  { url: 'samples/pier.jpg', name: 'Pier sample' },
];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function addSample(sample) {
  if (state.photos.some((p) => p.name === sample.name)) return;
  const img = await loadImage(sample.url);
  state.photos.push({ img, name: sample.name });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      await addSample(s);
    } catch (err) {
      statusEl.textContent = `Sample photo missing: ${s.url}`;
    }
  }
  refreshPhotoLine();
}

// ---- rendering -----------------------------------------------------------
// The preview canvas always holds the export pixels for the chosen size,
// scaled down by CSS; exports draw the same art onto a fresh canvas.
function drawPreview() {
  const [w, h] = SIZES[state.size];
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
  }
  const ctx = stage.getContext('2d');
  drawCoverArt(ctx, w, h, state, state.selected);
  refreshPanelControls();
}

let rafQueued = false;
function scheduleDraw() {
  if (rafQueued) return;
  rafQueued = true;
  requestAnimationFrame(() => {
    rafQueued = false;
    drawPreview();
  });
}

// A fresh canvas with the finished cover at one of the three export sizes.
export function exportSize(sizeId) {
  const [w, h] = SIZES[sizeId] || SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCoverArt(canvas.getContext('2d'), w, h, state, -1);
  return canvas;
}

function download(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed — the browser refused the PNG.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved ${filename} (${canvas.width} × ${canvas.height})`;
  }, 'image/png');
}

// ---- controls ------------------------------------------------------------
function refreshPhotoLine() {
  $('photoLine').textContent =
    state.photos.length === 0
      ? 'No photos yet — load the samples or add your own.'
      : `${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} loaded: ` +
        state.photos.map((p) => p.name).join(' · ');
}

function refreshPanelControls() {
  const crop = state.panels[state.selected] || { zoom: 1 };
  $('zoom').value = String(crop.zoom || 1);
  $('zoomVal').textContent = `${Number(crop.zoom || 1).toFixed(2)}×`;
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${LAYOUTS[state.layout].panels}`;
}

function markPressed(container, activeKey) {
  for (const btn of container.querySelectorAll('button[data-key]')) {
    const on = btn.dataset.key === activeKey;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
}

function buildPicker(container, table, current, onPick) {
  for (const [key, entry] of Object.entries(table)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = key;
    btn.textContent = entry.label;
    btn.addEventListener('click', () => {
      onPick(key);
      markPressed(container, key);
      scheduleDraw();
    });
    container.appendChild(btn);
  }
  markPressed(container, current);
}

buildPicker($('layoutBtns'), LAYOUTS, state.layout, (key) => {
  state.layout = key;
  state.selected = 0;
  statusEl.textContent = `Layout: ${LAYOUTS[key].label}`;
});
buildPicker($('gradeBtns'), GRADES, state.grade, (key) => {
  state.grade = key;
  statusEl.textContent = `Grade: ${GRADES[key].label}`;
});

for (const radio of document.querySelectorAll('input[name="size"]')) {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    state.size = radio.value;
    scheduleDraw();
  });
}

$('title').addEventListener('input', (e) => { state.title = e.target.value; scheduleDraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; scheduleDraw(); });
$('badge').addEventListener('input', (e) => { state.badge = e.target.value; scheduleDraw(); });
$('stars').addEventListener('input', (e) => {
  state.stars = Number(e.target.value);
  $('starsVal').textContent = `${state.stars} ★`;
  scheduleDraw();
});
$('mode').addEventListener('change', (e) => { state.mode = e.target.value; scheduleDraw(); });

$('zoom').addEventListener('input', (e) => {
  const crop = state.panels[state.selected];
  crop.zoom = Number(e.target.value);
  $('zoomVal').textContent = `${crop.zoom.toFixed(2)}×`;
  scheduleDraw();
});
$('swapPhoto').addEventListener('click', () => {
  const crop = state.panels[state.selected];
  crop.photo = crop.photo < 0 ? 0 : crop.photo + 1 >= state.photos.length ? -1 : crop.photo + 1;
  statusEl.textContent = crop.photo < 0
    ? `Panel ${state.selected + 1} follows the photo mode again.`
    : `Panel ${state.selected + 1} now uses ${state.photos[crop.photo].name}.`;
  scheduleDraw();
});
$('resetPans').addEventListener('click', () => {
  state.panels = freshPanels();
  statusEl.textContent = 'Panel crops reset — faces sit near the top again.';
  scheduleDraw();
});

$('photoFile').addEventListener('change', async (e) => {
  for (const file of e.target.files || []) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push({ img, name: file.name });
    } catch {
      statusEl.textContent = `Could not read ${file.name} as a photo.`;
    }
  }
  e.target.value = '';
  refreshPhotoLine();
  scheduleDraw();
});
$('loadSamples').addEventListener('click', async () => {
  await loadSamples();
  statusEl.textContent = 'Sample photos loaded.';
  scheduleDraw();
});

$('exportBtn').addEventListener('click', () => {
  const [w, h] = SIZES[state.size];
  download(exportSize(state.size), `neon-coast-${state.size}-${w}x${h}.png`);
});
$('exportAllBtn').addEventListener('click', () => {
  let i = 0;
  for (const id of Object.keys(SIZES)) {
    const [w, h] = SIZES[id];
    setTimeout(() => download(exportSize(id), `neon-coast-${id}-${w}x${h}.png`), i * 350);
    i += 1;
  }
  statusEl.textContent = 'Exporting all three sizes…';
});

// ---- drag to pan / scroll to zoom ----------------------------------------
// Pointer coordinates are mapped from CSS pixels to canvas pixels; the pan
// update moves the photo by the dragged distance, divided by the overflow
// the panel actually has, so dragging feels 1:1 and can never push the
// photo out of its panel (the draw step clamps the offset).
function canvasPoint(e) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * stage.width,
    y: ((e.clientY - rect.top) / rect.height) * stage.height,
  };
}

function hitPanel(p) {
  const [w, h] = SIZES[state.size];
  const rects = panelRects(state.layout, w, h, Math.round(h * 0.21));
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
stage.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = hitPanel(p);
  if (hit < 0) return;
  state.selected = hit;
  const [w, h] = SIZES[state.size];
  const rects = panelRects(state.layout, w, h, Math.round(h * 0.21));
  drag = { panel: hit, last: p, rect: rects[hit] };
  stage.setPointerCapture(e.pointerId);
  scheduleDraw();
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const crop = state.panels[drag.panel];
  const photo = panelPhoto(state, drag.panel);
  const dx = p.x - drag.last.x;
  const dy = p.y - drag.last.y;
  drag.last = p;
  if (!photo) return;
  const base = Math.max(drag.rect.w / photo.img.naturalWidth, drag.rect.h / photo.img.naturalHeight);
  const scale = base * (crop.zoom || 1);
  const ox = Math.max(0, photo.img.naturalWidth * scale - drag.rect.w);
  const oy = Math.max(0, photo.img.naturalHeight * scale - drag.rect.h);
  if (ox > 0) crop.panX = Math.max(-1, Math.min(1, crop.panX - (dx * 2) / ox));
  if (oy > 0) crop.panY = Math.max(-1, Math.min(1, crop.panY - (dy * 2) / oy));
  scheduleDraw();
});
stage.addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('pointercancel', () => { drag = null; });
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const crop = state.panels[state.selected];
  crop.zoom = Math.max(1, Math.min(2.5, crop.zoom * Math.exp(-e.deltaY * 0.0012)));
  scheduleDraw();
}, { passive: false });

// ---- boot + screenshot scenes --------------------------------------------
// The harness (and the checks below) use this handle: the live photo list,
// the three export sizes, and a function that returns a finished cover.
window.__coverStudio = { state, SIZES, exportSize };

const scene = readShotScene(location.search);

async function boot() {
  await Promise.all([
    document.fonts.load('40px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.ready,
  ]);
  await loadSamples();
  if (scene) {
    state.layout = scene.layout;
    state.grade = scene.grade;
    state.size = scene.size;
    state.title = scene.title;
    state.subtitle = scene.subtitle;
    state.badge = scene.badge;
    state.stars = scene.stars;
    $('title').value = scene.title;
    $('subtitle').value = scene.subtitle;
    $('badge').value = scene.badge;
    $('stars').value = String(scene.stars);
    $('starsVal').textContent = `${scene.stars} ★`;
    for (const radio of document.querySelectorAll('input[name="size"]')) {
      radio.checked = radio.value === scene.size;
    }
    markPressed($('layoutBtns'), scene.layout);
    markPressed($('gradeBtns'), scene.grade);
  }
  if (scene?.kind === 'cover') {
    // Full-frame cover scene: the exported cover, scaled to fit the window.
    document.body.classList.add('shot-cover');
    const [ew, eh] = SIZES[scene.size];
    const cover = exportSize(scene.size);
    stage.width = window.innerWidth;
    stage.height = window.innerHeight;
    const ctx = stage.getContext('2d');
    ctx.fillStyle = '#0b0614';
    ctx.fillRect(0, 0, stage.width, stage.height);
    const s = Math.min(stage.width / ew, stage.height / eh);
    ctx.drawImage(cover, (stage.width - ew * s) / 2, (stage.height - eh * s) / 2, ew * s, eh * s);
    statusEl.textContent = `Cover ${ew} × ${eh} — ${LAYOUTS[scene.layout].label}, ${GRADES[scene.grade].label}`;
  } else {
    drawPreview();
    statusEl.textContent = state.photos.length
      ? 'Live preview — drag a panel to reposition its photo, scroll to zoom.'
      : 'Load the sample photos or add your own to begin.';
  }
  if (scene) signalShotReady();
}

boot();
