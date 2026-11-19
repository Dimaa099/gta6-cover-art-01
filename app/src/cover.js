// Neon Coast Cover Studio — cover renderer.
// Draws GTA-poster-style multi-panel cover art on any 2D canvas: panel layouts,
// gradient-map sunset/neon grades, bold display lettering, grain and vignette.
// Every function here is authored for this entry; no game artwork, logo or font
// from any Rockstar title is used anywhere in the app.

/** The grades: name, panel overlay gradient, title gradient and accent colour. */
export const GRADES = {
  sunset:   { label: 'Vice Sunset', overlay: ['#ff7a3c', '#e83e8c', '#5b2a86'], mode: 'soft-light', strength: 0.62, title: ['#ffffff', '#ffd166'], accent: '#ff9e3d', sub: '#ffe9a8' },
  neon:     { label: 'Neon Nights', overlay: ['#ff2e88', '#7b2ff7', '#00e5ff'], mode: 'overlay',    strength: 0.55, title: ['#ffffff', '#7df9ff'], accent: '#ff2e88', sub: '#c9b8ff' },
  gold:     { label: 'Palm Gold',   overlay: ['#ffc93c', '#ff7b00', '#7a2e0d'], mode: 'soft-light', strength: 0.60, title: ['#fffbe8', '#ffb703'], accent: '#ffb703', sub: '#ffe8a3' },
  teal:     { label: 'Teal Noir',   overlay: ['#00c2a8', '#0b486b', '#0b1026'], mode: 'overlay',    strength: 0.50, title: ['#ffffff', '#8affdd'], accent: '#00e5b0', sub: '#b8fff1' },
  bubble:   { label: 'Bubblegum',   overlay: ['#ff6fb5', '#b388ff', '#4dd8ff'], mode: 'soft-light', strength: 0.58, title: ['#ffffff', '#ff9ed2'], accent: '#ff6fb5', sub: '#ffd6ec' },
};

/** The layouts: id, label, and a function returning panel rects for the photo area. */
export const LAYOUTS = {
  grid9:    { label: '9-Panel Cover Grid', panels: 9 },
  grid4:    { label: '4-Panel Grid', panels: 4 },
  hero3:    { label: 'Hero + Three', panels: 4 },
  fullbleed:{ label: 'Full Bleed', panels: 1 },
  tilt:     { label: 'Tilted Snapshots', panels: 3 },
  story:    { label: 'Story Stack', panels: 3 },
};

const SIZES = {
  square:   { label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  wide:     { label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
};
export { SIZES };

let grainCanvas = null;
/** Builds a small tile of random monochrome grain, reused as a pattern fill. */
export function makeGrainTile() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = 140; grainCanvas.height = 140;
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grainCanvas;
}

/** Panel rectangles for a layout inside the photo area (x, y, w, h). */
export function layoutPanels(layout, area) {
  const { x, y, w, h } = area;
  const g = Math.max(4, Math.round(w * 0.012));
  const cell = (cols, rows, i) => {
    const cw = (w - g * (cols + 1)) / cols;
    const ch = (h - g * (rows + 1)) / rows;
    const col = i % cols, row = Math.floor(i / cols);
    return { x: x + g + col * (cw + g), y: y + g + row * (ch + g), w: cw, h: ch };
  };
  switch (layout) {
    case 'grid9': return Array.from({ length: 9 }, (_, i) => cell(3, 3, i));
    case 'grid4': return Array.from({ length: 4 }, (_, i) => cell(2, 2, i));
    case 'hero3': {
      const heroW = (w - g * 3) * 0.62;
      const sideX = x + g + heroW + g, sideW = w - heroW - g * 3;
      const ch = (h - g * 4) / 3;
      const out = [{ x: x + g, y: y + g, w: heroW, h: h - g * 2 }];
      for (let i = 0; i < 3; i++) out.push({ x: sideX, y: y + g + i * (ch + g), w: sideW, h: ch });
      return out;
    }
    case 'fullbleed': return [{ x, y, w, h }];
    case 'tilt': {
      const pw = w * 0.52, ph = h * 0.58;
      return [
        { x: x + w * 0.06, y: y + h * 0.06, w: pw, h: ph, rot: -5 },
        { x: x + w * 0.42, y: y + h * 0.10, w: pw, h: ph, rot: 4 },
        { x: x + w * 0.22, y: y + h * 0.38, w: pw, h: ph, rot: -2 },
      ];
    }
    case 'story': {
      const topH = (h - g * 3) * 0.55;
      const botY = y + g + topH + g, botH = h - topH - g * 3;
      const bw = (w - g * 3) / 2;
      return [
        { x: x + g, y: y + g, w: w - g * 2, h: topH },
        { x: x + g, y: botY, w: bw, h: botH },
        { x: x + g * 2 + bw, y: botY, w: bw, h: botH },
      ];
    }
    default: return Array.from({ length: 4 }, (_, i) => cell(2, 2, i));
  }
}

/** Draws one photo into a panel rect with cover-fit, zoom and pan offsets.
 *  Pan is clamped to the photo's overflow, so the image always covers the
 *  panel and no empty band can appear, whatever the panel's aspect. */
export function drawPanelPhoto(ctx, photo, rect, zoom, ox, oy) {
  if (!photo) return;
  const iw = photo.naturalWidth || photo.width, ih = photo.naturalHeight || photo.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * (zoom || 1);
  const pw = iw * scale, ph = ih * scale;
  const maxOx = Math.max(0, (pw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (ph - rect.h) / 2 / rect.h);
  const cx = rect.x + rect.w / 2 + Math.max(-maxOx, Math.min(maxOx, ox || 0)) * rect.w;
  const cy = rect.y + rect.h / 2 + Math.max(-maxOy, Math.min(maxOy, oy || 0)) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

/** Applies a grade's colour wash over a clipped rectangle. */
export function gradeRect(ctx, rect, grade) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.25, rect.y + rect.h);
  grade.overlay.forEach((c, i) => grad.addColorStop(i / (grade.overlay.length - 1), c));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.globalCompositeOperation = grade.mode;
  ctx.globalAlpha = grade.strength;
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Warm bottom lift so captions stay readable and the sunset reads.
  const lift = ctx.createLinearGradient(0, rect.y + rect.h * 0.55, 0, rect.y + rect.h);
  lift.addColorStop(0, 'rgba(255,90,60,0)');
  lift.addColorStop(1, 'rgba(120,20,90,0.28)');
  ctx.fillStyle = lift;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Fits a string to a width by shrinking the font, returns the chosen size. */
export function fitFont(ctx, text, maxWidth, startSize, family, weight) {
  let size = startSize;
  const set = () => { ctx.font = `${weight} ${size}px ${family}`; };
  set();
  while (ctx.measureText(text).width > maxWidth && size > 10) { size -= 2; set(); }
  return size;
}

/** Draws the title band: big gradient display type, script subtitle, star meter, badge. */
export function drawTitleBand(ctx, state, band, grade) {
  const { x, y, w, h } = band;
  // Band background: deep dusk gradient with a halftone dot row on top.
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#1a0b2e'); bg.addColorStop(0.55, '#2b103f'); bg.addColorStop(1, '#12081f');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  const dotR = Math.max(2, h * 0.012);
  for (let dx = x + dotR * 2; dx < x + w; dx += dotR * 5) {
    ctx.beginPath(); ctx.arc(dx, y + dotR * 2, dotR, 0, Math.PI * 2); ctx.fill();
  }
  // Accent rule above the title.
  ctx.fillStyle = grade.accent;
  ctx.fillRect(x + w * 0.06, y + h * 0.10, w * 0.10, Math.max(3, h * 0.02));

  const title = (state.title || 'NEON COAST').trim().toUpperCase() || 'NEON COAST';
  const pad = w * 0.06;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const titleSize = fitFont(ctx, title, w - pad * 2, h * 0.52, '"Anton", "Arial Black", sans-serif', 400);
  const titleGrad = ctx.createLinearGradient(0, y + h * 0.12, 0, y + h * 0.62);
  titleGrad.addColorStop(0, grade.title[0]); titleGrad.addColorStop(1, grade.title[1]);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = titleSize * 0.10;
  ctx.shadowOffsetY = titleSize * 0.04;
  ctx.lineWidth = Math.max(2, titleSize * 0.055);
  ctx.strokeStyle = 'rgba(20,5,30,0.9)';
  ctx.strokeText(title, x + pad, y + h * 0.56);
  ctx.fillStyle = titleGrad;
  ctx.fillText(title, x + pad, y + h * 0.56);
  ctx.restore();

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, w - pad * 2, h * 0.20, '"Pacifico", cursive', 400);
    ctx.font = `${subSize}px "Pacifico", cursive`;
    ctx.fillStyle = grade.sub;
    ctx.fillText(sub, x + pad, y + h * 0.86);
  }

  // Heat meter: five stars + badge ribbon at the band's right edge.
  const stars = '★★★★★';
  ctx.font = `${Math.round(h * 0.16)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(stars, x + w - pad, y + h * 0.30);
  ctx.textAlign = 'left';
  const badge = 'HEAT  ★  5.0';
  ctx.font = `bold ${Math.round(h * 0.11)}px sans-serif`;
  const bw = ctx.measureText(badge).width + h * 0.16;
  const bx = x + w - pad - bw, by = y + h * 0.44, bh = h * 0.22;
  ctx.fillStyle = grade.accent;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = '#1a0b2e';
  ctx.fillText(badge, bx + h * 0.08, by + bh * 0.68);
}

/** Grain + vignette finish over the whole cover. */
export function finishCover(ctx, w, h, grainOn, vignetteOn) {
  if (vignetteOn) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,0,20,0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (grainOn) {
    const tile = makeGrainTile();
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/**
 * Renders the whole cover for `state` onto `canvas` at its own pixel size.
 * state: { layout, grade, title, subtitle, photos:[img], panels:[{photo,zoom,ox,oy}],
 *          frame:boolean, grain:boolean, vignette:boolean, halftone:boolean }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const bandH = state.layout === 'fullbleed' ? Math.round(h * 0.22) : Math.round(h * 0.20);
  const photoArea = { x: 0, y: 0, w, h: h - bandH };
  const frame = state.frame === false ? 0 : Math.max(3, Math.round(w * 0.008));

  // Backdrop: deep dusk so gutters read as a poster frame.
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);
  if (frame) {
    ctx.fillStyle = '#f7f2ea';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#12081f';
    ctx.fillRect(frame, frame, w - frame * 2, h - frame * 2);
  }
  const inner = { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 };
  const area = state.layout === 'fullbleed'
    ? { x: inner.x, y: inner.y, w: inner.w, h: inner.h }
    : { x: inner.x, y: inner.y, w: inner.w, h: inner.h - bandH };

  if (state.layout === 'tilt') {
    // Sunset gradient backdrop behind the tilted snapshots.
    const bg = ctx.createLinearGradient(0, area.y, area.w * 0.3, area.y + area.h);
    grade.overlay.forEach((c, i) => bg.addColorStop(i / (grade.overlay.length - 1), c));
    ctx.fillStyle = bg;
    ctx.fillRect(area.x, area.y, area.w, area.h);
  }

  const panels = layoutPanels(state.layout, area);
  panels.forEach((rect, i) => {
    const p = (state.panels && state.panels[i]) || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = state.photos && state.photos[p.photo];
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rot * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      const r0 = { x: 0, y: 0, w: rect.w, h: rect.h };
      ctx.fillStyle = '#f7f2ea';
      ctx.fillRect(-Math.round(rect.w * 0.03), -Math.round(rect.w * 0.03), rect.w * 1.06, rect.h * 1.10);
      drawPanelPhoto(ctx, photo, r0, p.zoom, p.ox, p.oy);
      gradeRect(ctx, r0, grade);
      ctx.restore();
    } else {
      drawPanelPhoto(ctx, photo, rect, p.zoom, p.ox, p.oy);
      gradeRect(ctx, rect, grade);
      // Thin white inner keyline per panel.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, w * 0.002);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  });

  // Title band.
  const band = state.layout === 'fullbleed'
    ? { x: inner.x, y: inner.y + inner.h - bandH, w: inner.w, h: bandH }
    : { x: inner.x, y: inner.y + inner.h - bandH, w: inner.w, h: bandH };
  if (state.layout === 'fullbleed') {
    // Soft dark scrim so the band lettering reads over the photo.
    const scrim = ctx.createLinearGradient(0, band.y - band.h * 0.4, 0, band.y + band.h);
    scrim.addColorStop(0, 'rgba(18,8,31,0)');
    scrim.addColorStop(1, 'rgba(18,8,31,0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(band.x, band.y - band.h * 0.4, band.w, band.h * 1.4);
  }
  drawTitleBand(ctx, state, band, grade);
  finishCover(ctx, w, h, state.grain !== false, state.vignette !== false);
  return panels;
}

/** Panel rects in preview-canvas coordinates (same math as drawCover, for hit-testing). */
export function previewPanels(state, pw, ph) {
  const bandH = state.layout === 'fullbleed' ? Math.round(ph * 0.22) : Math.round(ph * 0.20);
  const frame = state.frame === false ? 0 : Math.max(3, Math.round(pw * 0.008));
  const inner = { x: frame, y: frame, w: pw - frame * 2, h: ph - frame * 2 };
  const area = state.layout === 'fullbleed'
    ? { x: inner.x, y: inner.y, w: inner.w, h: inner.h }
    : { x: inner.x, y: inner.y, w: inner.w, h: inner.h - bandH };
  return layoutPanels(state.layout, area);
}
