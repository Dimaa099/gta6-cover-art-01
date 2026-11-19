// Neon Coast Cover Studio — editor wiring.
// Owns the app state, the preview canvas, photo loading, drag-to-pan and
// wheel zoom per panel, and the PNG export button. The renderer lives in
// cover.js; this file only wires the page to it.

import { LAYOUTS, GRADES, SIZES, defaultState, renderCover, exportCoverPNG, layoutRects } from './cover.js';

const state = defaultState();
let selectedPanel = 0;
let previewScale = 1;

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

function sampleURL(name) {
  return `samples/${name}.jpg`;
}

async function loadImageFromURL(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

function loadSampleIntoPanel(index, sample) {
  loadImageFromURL(sampleURL(sample)).then((img) => {
    state.panels[index].image = img;
    state.panels[index].sample = sample;
    state.panels[index].zoom = 1;
    state.panels[index].dx = 0;
    state.panels[index].dy = 0;
    drawPreview();
    refreshPanelList();
  });
}

function loadFileIntoPanel(index, file) {
  const reader = new FileReader();
  reader.onload = () => {
    loadImageFromURL(reader.result).then((img) => {
      state.panels[index].image = img;
      state.panels[index].sample = null;
      state.panels[index].zoom = 1;
      state.panels[index].dx = 0;
      state.panels[index].dy = 0;
      drawPreview();
      refreshPanelList();
    });
  };
  reader.readAsDataURL(file);
}

function fillAllPanels(sample) {
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) loadSampleIntoPanel(i, sample);
}

function drawPreview() {
  const size = SIZES[state.size];
  const maxW = 640;
  const scale = Math.min(1, maxW / size.w);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  previewScale = preview.width / size.w;
  renderCover(pctx, state, size.w, size.h);
  highlightSelected();
}

function highlightSelected() {
  const size = SIZES[state.size];
  const { rects } = layoutRects(state.layout, size.w, size.h);
  const count = LAYOUTS[state.layout].panels;
  if (selectedPanel >= count) selectedPanel = 0;
  const r = rects[selectedPanel];
  if (!r) return;
  pctx.save();
  pctx.strokeStyle = '#01cdfe';
  pctx.lineWidth = 3;
  pctx.setLineDash([10, 6]);
  pctx.strokeRect(r.x * previewScale + 2, r.y * previewScale + 2, r.w * previewScale - 4, r.h * previewScale - 4);
  pctx.restore();
}

// Panel under a preview-canvas point, in cover pixels.
function panelAt(clientX, clientY) {
  const box = preview.getBoundingClientRect();
  const x = (clientX - box.left) / previewScale;
  const y = (clientY - box.top) / previewScale;
  const size = SIZES[state.size];
  const { rects } = layoutRects(state.layout, size.w, size.h);
  for (let i = 0; i < LAYOUTS[state.layout].panels; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
preview.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  refreshPanelList();
  drawPreview();
  drag = { panel: i, x: e.clientX, y: e.clientY, dx: state.panels[i].dx, dy: state.panels[i].dy };
  preview.setPointerCapture(e.pointerId);
});
preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = state.panels[drag.panel];
  p.dx = drag.dx + (e.clientX - drag.x) / previewScale;
  p.dy = drag.dy + (e.clientY - drag.y) / previewScale;
  drawPreview();
});
preview.addEventListener('pointerup', () => { drag = null; });
preview.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selectedPanel = i;
  const p = state.panels[i];
  p.zoom = Math.min(4, Math.max(0.5, p.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
  drawPreview();
}, { passive: false });

function buildButtons(container, entries, current, onPick) {
  container.innerHTML = '';
  for (const [key, value] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (key === current ? ' active' : '');
    b.textContent = value.label;
    b.addEventListener('click', () => {
      onPick(key);
      buildButtons(container, entries, key, onPick);
      drawPreview();
    });
    container.appendChild(b);
  }
}

function refreshPanelList() {
  const list = $('panel-list');
  list.innerHTML = '';
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const p = state.panels[i];
    const row = document.createElement('div');
    row.className = 'panel-row' + (i === selectedPanel ? ' selected' : '');
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'panel-name';
    label.textContent = `Panel ${i + 1}${p.sample ? ' · ' + p.sample : p.image ? ' · your photo' : ' · empty'}`;
    label.addEventListener('click', () => {
      selectedPanel = i;
      refreshPanelList();
      drawPreview();
    });
    const fileBtn = document.createElement('label');
    fileBtn.className = 'mini-btn';
    fileBtn.textContent = 'Load photo';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    input.addEventListener('change', () => {
      if (input.files[0]) loadFileIntoPanel(i, input.files[0]);
    });
    fileBtn.appendChild(input);
    const sampleBtn = document.createElement('button');
    sampleBtn.type = 'button';
    sampleBtn.className = 'mini-btn';
    sampleBtn.textContent = 'Sample';
    sampleBtn.addEventListener('click', () => loadSampleIntoPanel(i, i % 2 === 0 ? 'boulevard' : 'pier'));
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'mini-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', () => {
      state.panels[i].image = null;
      state.panels[i].sample = null;
      drawPreview();
      refreshPanelList();
    });
    row.append(label, fileBtn, sampleBtn, clearBtn);
    list.appendChild(row);
  }
}

function init() {
  buildButtons($('layout-pick'), Object.entries(LAYOUTS), state.layout, (key) => {
    state.layout = key;
    if (selectedPanel >= LAYOUTS[key].panels) selectedPanel = 0;
    refreshPanelList();
  });
  buildButtons($('grade-pick'), Object.entries(GRADES), state.grade, (key) => { state.grade = key; });
  buildButtons($('size-pick'), Object.entries(SIZES), state.size, (key) => { state.size = key; });

  $('title-input').addEventListener('input', (e) => { state.title = e.target.value || 'NEON COAST'; drawPreview(); });
  $('subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value; drawPreview(); });
  $('badge-input').addEventListener('input', (e) => { state.badge = e.target.value; drawPreview(); });
  $('grain-input').addEventListener('input', (e) => {
    state.grain = Number(e.target.value);
    $('grain-value').textContent = `${Math.round(state.grain * 100)}%`;
    drawPreview();
  });
  $('vignette-input').addEventListener('change', (e) => { state.vignette = e.target.checked; drawPreview(); });
  $('frame-input').addEventListener('change', (e) => { state.frame = e.target.checked; drawPreview(); });

  $('fill-boulevard').addEventListener('click', () => fillAllPanels('boulevard'));
  $('fill-pier').addEventListener('click', () => fillAllPanels('pier'));
  $('reset-pan').addEventListener('click', () => {
    const p = state.panels[selectedPanel];
    p.zoom = 1;
    p.dx = 0;
    p.dy = 0;
    drawPreview();
  });

  $('export-btn').addEventListener('click', async () => {
    const btn = $('export-btn');
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      const blob = await exportCoverPNG(state);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const size = SIZES[state.size];
      a.href = url;
      a.download = `neon-coast-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      $('export-note').textContent = `Exported ${size.w} x ${size.h} PNG — check your downloads.`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export PNG';
    }
  });

  // Start with the boulevard sample in every panel so the first preview
  // already looks like a finished cover.
  fillAllPanels('boulevard');
  refreshPanelList();
  drawPreview();
}

document.addEventListener('DOMContentLoaded', init);
