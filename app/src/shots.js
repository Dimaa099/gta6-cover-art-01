// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone, drawn by the app's own
// renderer at the requested post size. window.__shotReady is set once painted
// (fonts included), so a headless browser can screenshot the finished frame.
import { SIZES, drawCover } from './cover.js';

function ready() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

export async function runShot(shot, query, state, api) {
  const layout = query.get('layout') || 'grid9';
  const grade = query.get('grade') || 'sunset';
  const sizeId = query.get('size') || 'wide';
  const title = query.get('title') || 'NEON COAST';
  const subtitle = query.get('subtitle') || 'sunset heist in the city of lights';
  state.layout = layout;
  state.grade = grade;
  state.size = sizeId;
  state.title = title;
  state.subtitle = subtitle;
  if (query.get('single') === '1') state.singlePhoto = true;

  await api.loadSamples();
  // A second sample round would duplicate photos; loadSamples runs once here.
  state.panels.forEach((p, i) => {
    p.photo = state.singlePhoto ? 0 : i % Math.max(1, state.photos.length);
    // Sample photos are landscapes with faces near the top: pan down so the
    // wide panels keep heads in frame instead of cropping to torsos.
    // Boulevard is a tall portrait (544x720), Pier is square: each needs its
    // own vertical offset to put faces in the visible slice.
    p.zoom = 1 + (i % 2) * 0.05;
    p.ox = ((i % 3) - 1) * 0.06;
    p.oy = (p.photo === 0 ? 0.75 : 0.16) + ((Math.floor(i / 3) % 3) - 1) * 0.03;
  });
  api.syncControls();

  if (shot === 'cover') {
    // Draw the exported cover itself, full-frame, at the post size.
    document.body.classList.add('shot-cover');
    const size = SIZES[sizeId] || SIZES.wide;
    const canvas = document.getElementById('preview');
    canvas.width = size.w;
    canvas.height = size.h;
    // Match the canvas element to the viewport so the screenshot is the cover.
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    drawCover(canvas, state);
    try { await document.fonts.ready; drawCover(canvas, state); } catch (e) { /* fonts optional */ }
    ready();
    return;
  }

  // Editor scene: preview + controls, photos loaded.
  api.render();
  try { await document.fonts.ready; api.render(); } catch (e) { /* fonts optional */ }
  ready();
}
