// Parses content markup and builds lookup indexes.
import { VOCAB, GRAMMAR_WORDS } from './data/vocab.js';
import { STORIES } from './data/stories.js';
import { KANA, kanaUnits } from './data/kana.js';

const KANJI_READ = /([一-龯々]+)\[([^\]]+)\]/g;
const PUNCT = /^[。、？！「」…・!?]+$/;

/** 学生[がくせい] → { plain: '学生', reading: 'がくせい', segments: [{t:'学生', r:'がくせい'}] } */
export function parseRuby(markup) {
  const segments = [];
  let last = 0;
  let m;
  KANJI_READ.lastIndex = 0;
  while ((m = KANJI_READ.exec(markup))) {
    if (m.index > last) segments.push({ t: markup.slice(last, m.index) });
    segments.push({ t: m[1], r: m[2] });
    last = m.index + m[0].length;
  }
  if (last < markup.length) segments.push({ t: markup.slice(last) });
  return {
    plain: segments.map((s) => s.t).join(''),
    reading: segments.map((s) => s.r || s.t).join(''),
    segments,
  };
}

export const WORDS = VOCAB.map((v) => {
  const r = parseRuby(v.jp);
  return { ...v, plain: r.plain, reading: r.reading, segments: r.segments, hasKanji: r.plain !== r.reading };
});
export const WORD_BY_ID = Object.fromEntries(WORDS.map((w) => [w.id, w]));
export const GRAMMAR_BY_ID = Object.fromEntries(GRAMMAR_WORDS.map((g) => [g.id, g]));
export const KANA_LIST = KANA;

// reading/surface → entry
const INDEX = new Map();
for (const g of GRAMMAR_WORDS) if (g.jp && !INDEX.has(g.jp)) INDEX.set(g.jp, { kind: 'grammar', id: g.id });
for (const w of WORDS) {
  INDEX.set(w.reading, { kind: 'word', id: w.id });
  INDEX.set(w.plain, { kind: 'word', id: w.id });
  for (const [form, gloss] of Object.entries(w.forms || {})) INDEX.set(form, { kind: 'word', id: w.id, form, formGloss: gloss });
}

/** Split a line into tokens, respecting quoted glosses. */
function splitTokens(line) {
  return line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

export function parseToken(raw) {
  let s = raw;
  let gloss = null;
  let id = null;
  const gm = s.match(/="([^"]*)"$/);
  if (gm) { gloss = gm[1]; s = s.slice(0, gm.index); }
  const im = !gloss && s.match(/=([\w-]+)$/);
  if (im) { id = im[1]; s = s.slice(0, im.index); }
  const ruby = parseRuby(s);
  const tok = { raw, ...ruby, gloss };
  if (PUNCT.test(ruby.plain)) { tok.kind = 'punct'; return tok; }
  if (gloss) { tok.kind = 'gloss'; return tok; }
  if (id === 'name') { tok.kind = 'name'; return tok; }
  if (id) {
    if (WORD_BY_ID[id]) Object.assign(tok, { kind: 'word', id });
    else if (GRAMMAR_BY_ID[id]) Object.assign(tok, { kind: 'grammar', id });
    else tok.kind = 'unknown';
    return tok;
  }
  const hit = INDEX.get(ruby.plain) || INDEX.get(ruby.reading);
  if (hit) Object.assign(tok, hit);
  else tok.kind = 'unknown';
  return tok;
}

export function parseLine(line) {
  return splitTokens(line).map(parseToken);
}

export const STORY_LIST = STORIES.map((s) => ({
  ...s,
  titleTokens: parseLine(s.title),
  parsed: s.lines.map(([jp, en, who]) => {
    const tokens = parseLine(jp);
    return {
      tokens,
      en,
      who,
      text: tokens.map((t) => t.plain).join(''),
      reading: tokens.map((t) => t.reading).join(''),
    };
  }),
}));
export const STORY_BY_ID = Object.fromEntries(STORY_LIST.map((s) => [s.id, s]));

/** Word ids used in a story (content words only). */
export function storyWordIds(story) {
  const ids = new Set();
  for (const l of story.parsed) for (const t of l.tokens) if (t.kind === 'word') ids.add(t.id);
  return ids;
}

/** First story sentence containing a word, for context on flashcards. */
const EXAMPLE = {};
for (const s of STORY_LIST) {
  s.parsed.forEach((l, i) => {
    for (const t of l.tokens) if (t.kind === 'word' && !EXAMPLE[t.id]) EXAMPLE[t.id] = { story: s.id, line: i };
  });
}
export function exampleFor(wordId) {
  const e = EXAMPLE[wordId];
  if (!e) return null;
  return STORY_BY_ID[e.story].parsed[e.line];
}

export function wordUnits(word) {
  return kanaUnits(word.reading);
}
