// Cover art: the image when the payload has one; under it (and instead of it when the
// URL is missing or fails) a tile with the title on a colour picked from the show's
// uuid, so a cover is never an empty box and a show keeps its colour.

import { h } from './dom.js';
import { hashString } from '../core/random.js';

/** Gradient pairs for artwork tiles. */
const TILES = [
  ['#2f6690', '#16324f'], ['#3a7d44', '#1f4529'], ['#5b3a8c', '#2e1a47'], ['#2a9d8f', '#1d5c55'],
  ['#c08a1e', '#7a5410'], ['#457b9d', '#1d3557'], ['#264653', '#0f2027'], ['#8e6c8a', '#4a3048'],
];

/** The two colours of a show's tile, light then dark. */
export const tileColours = (podcast) => TILES[hashString(podcast.uuid) % TILES.length];

/**
 * A cover's image, requested as CORS when it is cross-origin, so palette.js can read its
 * pixels. Every request for a cover goes through here: an artwork host may send CORS
 * headers only when asked (Pocket Casts' CDN does), and a plain request's response,
 * cached first, would then fail a CORS one for the same cover.
 */
export function coverImage(url) {
  const img = new Image();
  if (!/^(data|blob):/.test(url) && new URL(url, location.href).origin !== location.origin) img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  return img;
}

export function artwork(podcast, label) {
  const [a, b] = tileColours(podcast);
  const el = h(
    'div',
    { class: 'art', style: `--art-a:${a};--art-b:${b}`, role: label ? 'img' : null, 'aria-label': label ? podcast.title : null },
    h('span', { class: 'art-fallback', 'aria-hidden': 'true' }, h('span', null, podcast.title)),
  );
  if (podcast.artworkUrl) {
    const img = coverImage(podcast.artworkUrl);
    img.alt = '';
    // A host with no CORS at all fails the CORS request: the cover is drawn without it, its colours unread.
    img.addEventListener('error', () => (img.crossOrigin ? img.removeAttribute('crossorigin') : img.remove()));
    el.append(img);
  }
  return el;
}
