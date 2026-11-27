#!/usr/bin/env node
// Checks a language pack's content and reports what each story needs.
//
//   node tools/validate.mjs [lang]                      check content (default: ja)
//   node tools/validate.mjs ja --progress backup.json   also show what fits a learner's progress
//   node tools/validate.mjs ja --update-lock            record current ids after adding content
//
// The lock file (js/langs/<lang>/ids.lock.json) protects saved progress: once an id or
// story line is published, it must not be removed, renamed or reordered.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const lang = args.find((a) => !a.startsWith('--') && !a.endsWith('.json')) || 'ja';
const progressFile = args.includes('--progress') ? args[args.indexOf('--progress') + 1] : null;
const updateLock = args.includes('--update-lock');

const { LANGUAGES } = await import(join(root, 'js/langs/index.js'));
if (!LANGUAGES[lang]) { console.error(`Unknown language "${lang}". Known: ${Object.keys(LANGUAGES).join(', ')}`); process.exit(2); }
const pack = (await LANGUAGES[lang].load()).default;
const C = await import(join(root, 'js/core/content.js'));
C.initContent(pack);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---- ids are unique
function dupes(list, what) {
  const seen = new Set();
  for (const x of list) { if (seen.has(x)) err(`Duplicate ${what} id "${x}"`); seen.add(x); }
}
const allVocab = pack.content.flatMap((c) => c.vocab || []);
const allGrammar = pack.content.flatMap((c) => c.grammar || []);
const allStories = pack.content.flatMap((c) => c.stories || []);
dupes(allVocab.map((v) => v.id), 'word');
dupes(allGrammar.map((g) => g.id), 'grammar');
dupes(allStories.map((s) => s.id), 'story');
dupes(pack.content.map((c) => c.id), 'content pack');
for (const id of allVocab.map((v) => v.id)) if (C.GRAMMAR_BY_ID[id]) err(`Id "${id}" is both a word and a grammar entry`);
for (const c of pack.content) {
  for (const id of Object.keys(c.moreForms || {})) if (!C.WORD_BY_ID[id]) err(`Pack "${c.id}" adds moreForms to "${id}", which is not a word`);
}

// ---- words
const readings = new Map();
for (const w of C.WORDS) {
  if (!w.en) err(`Word "${w.id}" has no English meaning`);
  if (!/^[a-z0-9-]+$/.test(w.id)) err(`Word id "${w.id}" should be lowercase letters, digits and dashes`);
  for (const m of pack.validateWord?.(w) || []) err(`Word "${w.id}": ${m}`);
  if (readings.has(w.reading)) warn(`Words "${readings.get(w.reading)}" and "${w.id}" share the reading ${w.reading}; story tokens need =id to pick one`);
  readings.set(w.reading, w.id);
  if (pack.letters) {
    for (const u of C.wordUnits(w)) if (!C.LETTER_BY_UNIT[u]) err(`Word "${w.id}" uses "${u}", which no letter card teaches`);
  }
}

// ---- lookup keys: two entries claiming the same text make story tokens resolve to only one
// of them (the later word wins), which can silently change the meaning of earlier stories.
const claimed = new Map();
for (const g of allGrammar) if (g.text && !claimed.has(g.text)) claimed.set(g.text, `grammar "${g.id}"`);
for (const w of C.WORDS) {
  const keys = new Set([w.plain, w.reading]);
  for (const k of Object.keys(w.forms || {})) { const f = C.parseRuby(k); keys.add(f.plain); keys.add(f.reading); }
  for (let k of keys) {
    if (pack.usesSpaces) k = k.toLowerCase();
    const prev = claimed.get(k);
    if (prev && prev !== `word "${w.id}"`) warn(`"${k}" is claimed by both ${prev} and word "${w.id}"; plain story tokens get "${w.id}" (use =id to pick)`);
    claimed.set(k, `word "${w.id}"`);
  }
}

// ---- stories
const usedWords = new Set();
const wordIndex = Object.fromEntries(C.WORDS.map((w, i) => [w.id, i]));
const known = new Set(); // words seen in earlier stories
const report = [];
for (const s of C.STORY_LIST) {
  if (!s.lines?.length) err(`Story "${s.id}" has no lines`);
  for (const t of s.titleTokens) if (t.kind === 'unknown') err(`Story "${s.id}" title: "${t.raw}" doesn't match any word, form or grammar entry`);
  const newHere = new Set();
  let glosses = 0;
  let contentTokens = 0;
  s.parsed.forEach((l, i) => {
    if (!l.en) err(`Story "${s.id}" line ${i + 1} has no translation`);
    for (const t of l.tokens) {
      if (t.kind === 'unknown') err(`Story "${s.id}" line ${i + 1}: "${t.raw}" doesn't match any word, form or grammar entry. Add it to vocab/forms/grammar, or use =id / ="gloss"`);
      if (t.kind === 'gloss') glosses++;
      if (t.kind === 'word') {
        contentTokens++;
        usedWords.add(t.id);
        if (!known.has(t.id)) newHere.add(t.id);
      }
    }
  });
  // Words are taught in vocab order, so a story becomes readable once the learner reaches
  // the vocab position that covers 90% of its word tokens.
  const positions = s.parsed.flatMap((l) => l.tokens).filter((t) => t.kind === 'word').map((t) => wordIndex[t.id] + 1).sort((x, y) => x - y);
  const readableAt = positions.length ? positions[Math.ceil(positions.length * 0.9) - 1] : 0;
  report.push({ id: s.id, title: s.titleTokens.map((t) => t.plain).join(pack.usesSpaces ? ' ' : ''), lines: s.parsed.length, newWords: [...newHere], readableAt, glosses });
  for (const id of newHere) known.add(id);
}
for (const w of C.WORDS) if (!usedWords.has(w.id)) warn(`Word "${w.id}" isn't used in any story yet (it will have no example sentence)`);

// ---- grammar lessons and their practice drills
dupes(C.LESSON_LIST.map((l) => l.id), 'lesson');
dupes(C.LESSON_LIST.flatMap((l) => l.drills.map((d) => d.id)), 'drill');
for (const l of C.LESSON_LIST) {
  if (!/^[a-z0-9-]+$/.test(l.id)) err(`Lesson id "${l.id}" should be lowercase letters, digits and dashes`);
  if (!l.title || !l.summary) err(`Lesson "${l.id}" needs a title and a summary`);
  if (l.story && !C.STORY_BY_ID[l.story]) err(`Lesson "${l.id}" links to story "${l.story}", which doesn't exist`);
  if (!l.drills.length) warn(`Lesson "${l.id}" has no drills (nothing goes into reviews)`);
  for (const b of l.body) {
    if (b.ex) {
      if (!b.en) err(`Lesson "${l.id}": example "${b.ex}" has no translation`);
      for (const t of b.tokens) if (t.kind === 'unknown') err(`Lesson "${l.id}" example: "${t.raw}" doesn't match any word, form or grammar entry`);
    }
  }
  for (const d of l.drills) {
    if (!/^[a-z0-9-]+$/.test(d.id)) err(`Drill id "${d.id}" should be lowercase letters, digits and dashes`);
    if ((d.q.match(/___/g) || []).length !== 1) err(`Drill "${d.id}" needs exactly one ___ blank`);
    if (!d.en) err(`Drill "${d.id}" has no translation`);
    const choices = new Set(d.choices || []);
    if (choices.size < 2) err(`Drill "${d.id}" needs at least two different choices`);
    if (!choices.has(d.answer)) err(`Drill "${d.id}": the answer "${d.answer}" isn't among its choices`);
    for (const t of d.tokens) if (t.kind === 'unknown') err(`Drill "${d.id}": "${t.raw}" doesn't match any word, form or grammar entry`);
  }
}

// ---- characters (kanji) and conjugation cards
dupes(C.GLYPHS.map((g) => g.char), 'kanji');
for (const g of C.GLYPHS) {
  if (!g.en) err(`Kanji "${g.char}" has no meaning`);
  if (!g.words.length) warn(`Kanji "${g.char}" isn't used by any word yet, so it never opens up`);
}
if (C.GLYPHS.length && pack.rubyBase) {
  const base = new RegExp(pack.rubyBase);
  const missing = new Set();
  for (const w of C.WORDS) for (const ch of w.plain) if (base.test(ch) && !C.GLYPH_BY_CHAR[ch]) missing.add(ch);
  if (missing.size) warn(`Kanji used in words but without a kanji card: ${[...missing].join(' ')}`);
}
for (const w of C.WORDS) {
  const seen = new Set();
  for (const f of C.drillForms(w)) {
    if (seen.has(f.plain)) err(`Word "${w.id}" lists the form "${f.plain}" twice`);
    seen.add(f.plain);
  }
}

// ---- lock file: published ids must stay stable
const lockPath = join(root, `js/langs/${lang}/ids.lock.json`);
const current = {
  words: C.WORDS.map((w) => w.id),
  letters: C.LETTERS.map((l) => l.unit),
  stories: Object.fromEntries(C.STORY_LIST.map((s) => [s.id, s.parsed.map((l) => l.text)])),
  lessons: C.LESSON_LIST.map((l) => l.id),
  drills: C.LESSON_LIST.flatMap((l) => l.drills.map((d) => d.id)),
  glyphs: C.GLYPHS.map((g) => g.char),
};
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const id of lock.words) if (!current.words.includes(id)) err(`Published word "${id}" was removed or renamed (learners' cards point to it)`);
  for (const u of lock.letters) if (!current.letters.includes(u)) err(`Published letter "${u}" was removed`);
  for (const id of lock.lessons || []) if (!current.lessons.includes(id)) err(`Published lesson "${id}" was removed or renamed (learners' progress points to it)`);
  for (const ch of lock.glyphs || []) if (!current.glyphs.includes(ch)) err(`Published kanji "${ch}" was removed (learners' cards point to it)`);
  for (const id of lock.drills || []) if (!current.drills.includes(id)) err(`Published drill "${id}" was removed or renamed (learners' practice cards point to it)`);
  for (const [sid, lines] of Object.entries(lock.stories)) {
    const now = current.stories[sid];
    if (!now) { err(`Published story "${sid}" was removed or renamed`); continue; }
    if (now.length < lines.length) err(`Story "${sid}" lost lines (saved sentence cards point to line numbers)`);
    lines.forEach((t, i) => { if (now[i] !== undefined && now[i] !== t) warn(`Story "${sid}" line ${i + 1} changed: "${t}" → "${now[i]}" (fine for fixes; saved sentence cards will show the new text)`); });
  }
} else if (!updateLock) warn('No ids.lock.json yet. Run with --update-lock to create it.');

// ---- learner progress
let progressReport = '';
if (progressFile) {
  const backup = JSON.parse(readFileSync(progressFile, 'utf8'));
  const learned = new Set(Object.keys(backup.cards || {}).filter((k) => k.startsWith('r:')).map((k) => k.slice(2)));
  const letters = new Set(Object.keys(backup.cards || {}).filter((k) => k.startsWith('k:')).map((k) => k.slice(2)));
  const strong = Object.values(backup.cards || {}).filter((c) => c.id.startsWith('r:') && c.state === 'review').length;
  const days = Object.keys(backup.days || {}).length;
  const reviews = Object.values(backup.days || {}).reduce((a, d) => a + (d.reviews || 0), 0);
  const lines = [`\nLearner progress (${progressFile})`,
    `  ${letters.size}/${C.LETTERS.length} letters, ${learned.size}/${C.WORDS.length} words started, ${strong} graduated to review`,
    `  ${days} active days, ${reviews} reviews, ${Object.keys(backup.stories || {}).length} stories read`];
  const unlearned = C.WORDS.filter((w) => !learned.has(w.id)).length;
  lines.push(`  ${unlearned} words not started yet${unlearned < 20 ? ' (time for a new content pack)' : ''}`);
  lines.push('  Story coverage for this learner:');
  for (const s of C.STORY_LIST) {
    const toks = s.parsed.flatMap((l) => l.tokens).filter((t) => t.kind === 'word');
    const k = toks.filter((t) => learned.has(t.id)).length;
    const p = toks.length ? Math.round((k / toks.length) * 100) : 100;
    lines.push(`    ${String(p).padStart(3)}%  ${s.id}  ${s.title.replace(/\s+/g, '')}${backup.stories?.[s.id] ? '  (read)' : ''}`);
  }
  progressReport = lines.join('\n');
}

// ---- output
console.log(`${pack.name} (${pack.code}): ${pack.content.length} content pack(s), ${C.LETTERS.length} letters, ${C.WORDS.length} words, ${allGrammar.length} grammar entries, ${C.STORY_LIST.length} stories, ${C.LESSON_LIST.length} grammar lessons\n`);
console.log('Stories ("90% known after" = words a learner must have started, in vocab order):');
for (const r of report) {
  console.log(`  ${r.id.padEnd(6)} ${r.title.padEnd(14)} ${String(r.lines).padStart(2)} lines  90% known after ${String(r.readableAt).padStart(3)} words  ${String(r.newWords.length).padStart(2)} words not in earlier stories  ${r.glosses} one-off glosses`);
}
if (progressReport) console.log(progressReport);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  - ${warnings.join('\n  - ')}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
if (updateLock) {
  const prev = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : { words: [], letters: [], stories: {} };
  const merged = {
    words: [...new Set([...prev.words, ...current.words])],
    letters: [...new Set([...prev.letters, ...current.letters])],
    lessons: [...new Set([...(prev.lessons || []), ...current.lessons])],
    drills: [...new Set([...(prev.drills || []), ...current.drills])],
    glyphs: [...new Set([...(prev.glyphs || []), ...current.glyphs])],
    stories: { ...current.stories, ...Object.fromEntries(Object.entries(prev.stories).filter(([k]) => !current.stories[k])) },
  };
  writeFileSync(lockPath, `${JSON.stringify(merged, null, 1)}\n`);
  console.log(`\nUpdated ${lockPath}`);
}
console.log('\nOK');
