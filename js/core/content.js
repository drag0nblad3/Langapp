// Language-neutral content model. Call initContent(pack) once before using anything else.
// Pure module (no DOM), so tools/validate.mjs can use it in Node.

export let PACK = null;
export let WORDS = [];
export let WORD_BY_ID = {};
export let GRAMMAR_BY_ID = {};
export let STORY_LIST = [];
export let STORY_BY_ID = {};
export let LESSON_LIST = [];
export let LESSON_BY_ID = {};
export let DRILL_BY_ID = {};
export let GLYPHS = [];      // optional character deck (kanji): { char, en, on, kun, words }
export let GLYPH_BY_CHAR = {};
export let LETTER_GROUPS = [];
export let LETTERS = []; // flat, in teaching order: { kana, answers, script, group, first }
export let LETTER_BY_UNIT = {};
export let CONFUSE = {};

let rubyRe = null;
let INDEX = new Map();
let EXAMPLE = {};

/** 学生[がくせい] → { plain: '学生', reading: 'がくせい', segments: [{t:'学生', r:'がくせい'}] } */
export function parseRuby(markup) {
  const segments = [];
  let last = 0;
  let m;
  rubyRe.lastIndex = 0;
  while ((m = rubyRe.exec(markup))) {
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

function splitTokens(line) {
  return line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

/**
 * Token markup:
 *   base[reading]   ruby text (furigana, pinyin, …)
 *   word=id         link to a specific dictionary entry (word or grammar id, or "name")
 *   word="gloss"    one-off meaning, not tracked as vocabulary
 *   two_words       a multi-word phrase as one token (shown with a space)
 */
export function parseToken(raw) {
  let s = raw;
  let gloss = null;
  let id = null;
  const gm = s.match(/="([^"]*)"$/);
  if (gm) { gloss = gm[1]; s = s.slice(0, gm.index); }
  const im = !gloss && s.match(/=([\w-]+)$/);
  if (im) { id = im[1]; s = s.slice(0, im.index); }
  const ruby = parseRuby(s);
  // "_" joins a multi-word phrase into one token: buenos_días → "buenos días"
  if (ruby.plain.includes('_')) {
    ruby.plain = ruby.plain.replace(/_/g, ' ');
    ruby.reading = ruby.reading.replace(/_/g, ' ');
    ruby.segments = ruby.segments.map((x) => ({ ...x, t: x.t.replace(/_/g, ' '), r: x.r && x.r.replace(/_/g, ' ') }));
  }
  const tok = { raw, ...ruby, gloss };
  if (PACK.punctuation.test(ruby.plain)) { tok.kind = 'punct'; return tok; }
  if (gloss) { tok.kind = 'gloss'; return tok; }
  if (id === 'name') { tok.kind = 'name'; return tok; }
  if (id) {
    if (WORD_BY_ID[id]) Object.assign(tok, { kind: 'word', id });
    else if (GRAMMAR_BY_ID[id]) Object.assign(tok, { kind: 'grammar', id });
    else tok.kind = 'unknown';
    return tok;
  }
  const hit = INDEX.get(ruby.plain) || INDEX.get(ruby.reading) || INDEX.get(ruby.plain.toLowerCase());
  if (hit) Object.assign(tok, hit);
  else tok.kind = 'unknown';
  return tok;
}

export function parseLine(line) {
  return splitTokens(line).map(parseToken);
}

export function initContent(pack) {
  PACK = pack;
  rubyRe = new RegExp(`(${pack.rubyBase || '[^\\s\\[\\]]'}+)\\[([^\\]]+)\\]`, 'g');

  const vocab = pack.content.flatMap((c) => (c.vocab || []).map((v) => ({ ...v, pack: c.id })));
  const grammar = pack.content.flatMap((c) => c.grammar || []);
  const stories = pack.content.flatMap((c) => (c.stories || []).map((s) => ({ ...s, pack: c.id })));

  // A later pack can add conjugations of an earlier word without editing the old pack:
  // moreForms: { wordId: { form: gloss } }.
  const moreForms = {};
  for (const c of pack.content) {
    for (const [id, f] of Object.entries(c.moreForms || {})) moreForms[id] = { ...moreForms[id], ...f };
  }

  WORDS = vocab.map((v) => {
    const r = parseRuby(v.text);
    const forms = moreForms[v.id] ? { ...v.forms, ...moreForms[v.id] } : v.forms;
    return { ...v, forms, plain: r.plain, reading: r.reading, segments: r.segments, hasRuby: r.plain !== r.reading };
  });
  WORD_BY_ID = Object.fromEntries(WORDS.map((w) => [w.id, w]));
  GRAMMAR_BY_ID = Object.fromEntries(grammar.map((g) => [g.id, g]));

  INDEX = new Map();
  for (const g of grammar) if (g.text && !INDEX.has(g.text)) INDEX.set(g.text, { kind: 'grammar', id: g.id });
  for (const w of WORDS) {
    INDEX.set(w.reading, { kind: 'word', id: w.id });
    INDEX.set(w.plain, { kind: 'word', id: w.id });
    if (pack.usesSpaces) INDEX.set(w.plain.toLowerCase(), { kind: 'word', id: w.id });
    for (const [key, formGloss] of Object.entries(w.forms || {})) {
      const f = parseRuby(key);
      const entry = { kind: 'word', id: w.id, form: f.plain, formGloss };
      INDEX.set(f.plain, entry);
      INDEX.set(f.reading, entry);
      if (pack.usesSpaces) INDEX.set(f.plain.toLowerCase(), entry);
    }
  }

  LETTER_GROUPS = pack.letters?.groups || [];
  LETTERS = [];
  for (const g of LETTER_GROUPS) {
    g.items.forEach((it, idx) => LETTERS.push({ ...it, script: g.script, group: g.id, first: idx === 0 }));
  }
  LETTER_BY_UNIT = Object.fromEntries(LETTERS.map((k) => [k.unit, k]));
  CONFUSE = pack.letters?.confuse || {};

  STORY_LIST = stories.map((s) => ({
    ...s,
    titleTokens: parseLine(s.title),
    parsed: s.lines.map(([text, en, who]) => {
      const tokens = parseLine(text);
      return {
        tokens,
        en,
        who,
        text: tokens.map((t) => t.plain).join(pack.usesSpaces ? ' ' : '').replace(/ ([.,!?;:])/g, '$1'),
        reading: tokens.map((t) => t.reading).join(pack.usesSpaces ? ' ' : ''),
      };
    }),
  }));
  STORY_BY_ID = Object.fromEntries(STORY_LIST.map((s) => [s.id, s]));

  // Grammar lessons: short explanations with examples, plus fill-in-the-blank drills
  // that become practice cards (g:<drillId>). See CONTENT.md.
  LESSON_LIST = pack.content.flatMap((c) => (c.lessons || []).map((l) => ({
    ...l,
    pack: c.id,
    body: (l.body || []).map((b) => (b.ex ? { ...b, tokens: parseLine(b.ex) } : b)),
    drills: (l.drills || []).map((d) => {
      const full = d.q.replace('___', d.answer);
      const tokens = parseLine(full);
      return {
        ...d,
        lesson: l.id,
        qTokens: splitTokens(d.q).map((raw) => (raw === '___' ? { raw, kind: 'blank', plain: '', segments: [] } : parseToken(raw))),
        tokens,
        text: tokens.map((t) => t.plain).join(pack.usesSpaces ? ' ' : '').replace(/ ([.,!?;:])/g, '$1'),
      };
    }),
  })));
  // Shown in the order of the stories they go with, so the list follows the course.
  const storyPos = Object.fromEntries(STORY_LIST.map((st, i) => [st.id, i]));
  LESSON_LIST = LESSON_LIST.map((l, i) => [l, storyPos[l.story] ?? Infinity, i])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([l]) => l);
  LESSON_BY_ID = Object.fromEntries(LESSON_LIST.map((l) => [l.id, l]));
  DRILL_BY_ID = Object.fromEntries(LESSON_LIST.flatMap((l) => l.drills.map((d) => [d.id, d])));

  EXAMPLE = {};
  FORM_EXAMPLE = {};
  for (const s of STORY_LIST) {
    s.parsed.forEach((l, i) => {
      for (const t of l.tokens) {
        if (t.kind !== 'word') continue;
        if (!EXAMPLE[t.id]) EXAMPLE[t.id] = { story: s.id, line: i };
        const fk = `${t.id}:${t.form || ''}`;
        if (t.form && !FORM_EXAMPLE[fk]) FORM_EXAMPLE[fk] = { story: s.id, line: i };
      }
    });
  }

  // Characters (kanji), each with the words that use it, in vocab order.
  GLYPHS = (pack.glyphs?.items || []).map((g) => ({ ...g, words: WORDS.filter((w) => w.plain.includes(g.char)).map((w) => w.id) }));
  GLYPH_BY_CHAR = Object.fromEntries(GLYPHS.map((g) => [g.char, g]));
}

let FORM_EXAMPLE = {};

/** A story sentence that uses this exact form of a word. */
export function formExample(wordId, form) {
  const e = FORM_EXAMPLE[`${wordId}:${form}`];
  return e ? STORY_BY_ID[e.story].parsed[e.line] : null;
}

/**
 * Conjugated forms worth drilling: forms of verbs (and words the pack marks as
 * inflecting) that differ from the dictionary form. { key, plain, reading, gloss }
 */
export function drillForms(word) {
  if (!(PACK.conjugates || ['verb']).includes(word.pos)) return [];
  return Object.entries(word.forms || {}).map(([key, gloss]) => ({ key, gloss, ...parseRuby(key) }))
    .filter((f) => f.gloss && f.plain !== word.plain && f.reading !== word.reading);
}

/** First story sentence containing a word, for context on flashcards. */
export function exampleFor(wordId) {
  const e = EXAMPLE[wordId];
  return e ? STORY_BY_ID[e.story].parsed[e.line] : null;
}

/** Letter units a word needs before it unlocks (empty if the language has no letter stage). */
export function wordUnits(word) {
  return PACK.letters ? PACK.letters.units(word.reading) : [];
}

export const romanize = (s) => (PACK.romanize ? PACK.romanize(s) : '');
