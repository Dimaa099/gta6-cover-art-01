// Neon Coast Cover Studio — cover drawing engine (canvas 2D only, no libraries).
// Draws a multi-panel GTA-style poster: photos in comic-book panels, a sunset /
// neon grade wash, grain + vignette, and a title band with bold display lettering.

export const SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

export const LAYOUTS = {
  grid9: { label: '9-Panel Cover Grid', panels: 9 },
  grid4: { label: '4-Panel Grid', panels: 4 },
  hero: { label: 'Hero + Three', panels: 4 },
  full: { label: 'Full Bleed', panels: 1 },
  tilted: { label: 'Tilted Snapshots', panels: 3 },
  story: { label: 'Story Stack', panels: 3 },
};

// Each grade is a sky gradient, a translucent wash tint, a dark title-band
// gradient, and one accent colour used for the badge and the star meter.
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#ff9a3d', '#ff2e63', '#7b1fa2'],
    wash: 'rgba(255, 84, 110, 0.30)',
    band: ['#160826', '#3d0a4e'],
    accent: '#ffb347',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#00e5ff', '#7c4dff', '#ff00a8'],
    wash: 'rgba(0, 229, 255, 0.24)',
    band: ['#081230', '#2a0a4e'],
    accent: '#00e5ff',
  },
  gold: {
    label: 'Palm Gold',
    sky: ['#ffe082', '#ff7a18', '#c62828'],
    wash: 'rgba(255, 190, 60, 0.26)',
    band: ['#241503', '#4a2400'],
    accent: '#ffd76a',
  },
  teal: {
    label: 'Teal Noir',
    sky: ['#2de2c5', '#0a6cff', '#0d2b45'],
    wash: 'rgba(45, 226, 197, 0.22)',
    band: ['#031b22', '#06304a'],
    accent: '#2de2c5',
  },
  bubblegum: {
    label: 'Bubblegum',
    sky: ['#ff9ff3', '#f368e0', '#7c5cff'],
    wash: 'rgba(255, 120, 220, 0.26)',
    band: ['#2b0a33', '#4e1058'],
    accent: '#ff9ff3',
  },
  vice: {
    label: 'Vice Lights',
    sky: ['#ff6ec7', '#7873f5', '#1de9b6'],
    wash: 'rgba(255, 110, 199, 0.24)',
    band: ['#160a2e', '#3a0a4e'],
    accent: '#ff6ec7',
  },
};

// One panel's crop: pan is -1..1 on each axis (0 is centred, -1 shows the
// top / left edge of the photo), zoom multiplies the cover-fit scale.
// Default panY is negative on purpose: the sample photos have faces near the
// top, so the crop favours the top of the photo.
export function freshPanels() {
  return Array.from({ length: 9 }, () => ({ panX: 0, panY: -0.75, zoom: 1, photo: -1 }));
}

// Panel rectangles (plus a rotation for the tilted layout) inside the area
// above the title band. `titleH` is the height of the title band in px.
export function panelRects(layout, W, H, titleH) {
  const m = Math.round(Math.min(W, H) * 0.014);
  const g = Math.round(Math.min(W, H) * 0.008);
  const x0 = m;
  const y0 = m;
  const w = W - m * 2;
  const h = H - titleH - m * 2;
  const grid = (cols, rows, ox, oy, aw, ah) => {
    const out = [];
    const cw = (aw - g * (cols - 1)) / cols;
    const ch = (ah - g * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: ox + c * (cw + g), y: oy + r * (ch + g), w: cw, h: ch, rot: 0 });
      }
    }
    return out;
  };
  switch (layout) {
    case 'grid4':
      return grid(2, 2, x0, y0, w, h);
    case 'hero': {
      const heroH = (h - g) * 0.6;
      const rowH = h - heroH - g;
      return [
        { x: x0, y: y0, w, h: heroH, rot: 0 },
        ...grid(3, 1, x0, y0 + heroH + g, w, rowH),
      ];
    }
    case 'full':
      return [{ x: x0, y: y0, w, h, rot: 0 }];
    case 'tilted': {
      const cw = w * 0.5;
      const ch = h * 0.66;
      const cy = y0 + (h - ch) / 2;
      return [
        { x: x0 + w * 0.02, y: cy - h * 0.03, w: cw, h: ch, rot: -0.1 },
        { x: x0 + w * 0.25, y: cy + h * 0.04, w: cw, h: ch, rot: 0.045 },
        { x: x0 + w * 0.48, y: cy - h * 0.02, w: cw, h: ch, rot: 0.12 },
      ];
    }
    case 'story': {
      const topH = (h - g) * 0.55;
      const botH = h - topH - g;
      return [
        { x: x0, y: y0, w, h: topH, rot: 0 },
        ...grid(2, 1, x0, y0 + topH + g, w, botH),
      ];
    }
    case 'grid9':
    default:
      return grid(3, 3, x0, y0, w, h);
  }
}

function titleHeight(W, H) {
  return Math.round(H * 0.21);
}

// Which photo a panel shows: an explicit per-panel pick wins, otherwise the
// photo mode decides (mix alternates, one0 / one1 pin a single photo).
export function panelPhoto(state, index) {
  const explicit = state.panels[index]?.photo;
  if (typeof explicit === 'number' && explicit >= 0 && explicit < state.photos.length) {
    return state.photos[explicit];
  }
  if (!state.photos.length) return null;
  if (state.mode === 'one1' && state.photos[1]) return state.photos[1];
  if (state.mode === 'one0') return state.photos[0];
  return state.photos[index % state.photos.length];
}

// Cover-fit draw with clamped pan: the scale always covers the panel and the
// offset is confined to the overflow, so the photo can never leave an empty
// band at any pan or zoom.
function drawPhotoInto(ctx, img, rect, crop) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (crop.zoom || 1);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  const ox = sw - rect.w;
  const oy = sh - rect.h;
  const px = Math.max(-1, Math.min(1, crop.panX || 0));
  const py = Math.max(-1, Math.min(1, crop.panY || 0));
  const dx = rect.x - (px * 0.5 + 0.5) * ox;
  const dy = rect.y - (py * 0.5 + 0.5) * oy;
  ctx.drawImage(img, dx, dy, sw, sh);
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

let grainPattern = null;
function grain(ctx, W, H) {
  if (!grainPattern) {
    const n = document.createElement('canvas');
    n.width = 140;
    n.height = 140;
    const nx = n.getContext('2d');
    const data = nx.createImageData(140, 140);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 110 + Math.floor(Math.random() * 90);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 34;
    }
    nx.putImageData(data, 0, 0);
    grainPattern = ctx.createPattern(n, 'repeat');
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawTitleBand(ctx, W, H, state, grade) {
  const th = titleHeight(W, H);
  const top = H - th;
  const band = ctx.createLinearGradient(0, top, 0, H);
  band.addColorStop(0, grade.band[0]);
  band.addColorStop(1, grade.band[1]);
  ctx.fillStyle = band;
  ctx.fillRect(0, top, W, H - top);

  // Dotted divider above the band, like a film perforation strip.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const dot = Math.max(4, W * 0.004);
  for (let x = W * 0.03; x < W * 0.97; x += dot * 3.2) {
    ctx.beginPath();
    ctx.arc(x, top + th * 0.07, dot * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const pad = W * 0.045;
  const title = (state.title || 'NEON COAST').trim().toUpperCase();
  let size = H * 0.105;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  while (ctx.measureText(title).width > W - pad * 2 - W * 0.22 && size > 20) {
    size -= 4;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  const titleY = top + th * 0.52;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  const grad = ctx.createLinearGradient(0, titleY - size, 0, titleY);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, grade.accent);
  ctx.fillStyle = grad;
  ctx.textAlign = 'left';
  ctx.fillText(title, pad, titleY);
  ctx.restore();

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(18, H * 0.032);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9f6';
    ctx.textAlign = 'left';
    ctx.fillText(sub, pad + W * 0.008, top + th * 0.86);
  }

  // Star meter + badge, top right of the band.
  const stars = Math.max(0, Math.min(5, state.stars ?? 5));
  const sr = Math.max(10, H * 0.016);
  const gap = sr * 2.5;
  const total = gap * 5;
  const sx = W - pad - total;
  const sy = top + th * 0.3;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, sx + i * gap + sr, sy, sr);
    ctx.fillStyle = i < Math.round(stars) ? grade.accent : 'rgba(255,255,255,0.25)';
    ctx.fill();
  }
  const badge = (state.badge || 'HEAT').trim().toUpperCase();
  if (badge) {
    const bs = Math.max(14, H * 0.02);
    ctx.font = `${bs}px Anton, sans-serif`;
    const label = `${badge}  ★ ${Number(stars).toFixed(1)}`;
    const tw = ctx.measureText(label).width;
    const bw = tw + bs * 1.6;
    const bh = bs * 2.1;
    const bx = W - pad - bw;
    const by = sy + sr * 2.1;
    ctx.save();
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#1a0b2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }
}

// The whole poster. `state` carries layout, grade, photos, panels, mode and
// caption text; `selected` (editor only) draws the selection outline.
export function drawCoverArt(ctx, W, H, state, selected = -1) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const th = titleHeight(W, H);
  ctx.save();
  ctx.fillStyle = grade.band[0];
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(state.layout, W, H, th);
  if (state.layout === 'tilted') {
    // Sky backdrop with low sun rays behind the snapshot cards.
    const sky = ctx.createLinearGradient(0, 0, W, H - th);
    grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H - th);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    const cx = W * 0.5;
    const cy = (H - th) * 0.42;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - 0.1) * W, cy + Math.sin(a - 0.1) * W);
      ctx.lineTo(cx + Math.cos(a + 0.1) * W, cy + Math.sin(a + 0.1) * W);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  rects.forEach((rect, i) => {
    const photo = panelPhoto(state, i);
    const crop = state.panels[i] || { panX: 0, panY: -0.75, zoom: 1 };
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    } else {
      ctx.translate(rect.x, rect.y);
    }
    // Card body: white polaroid-style frame for tilted, hairline for grids.
    ctx.fillStyle = state.layout === 'tilted' ? '#fdf8ef' : '#12081f';
    ctx.fillRect(0, 0, rect.w, rect.h);
    const inset = state.layout === 'tilted' ? Math.max(6, rect.w * 0.02) : Math.max(2, rect.w * 0.004);
    const inner = { x: inset, y: inset, w: rect.w - inset * 2, h: rect.h - inset * 2 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    if (photo) {
      drawPhotoInto(ctx, photo.img, inner, crop);
    } else {
      const ph = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
      ph.addColorStop(0, grade.sky[0]);
      ph.addColorStop(1, grade.sky[1]);
      ctx.fillStyle = ph;
      ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    }
    // Grade wash: a soft-light tint so every panel shares one sunset look.
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = grade.wash;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.globalCompositeOperation = 'source-over';
    const shade = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(10,4,24,0.28)');
    ctx.fillStyle = shade;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.restore();
    if (state.layout === 'tilted') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.max(10, rect.w * 0.03);
      ctx.shadowOffsetY = Math.max(6, rect.h * 0.02);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(2, rect.w * 0.004);
      ctx.strokeRect(0, 0, rect.w, rect.h);
      ctx.restore();
    }
    ctx.restore();

    if (i === selected) {
      ctx.save();
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.006);
      ctx.setLineDash([Math.max(10, W * 0.012), Math.max(8, W * 0.008)]);
      ctx.strokeRect(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6);
      ctx.setLineDash([]);
      ctx.font = `${Math.max(13, H * 0.016)}px Anton, sans-serif`;
      const label = `PANEL ${i + 1}`;
      const lw = ctx.measureText(label).width;
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(rect.x, rect.y, lw + 18, Math.max(20, H * 0.026));
      ctx.fillStyle = '#1a0b2e';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, rect.x + 9, rect.y + Math.max(20, H * 0.026) / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  });

  drawTitleBand(ctx, W, H, state, grade);

  // Vignette + grain over the finished poster.
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,2,18,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H);

  // Thin light frame, like a printed poster edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.003);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();
}
