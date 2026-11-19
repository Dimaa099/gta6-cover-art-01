// Fixed screenshot scenes: ?shot=cover draws one exported cover full-frame,
// ?shot=editor shows the editor with a photo loaded. Parameters:
//   layout=grid9|grid4|hero|full|tilted|story  grade=sunset|neon|gold|teal|bubblegum|vice
//   size=square|portrait|wide  title=...  subtitle=...  badge=...  stars=0..5
// window.__shotReady is set by main.js once the scene has painted.

import { GRADES, LAYOUTS, SIZES } from './cover.js';

function pick(value, table, fallback) {
  return value && Object.prototype.hasOwnProperty.call(table, value) ? value : fallback;
}

export function readShotScene(search) {
  const q = new URLSearchParams(search);
  const kind = q.get('shot');
  if (kind !== 'cover' && kind !== 'editor') return null;
  const rawStars = q.get('stars');
  const stars = rawStars === null ? 5 : Number(rawStars);
  return {
    kind,
    layout: pick(q.get('layout'), LAYOUTS, 'grid9'),
    grade: pick(q.get('grade'), GRADES, 'sunset'),
    size: pick(q.get('size'), SIZES, 'square'),
    title: q.get('title') || 'NEON COAST',
    subtitle: q.get('subtitle') || 'sunset heist in the city of lights',
    badge: q.get('badge') || 'HEAT',
    stars: Number.isFinite(stars) ? Math.max(0, Math.min(5, stars)) : 5,
  };
}

// Runs after the app has painted a shot scene: two animation frames, then
// the screenshot harness may capture. Kept separate so the ready signal is
// one obvious place.
export function signalShotReady() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}
