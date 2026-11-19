// Neon Coast Cover Studio — screenshot mode.
// When the page opens with ?shot=cover or ?shot=editor, this module drives
// the app itself: it loads a sample photo, renders a cover with the app's
// own export, and shows it full-frame so a headless browser can capture
// exactly what the app produced. No photo is ever uploaded anywhere.

import { defaultState, exportCoverPNG, GRADES, LAYOUTS, SIZES } from './cover.js';

const params = new URLSearchParams(location.search);
const mode = params.get('shot');

async function loadSample(name) {
  const img = new Image();
  img.src = `samples/${name}.jpg`;
  await img.decode();
  return img;
}

async function waitForFonts() {
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('20px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // Fonts fall back to system faces; the render still works.
  }
}

async function coverShot() {
  const state = defaultState();
  state.layout = LAYOUTS[params.get('layout')] ? params.get('layout') : 'hero';
  state.grade = GRADES[params.get('grade')] ? params.get('grade') : 'sunset';
  state.size = SIZES[params.get('size')] ? params.get('size') : 'wide';
  if (params.get('caption')) state.title = params.get('caption');
  if (params.get('subtitle')) state.subtitle = params.get('subtitle');
  const photo = params.get('photo') || 'pier';
  await waitForFonts();
  const img = await loadSample(photo);
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    state.panels[i].image = img;
    state.panels[i].sample = photo;
  }
  const blob = await exportCoverPNG(state);
  const url = URL.createObjectURL(blob);
  document.documentElement.classList.add('shot-cover');
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#12082b';
  const view = document.createElement('img');
  view.src = url;
  view.alt = 'Exported cover';
  view.style.cssText = 'display:block;width:100vw;height:100vh;object-fit:contain;';
  document.body.appendChild(view);
  await view.decode();
  window.__shotReady = true;
  document.title = 'shot-ready';
}

async function editorShot() {
  // The editor boots itself in main.js; here we only steer it like a user
  // would: pick a layout, a grade and a caption, then wait a beat for the
  // preview to paint.
  await waitForFonts();
  await new Promise((r) => setTimeout(r, 900));
  const caption = params.get('caption');
  if (caption) {
    const title = document.getElementById('title-input');
    if (title) {
      title.value = caption;
      title.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  const layout = params.get('layout');
  if (layout) {
    const chips = [...document.querySelectorAll('#layout-pick .chip')];
    const want = Object.keys(LAYOUTS).indexOf(layout);
    if (chips[want]) chips[want].click();
  }
  await new Promise((r) => setTimeout(r, 400));
  window.__shotReady = true;
  document.title = 'shot-ready';
}

if (mode === 'cover') {
  coverShot();
} else if (mode === 'editor') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', editorShot);
  } else {
    editorShot();
  }
}
