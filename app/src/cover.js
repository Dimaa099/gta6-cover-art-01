// Neon Coast Cover Studio — cover renderer.
// Draws a multi-panel GTA-style poster cover onto any 2D canvas: panel
// photos with per-panel pan and zoom, a sunset or neon colour grade, bold
// display lettering, grain and a vignette. Pure canvas, no dependencies.

export const LAYOUTS = {
  grid4: { label: 'Four Panel', panels: 4 },
  hero: { label: 'Hero + Three', panels: 4 },
  bleed: { label: 'Full Bleed', panels: 1 },
  nine: { label: 'Nine Panel', panels: 9 },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    wash: '#ff7a18',
    washAlpha: 0.16,
    sky: ['rgba(255, 94, 98, 0.55)', 'rgba(255, 170, 0, 0.28)', 'rgba(255, 94, 98, 0)'],
    title: ['#ffe259', '#ff7a18', '#ff2e63'],
    accent: '#ff2e63',
  },
  neon: {
    label: 'Neon Night',
    wash: '#00e5ff',
    washAlpha: 0.14,
    sky: ['rgba(255, 0, 128, 0.5)', 'rgba(0, 229, 255, 0.3)', 'rgba(255, 0, 128, 0)'],
    title: ['#7df9ff', '#ff71ce', '#b967ff'],
    accent: '#01cdfe',
  },
  vice: {
    label: 'Vice Pink',
    wash: '#ff71ce',
    washAlpha: 0.18,
    sky: ['rgba(255, 113, 206, 0.5)', 'rgba(255, 159, 28, 0.26)', 'rgba(255, 113, 206, 0)'],
    title: ['#fff3f8', '#ff9de2', '#ff71ce'],
    accent: '#ff9f1c',
  },
  gold: {
    label: 'Gold Hour',
    wash: '#ffb703',
    washAlpha: 0.15,
    sky: ['rgba(255, 183, 3, 0.5)', 'rgba(251, 133, 0, 0.3)', 'rgba(255, 183, 3, 0)'],
    title: ['#fff8e1', '#ffd60a', '#fb8500'],
    accent: '#ffd60a',
  },
};

export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

export function blankPanel() {
  return { image: null, zoom: 1, dx: 0, dy: 0, sample: null };
}

export function defaultState() {
  return {
    layout: 'grid4',
    grade: 'sunset',
    size: 'wide',
    title: 'NEON COAST',
    subtitle: 'a vice city story',
    badge: 'EST. 2026',
    grain: 0.55,
    vignette: true,
    frame: true,
    panels: Array.from({ length: 9 }, () => blankPanel()),
  };
}

// Panel rectangles for a layout, in cover pixels. The bottom band is kept
// free for the title block; panels fill the area above it.
export function layoutRects(layout, w, h) {
  const gap = Math.round(Math.min(w, h) * 0.012);
  const titleH = Math.round(h * 0.21);
  const top = 0;
  const bottom = h - titleH;
  const areaH = bottom - top;
  const rects = [];
  if (layout === 'bleed') {
    rects.push({ x: 0, y: 0, w, h: bottom });
  } else if (layout === 'grid4') {
    const cw = (w - gap * 3) / 2;
    const ch = (areaH - gap * 3) / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        rects.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch });
      }
    }
  } else if (layout === 'hero') {
    const heroH = Math.round(areaH * 0.58);
    rects.push({ x: gap, y: gap, w: w - gap * 2, h: heroH - gap });
    const cw = (w - gap * 4) / 3;
    const y = gap + heroH;
    for (let c = 0; c < 3; c++) {
      rects.push({ x: gap + c * (cw + gap), y, w: cw, h: areaH - heroH - gap });
    }
  } else {
    // nine: 3 x 3 grid
    const cw = (w - gap * 4) / 3;
    const ch = (areaH - gap * 4) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        rects.push({ x: gap + c * (cw + gap), y: gap + r * (ch + gap), w: cw, h: ch });
      }
    }
  }
  return { rects, titleY: bottom, titleH, gap };
}

function drawPhotoInto(ctx, panel, rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (panel.image) {
    const iw = panel.image.naturalWidth || panel.image.width;
    const ih = panel.image.naturalHeight || panel.image.height;
    const base = Math.max(rect.w / iw, rect.h / ih);
    const s = base * (panel.zoom || 1);
    const dw = iw * s;
    const dh = ih * s;
    const cx = rect.x + rect.w / 2 + (panel.dx || 0);
    const cy = rect.y + rect.h / 2 + (panel.dy || 0);
    ctx.drawImage(panel.image, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    // Empty panel: a dusk gradient with a palm-silhouette hint made of arcs.
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#2b1055');
    g.addColorStop(0.55, '#7597de');
    g.addColorStop(1, '#ff7e5f');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(20, 8, 40, 0.55)';
    const cx = rect.x + rect.w * 0.72;
    const cy = rect.y + rect.h * 0.85;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * (0.15 + i * 0.17);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        cx + Math.cos(a) * rect.w * 0.3,
        cy + Math.sin(a) * rect.h * 0.3 - rect.h * 0.12,
        cx + Math.cos(a) * rect.w * 0.48,
        cy + Math.sin(a) * rect.h * 0.48,
      );
      ctx.lineWidth = Math.max(3, rect.w * 0.012);
      ctx.strokeStyle = 'rgba(20, 8, 40, 0.55)';
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `600 ${Math.round(rect.h * 0.07)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Drop a photo here', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();
  // Thin white poster border around the panel.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = Math.max(2, Math.min(rect.w, rect.h) * 0.008);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

let noiseCanvas = null;
function grainTile(size) {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const nctx = noiseCanvas.getContext('2d');
  const data = nctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseCanvas;
}

function drawTitleBlock(ctx, state, w, titleY, titleH, grade) {
  // Deep navy title band with a sunset strip along its top edge.
  const band = ctx.createLinearGradient(0, titleY, 0, titleY + titleH);
  band.addColorStop(0, '#12082b');
  band.addColorStop(1, '#1c0b3d');
  ctx.fillStyle = band;
  ctx.fillRect(0, titleY, w, titleH);
  const strip = ctx.createLinearGradient(0, 0, w, 0);
  strip.addColorStop(0, '#ff2e63');
  strip.addColorStop(0.5, '#ff9f1c');
  strip.addColorStop(1, '#01cdfe');
  ctx.fillStyle = strip;
  ctx.fillRect(0, titleY, w, Math.max(3, titleH * 0.045));

  const pad = w * 0.04;
  const titleSize = Math.min(titleH * 0.52, (w - pad * 2) / Math.max(4, state.title.length) * 1.5);
  const cx = w / 2;
  const cy = titleY + titleH * 0.52;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(cx - w * 0.3, cy - titleSize / 2, cx + w * 0.3, cy + titleSize / 2);
  grad.addColorStop(0, grade.title[0]);
  grad.addColorStop(0.55, grade.title[1]);
  grad.addColorStop(1, grade.title[2]);
  ctx.font = `${titleSize}px Anton, 'Arial Narrow', sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12082b';
  ctx.lineWidth = Math.max(3, titleSize * 0.14);
  ctx.strokeText(state.title.toUpperCase(), cx, cy);
  ctx.fillStyle = grad;
  ctx.fillText(state.title.toUpperCase(), cx, cy);
  ctx.restore();

  // Script subtitle, glowing like a neon sign.
  const subSize = Math.min(titleH * 0.2, w * 0.035);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${subSize}px Pacifico, cursive`;
  ctx.shadowColor = grade.accent;
  ctx.shadowBlur = subSize * 0.7;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state.subtitle, cx, titleY + titleH * 0.86);
  ctx.restore();

  // Badge pill, top right of the title band.
  if (state.badge) {
    const bSize = Math.max(11, titleH * 0.11);
    ctx.save();
    ctx.font = `700 ${bSize}px system-ui, sans-serif`;
    const bw = ctx.measureText(state.badge).width + bSize * 2.2;
    const bx = w - pad - bw;
    const by = titleY + titleH * 0.14;
    const bh = bSize * 2.1;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fillStyle = grade.accent;
    ctx.fill();
    ctx.fillStyle = '#12082b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.badge, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
  }
}

// Draw the whole cover. `state.panels` holds the photos; only the first
// LAYOUTS[layout].panels entries are used.
export function renderCover(ctx, state, w, h) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const { rects, titleY, titleH } = layoutRects(state.layout, w, h);
  const count = LAYOUTS[state.layout].panels;

  // Poster paper: deep violet base.
  ctx.fillStyle = '#12082b';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < count; i++) {
    drawPhotoInto(ctx, state.panels[i] || blankPanel(), rects[i]);
  }

  // Colour grade: a sky wash over the photo area, then a warm tint.
  const sky = ctx.createLinearGradient(0, 0, 0, titleY);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, titleY);
  ctx.globalAlpha = grade.washAlpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, w, titleY);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  drawTitleBlock(ctx, state, w, titleY, titleH, grade);

  // Outer poster frame.
  if (state.frame) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.006);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }

  // Vignette: darken the corners so the middle pops.
  if (state.vignette) {
    const v = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    v.addColorStop(0, 'rgba(10, 4, 24, 0)');
    v.addColorStop(1, 'rgba(10, 4, 24, 0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  // Film grain.
  if (state.grain > 0) {
    const tile = grainTile(140);
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = state.grain * 0.16;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// Render the cover at export size and return a PNG blob.
export function exportCoverPNG(state) {
  const size = SIZES[state.size] || SIZES.wide;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, state, size.w, size.h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
