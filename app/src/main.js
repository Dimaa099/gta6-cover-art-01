// Neon Coast Cover Studio — page wiring.
// Loads photos (samples + the user's own files), keeps the editor state, renders
// the live preview, and exports PNGs in 1080x1080, 1080x1350 and 1920x1080.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { GRADES, LAYOUTS, SIZES, drawCover, previewPanels } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

const state = {
  layout: 'grid9',
  grade: 'sunset',
  size: 'wide',
  title: 'NEON COAST',
  subtitle: 'sunset heist in the city of lights',
  photos: [],          // HTMLImageElements, in load order
  photoNames: [],
  panels: [],          // {photo, zoom, ox, oy} per panel of the current layout
  singlePhoto: false,  // one photo across every panel
  frame: true,
  grain: true,
  vignette: true,
  selected: 0,
};

let history = [];
let historyIndex = -1;
let historyTimer = null;

/** Serialises the editable state (photos are kept out: they are re-loaded). */
export function snapshotState() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle, panels: state.panels,
    singlePhoto: state.singlePhoto, frame: state.frame,
    grain: state.grain, vignette: state.vignette, selected: state.selected,
  });
}

/** Pushes the current state onto the undo stack (debounced for drags). */
export function pushHistory() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshotState());
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
    updateUndoButtons();
  }, 250);
}

/** Restores a snapshot taken by snapshotState(). */
export function restoreSnapshot(json) {
  const s = JSON.parse(json);
  Object.assign(state, s);
  ensurePanels();
  syncControls();
  render();
}

/** Makes sure every panel of the current layout has a slot, keeping old crops. */
export function ensurePanels() {
  const count = LAYOUTS[state.layout].panels;
  const old = state.panels || [];
  state.panels = Array.from({ length: count }, (_, i) => {
    const prev = old[i] || {};
    const photo = state.singlePhoto ? 0 : (prev.photo ?? (i % Math.max(1, state.photos.length)));
    return {
      photo: Math.min(photo, Math.max(0, state.photos.length - 1)),
      zoom: prev.zoom ?? 1,
      // Default pan keeps faces (usually near the top of a photo) in frame.
      ox: prev.ox ?? ((i % 3) - 1) * 0.08,
      oy: prev.oy ?? 0.15,
    };
  });
  if (state.selected >= count) state.selected = 0;
}

/** Renders the live preview canvas at the chosen size's aspect. */
export function render() {
  const size = SIZES[state.size];
  const scale = 760 / Math.max(size.w, size.h);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  ensurePanels();
  drawCover(preview, state);
  drawSelection();
  updatePanelList();
}

/** Draws the selection outline around the selected panel in preview space. */
export function drawSelection() {
  const panels = previewPanels(state, preview.width, preview.height);
  const r = panels[state.selected];
  if (!r) return;
  pctx.save();
  pctx.strokeStyle = '#ffd166';
  pctx.lineWidth = 3;
  pctx.setLineDash([10, 6]);
  pctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  pctx.setLineDash([]);
  pctx.fillStyle = '#ffd166';
  pctx.font = 'bold 13px sans-serif';
  pctx.fillText(`PANEL ${state.selected + 1}`, r.x + 8, r.y + 20);
  pctx.restore();
}

let lastPanelSig = '';
/** Rebuilds the panel list only when its shape changed; otherwise refreshes values. */
export function updatePanelList() {
  const sig = `${state.panels.length}|${state.photoNames.join(',')}`;
  const list = $('panels');
  if (sig !== lastPanelSig) {
    lastPanelSig = sig;
    list.innerHTML = '';
    state.panels.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'panel-row' + (i === state.selected ? ' selected' : '');
    row.innerHTML = `<span class="panel-num">${i + 1}</span>`;
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', `Photo for panel ${i + 1}`);
    state.photoNames.forEach((name, pi) => {
      const opt = document.createElement('option');
      opt.value = String(pi);
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel.value = String(p.photo);
    sel.addEventListener('change', () => {
      p.photo = Number(sel.value);
      state.selected = i;
      pushHistory();
      render();
    });
    const zoom = document.createElement('input');
    zoom.type = 'range'; zoom.min = '1'; zoom.max = '2.5'; zoom.step = '0.05';
    zoom.value = String(p.zoom);
    zoom.setAttribute('aria-label', `Zoom for panel ${i + 1}`);
    zoom.addEventListener('input', () => {
      p.zoom = Number(zoom.value);
      state.selected = i;
      render();
    });
    zoom.addEventListener('change', pushHistory);
    const fill = document.createElement('button');
    fill.type = 'button';
    fill.className = 'mini';
    fill.textContent = 'Fill all';
    fill.title = 'Use this photo in every panel';
    fill.addEventListener('click', () => {
      state.panels.forEach((q) => { q.photo = p.photo; });
      state.singlePhoto = true;
      $('singlePhoto').checked = true;
      pushHistory();
      render();
    });
    row.append(sel, zoom, fill);
    row.addEventListener('click', (e) => {
      if (e.target === row || e.target.classList.contains('panel-num')) {
        state.selected = i;
        syncControls();
        render();
      }
    });
    list.appendChild(row);
    });
  }
  // Refresh values without rebuilding (keeps sliders usable mid-drag).
  [...list.children].forEach((row, i) => {
    row.classList.toggle('selected', i === state.selected);
    const sel = row.querySelector('select');
    if (sel) sel.value = String(state.panels[i]?.photo ?? 0);
    const zoom = row.querySelector('input[type=range]');
    if (zoom && document.activeElement !== zoom) zoom.value = String(state.panels[i]?.zoom ?? 1);
  });
  $('panelPhoto').textContent = state.photoNames[state.panels[state.selected]?.photo] || '—';
  $('panelZoom').value = String(state.panels[state.selected]?.zoom ?? 1);
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

/** Adds loaded photos to the library and re-renders. */
export async function addPhotos(files) {
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push(img);
      state.photoNames.push(file.name.replace(/\.[^.]+$/, '').slice(0, 18) || `Photo ${state.photos.length}`);
    } catch (e) { /* skip unreadable files */ }
  }
  if (!state.photos.length) return;
  ensurePanels();
  pushHistory();
  render();
}

/** Loads the two bundled sample photos so the editor opens with art in it. */
export async function loadSamples() {
  const samples = [
    ['samples/boulevard.jpg', 'Boulevard'],
    ['samples/pier.jpg', 'Pier'],
  ];
  for (const [url, name] of samples) {
    try {
      state.photos.push(await loadImage(url));
      state.photoNames.push(name);
    } catch (e) { /* samples are optional */ }
  }
  ensurePanels();
  render();
}

/** Builds the layout / grade / size swatch buttons. */
export function buildSwatches() {
  const layouts = $('layouts');
  Object.entries(LAYOUTS).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (id === state.layout ? ' active' : '');
    b.textContent = def.label;
    b.dataset.layout = id;
    b.addEventListener('click', () => {
      state.layout = id;
      ensurePanels();
      pushHistory();
      syncControls();
      render();
    });
    layouts.appendChild(b);
  });
  const grades = $('grades');
  Object.entries(GRADES).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch grade' + (id === state.grade ? ' active' : '');
    b.style.background = `linear-gradient(135deg, ${def.overlay[0]}, ${def.overlay[1]}, ${def.overlay[2]})`;
    b.textContent = def.label;
    b.dataset.grade = id;
    b.addEventListener('click', () => {
      state.grade = id;
      pushHistory();
      syncControls();
      render();
    });
    grades.appendChild(b);
  });
  const sizes = $('sizes');
  Object.entries(SIZES).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (id === state.size ? ' active' : '');
    b.textContent = def.label;
    b.dataset.size = id;
    b.addEventListener('click', () => {
      state.size = id;
      pushHistory();
      syncControls();
      render();
    });
    sizes.appendChild(b);
  });
}

/** Reflects the state back into every control (after undo / shot setup). */
export function syncControls() {
  document.querySelectorAll('#layouts .swatch').forEach((b) =>
    b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades .swatch').forEach((b) =>
    b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#sizes .swatch').forEach((b) =>
    b.classList.toggle('active', b.dataset.size === state.size));
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('singlePhoto').checked = state.singlePhoto;
  $('frameToggle').checked = state.frame;
  $('grainToggle').checked = state.grain;
  $('vignetteToggle').checked = state.vignette;
  updateUndoButtons();
}

export function updateUndoButtons() {
  $('undo').disabled = historyIndex <= 0;
  $('redo').disabled = historyIndex >= history.length - 1;
}

/** Exports the current cover at one size and triggers a PNG download. */
export function exportSize(sizeId) {
  const size = SIZES[sizeId];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const saved = state.size;
  state.size = sizeId;
  drawCover(off, state);
  state.size = saved;
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-${size.w}x${size.h}.png`;
    a.click();
    $('status').textContent = `Saved neon-coast-${size.w}x${size.h}.png`;
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
  return off;
}

/** Exports all three post sizes, one PNG each. */
export function exportAllSizes() {
  Object.keys(SIZES).forEach((id, i) => setTimeout(() => exportSize(id), i * 350));
  $('status').textContent = 'Exporting 3 PNGs — square, portrait and wide…';
}

// ---- Page wiring ----

buildSwatches();
$('title').addEventListener('input', (e) => { state.title = e.target.value; render(); });
$('title').addEventListener('change', pushHistory);
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
$('subtitle').addEventListener('change', pushHistory);
$('singlePhoto').addEventListener('change', (e) => {
  state.singlePhoto = e.target.checked;
  if (state.singlePhoto) state.panels.forEach((p) => { p.photo = state.panels[state.selected].photo; });
  pushHistory();
  render();
});
$('frameToggle').addEventListener('change', (e) => { state.frame = e.target.checked; pushHistory(); render(); });
$('grainToggle').addEventListener('change', (e) => { state.grain = e.target.checked; pushHistory(); render(); });
$('vignetteToggle').addEventListener('change', (e) => { state.vignette = e.target.checked; pushHistory(); render(); });
$('photos').addEventListener('change', (e) => addPhotos([...e.target.files]));
$('samplesBtn').addEventListener('click', () => loadSamples());
$('undo').addEventListener('click', () => {
  if (historyIndex > 0) { historyIndex -= 1; restoreSnapshot(history[historyIndex]); }
});
$('redo').addEventListener('click', () => {
  if (historyIndex < history.length - 1) { historyIndex += 1; restoreSnapshot(history[historyIndex]); }
});
$('exportCurrent').addEventListener('click', () => exportSize(state.size));
$('exportAll').addEventListener('click', exportAllSizes);

// Drag on the preview pans the selected panel's photo; wheel zooms it.
let dragging = null;
function panelAt(clientX, clientY) {
  const rect = preview.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * preview.width;
  const y = ((clientY - rect.top) / rect.height) * preview.height;
  const panels = previewPanels(state, preview.width, preview.height);
  return { x, y, index: panels.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) };
}
preview.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit.index < 0) return;
  state.selected = hit.index;
  dragging = { x: hit.x, y: hit.y, ox: state.panels[hit.index].ox, oy: state.panels[hit.index].oy };
  preview.setPointerCapture(e.pointerId);
  syncControls();
  render();
});
preview.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const hit = panelAt(e.clientX, e.clientY);
  const p = state.panels[state.selected];
  const panels = previewPanels(state, preview.width, preview.height);
  const r = panels[state.selected];
  if (!r) return;
  p.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + (hit.x - dragging.x) / r.w));
  p.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + (hit.y - dragging.y) / r.h));
  render();
});
preview.addEventListener('pointerup', () => { if (dragging) { dragging = null; pushHistory(); } });
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = state.panels[state.selected];
  if (!p) return;
  p.zoom = Math.max(1, Math.min(2.5, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  $('panelZoom').value = String(p.zoom);
  render();
}, { passive: false });
$('panelZoom').addEventListener('input', (e) => {
  const p = state.panels[state.selected];
  if (!p) return;
  p.zoom = Number(e.target.value);
  render();
});
$('panelZoom').addEventListener('change', pushHistory);

// Expose the live state for shots and for debugging in the console.
window.__coverStudio = { state, render, exportSize, drawCover, SIZES };

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), state, { loadImage, loadSamples, render, syncControls, pushHistory });
} else {
  loadSamples().then(() => {
    history = [snapshotState()];
    historyIndex = 0;
    updateUndoButtons();
  });
}
