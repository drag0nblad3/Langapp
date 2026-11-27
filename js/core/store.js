// Saved progress (on this device) and the daily study queue.
import { newCard, review, recall, dayKey, Rating, MIN } from './srs.js';
import { LETTERS, WORDS, WORD_BY_ID, STORY_LIST, STORY_BY_ID, LESSON_LIST, LESSON_BY_ID, GLYPHS, GLYPH_BY_CHAR, wordUnits, drillForms } from './content.js';

// Progress is saved per language: hibi-ja, hibi-es, …
let KEY = null;

const DEFAULT_SETTINGS = {
  newPerDay: 12,
  goalMinutes: 15,
  autoplay: true,
  furigana: true,
  spacing: true,
  rate: 0.9,
  voice: null,
  quiet: false,        // no sound: listening cards become reading cards
  hideKnownRuby: false, // hide furigana over characters you have learned
};

function blank() {
  return { v: 1, cards: {}, settings: { ...DEFAULT_SETTINGS }, days: {}, lastNewKind: 'word', stories: {}, lessons: {}, created: Date.now() };
}

export let state = blank();

export function initStore(langCode) {
  KEY = `hibi-${langCode}`;
  try {
    // Early versions saved Japanese progress under 'hibi-v1'.
    if (langCode === 'ja' && !localStorage.getItem(KEY) && localStorage.getItem('hibi-v1')) {
      localStorage.setItem(KEY, localStorage.getItem('hibi-v1'));
      localStorage.removeItem('hibi-v1');
    }
  } catch (e) { /* storage unavailable */ }
  state = load();
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
      return { ...blank(), ...s };
    }
  } catch (e) { /* storage unavailable */ }
  return blank();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function replaceState(next) {
  state = { ...blank(), ...next, settings: { ...DEFAULT_SETTINGS, ...(next.settings || {}) } };
  save();
}
export function resetAll() { state = blank(); save(); }

export function today() {
  const k = dayKey(Date.now());
  return (state.days[k] ||= { reviews: 0, newCount: 0, ms: 0, read: 0 });
}

export function addTime(ms) {
  if (ms > 0 && ms < 10 * MIN) { today().ms += ms; save(); }
}

// ---- card helpers -------------------------------------------------------

export function cardKind(id) {
  return { k: 'letter', r: 'recognize', p: 'produce', s: 'sentence', g: 'grammar', l: 'listen', c: 'conjugate', h: 'glyph' }[id[0]];
}
export const letterCardId = (kana) => `k:${kana}`;
export const recogId = (wordId) => `r:${wordId}`;
export const prodId = (wordId) => `p:${wordId}`;
export const sentenceId = (storyId, line) => `s:${storyId}:${line}`;
export const drillCardId = (drillId) => `g:${drillId}`;
export const listenId = (storyId, line) => `l:${storyId}:${line}`;
export const conjId = (wordId, form) => `c:${wordId}:${form}`;
export const glyphId = (char) => `h:${char}`;

/** A character counts as learned once its card has graduated to review. */
export function glyphLearned(char) { return state.cards[glyphId(char)]?.state === 'review'; }

export function isKnownLetter(kana) { return !!state.cards[letterCardId(kana)]; }
export function isLearnedWord(wordId) { return !!state.cards[recogId(wordId)]; }

export function wordEligible(word) {
  return wordUnits(word).every(isKnownLetter);
}

/** Start learning an item: it enters the first learning step. */
export function introduce(id, { countNew = true } = {}) {
  if (state.cards[id]) return state.cards[id];
  const c = newCard(id);
  review(c, Rating.Hard, Date.now()); // enter learning at step 0
  c.reps = 0;
  state.cards[id] = c;
  if (countNew) today().newCount += 1;
  save();
  return c;
}

export function answer(id, rating) {
  const c = state.cards[id];
  const wasReview = c.state === 'review';
  review(c, rating);
  today().reviews += 1;
  // Once you can recognise a word, start practising producing it.
  if (id.startsWith('r:') && c.state === 'review' && !wasReview) {
    const pid = prodId(id.slice(2));
    if (!state.cards[pid]) {
      const p = introduce(pid, { countNew: false });
      p.due = Date.now() + 10 * MIN;
    }
  }
  save();
  return c;
}

// ---- new items ---------------------------------------------------------

function nextLetter() {
  return LETTERS.find((k) => !state.cards[letterCardId(k.unit)]) || null;
}
function nextWord() {
  return WORDS.find((w) => !state.cards[recogId(w.id)] && wordEligible(w)) || null;
}

export function newBudget() {
  const d = today();
  return Math.max(0, state.settings.newPerDay + (d.extraNew || 0) - d.newCount);
}

/** Raise today's new-item limit, e.g. "learn 5 more" after the daily lesson. */
export function addExtraNew(n) {
  const d = today();
  // Top up from what has actually been taught, so unused extras don't stack.
  d.extraNew = Math.max(0, d.newCount - state.settings.newPerDay) + n;
  save();
}

/** Characters (kanji) open up once you have started a word that uses them. */
const GLYPHS_PER_DAY = 3;
function nextGlyph() {
  if ((today().glyphs || 0) >= GLYPHS_PER_DAY) return null;
  return GLYPHS.find((g) => !state.cards[glyphId(g.char)] && g.words.some(isLearnedWord)) || null;
}

/** Choose the next thing to teach, alternating kana and words when both are available,
 *  with a character (kanji) after a word now and then. */
export function pickNew() {
  const k = nextLetter();
  const w = nextWord();
  const g = state.lastNewKind === 'word' ? nextGlyph() : null;
  if (g) return { kind: 'glyph', item: g };
  if (k && w) return state.lastNewKind === 'letter' ? { kind: 'word', item: w } : { kind: 'letter', item: k };
  if (w) return { kind: 'word', item: w };
  if (k) return { kind: 'letter', item: k };
  const g2 = nextGlyph();
  return g2 ? { kind: 'glyph', item: g2 } : null;
}

export function teach(pick) {
  state.lastNewKind = pick.kind;
  if (pick.kind === 'glyph') today().glyphs = (today().glyphs || 0) + 1;
  const id = pick.kind === 'letter' ? letterCardId(pick.item.unit)
    : pick.kind === 'glyph' ? glyphId(pick.item.char) : recogId(pick.item.id);
  return introduce(id);
}

// ---- cards that grow out of what you know ----------------------------------
// Each day a few listening cards (for sentences you have learned to read) and
// conjugation cards (for verbs you know) join your reviews, so they never flood in.

const LISTEN_PER_DAY = 3;
const CONJ_PER_DAY = 4;

export function addDailyExtras() {
  const d = today();
  let changed = false;
  for (const c of Object.values(state.cards)) {
    if ((d.listenAdded || 0) >= LISTEN_PER_DAY) break;
    if (!c.id.startsWith('s:') || c.state !== 'review') continue;
    const [, sid, li] = c.id.split(':');
    const lid = listenId(sid, li);
    if (state.cards[lid] || !STORY_BY_ID[sid]?.parsed[+li]) continue;
    introduce(lid, { countNew: false });
    d.listenAdded = (d.listenAdded || 0) + 1;
    changed = true;
  }
  for (const w of WORDS) {
    if ((d.conjAdded || 0) >= CONJ_PER_DAY) break;
    if (state.cards[recogId(w.id)]?.state !== 'review') continue;
    for (const f of drillForms(w)) {
      const cid = conjId(w.id, f.plain);
      if (state.cards[cid]) continue;
      introduce(cid, { countNew: false });
      d.conjAdded = (d.conjAdded || 0) + 1;
      changed = true;
      break; // one form per word per day, so a verb's forms are spread out
    }
  }
  if (changed) save();
}

// ---- backups ----------------------------------------------------------------

const WEEK = 7 * 24 * 60 * MIN;

/** Remind about backups once there is progress worth losing and a week has passed. */
export function backupDue(now = Date.now()) {
  if (Object.keys(state.cards).length < 30) return false;
  const b = state.backup || {};
  // Very old saves may lack `created`; the first study day is a good stand-in.
  const firstDay = Date.parse(Object.keys(state.days).sort()[0]) || now;
  const start = Math.min(state.created || now, firstDay);
  return now - Math.max(b.last || 0, b.snoozed || 0, start) > WEEK;
}
export function noteBackup() { (state.backup ||= {}).last = Date.now(); save(); }
export function snoozeBackup() { (state.backup ||= {}).snoozed = Date.now(); save(); }

// ---- queue ----------------------------------------------------------------

const LEARN_AHEAD = 20 * MIN;

export function dueCounts(now = Date.now()) {
  let learn = 0; let rev = 0;
  for (const c of Object.values(state.cards)) {
    if (c.due > now) continue;
    if (c.state === 'review') rev++; else learn++;
  }
  return { learn, review: rev, new: Math.min(newBudget(), pickNew() ? newBudget() : 0) };
}

/** What to show next in a session: { card } | { teach } | null */
export function nextItem(session, now = Date.now()) {
  const cards = Object.values(state.cards);
  const notLast = (c) => c.id !== session.lastId;
  const byDue = (a, b) => a.due - b.due;
  const learning = cards.filter((c) => c.state !== 'review' && c.due <= now).sort(byDue);
  const reviews = cards.filter((c) => c.state === 'review' && c.due <= now).sort(byDue);
  const learnFirst = learning.filter(notLast);
  if (learnFirst.length) return { card: learnFirst[0] };

  const budget = newBudget();
  const pick = budget > 0 ? pickNew() : null;
  const revs = reviews.filter(notLast);
  if (pick && (!revs.length || session.sinceNew >= 4)) return { teach: pick };
  if (revs.length) return { card: revs[0] };
  if (pick) return { teach: pick };

  const ahead = cards.filter((c) => c.state !== 'review' && c.due <= now + LEARN_AHEAD).sort(byDue);
  const aheadOther = ahead.filter(notLast);
  if (aheadOther.length) return { card: aheadOther[0] };
  if (ahead.length) return { card: ahead[0] };
  if (learning.length) return { card: learning[0] };
  if (reviews.length) return { card: reviews[0] };
  return null;
}

// ---- extra practice ------------------------------------------------------
// Practice rounds quiz cards you already know without touching their schedule,
// so you can study as much as you like and FSRS intervals stay accurate.

const practicedAt = {}; // card id -> last time practised (this app run only)

/** Cards to drill in a practice round: weakest first, recently practised last. */
export function practiceQueue(size = 15, now = Date.now()) {
  const pool = Object.values(state.cards).filter((c) => c.reps > 0 || c.state === 'review');
  const score = (c) => recall(c, now) + (practicedAt[c.id] ? 1 + practicedAt[c.id] / now : 0);
  const pick = pool.sort((a, b) => score(a) - score(b)).slice(0, size);
  // Shuffle so a round doesn't always run in the same order.
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  return pick.map((c) => c.id);
}

export function practiceCount() {
  return Object.values(state.cards).filter((c) => c.reps > 0 || c.state === 'review').length;
}

export function notePractice(id) {
  practicedAt[id] = Date.now();
  today().practiced = (today().practiced || 0) + 1;
  save();
}

/** Reviews due by the end of tomorrow. */
export function forecastTomorrow() {
  const end = Date.now() + 24 * 60 * MIN;
  return Object.values(state.cards).filter((c) => c.state === 'review' && c.due > Date.now() && c.due <= end).length;
}

export function streak() {
  const active = (k) => { const d = state.days[k]; return d && (d.reviews > 0 || d.read > 0 || d.practiced > 0); };
  let n = 0;
  const t = new Date();
  const key = (d) => dayKey(d.getTime());
  if (!active(key(t))) t.setDate(t.getDate() - 1);
  while (active(key(t))) { n++; t.setDate(t.getDate() - 1); }
  return n;
}

// ---- reading -----------------------------------------------------------

export function storyCoverage(story) {
  let total = 0; let known = 0;
  for (const l of story.parsed) {
    for (const t of l.tokens) {
      if (t.kind !== 'word') continue;
      total++;
      if (isLearnedWord(t.id)) known++;
    }
  }
  return total ? known / total : 1;
}

export function recommendedStory() {
  const unread = STORY_LIST.filter((s) => !state.stories[s.id]);
  const pool = unread.length ? unread : STORY_LIST;
  let best = null;
  for (const s of pool) {
    const cov = storyCoverage(s);
    if (cov >= 0.8) return { story: s, coverage: cov };
    if (!best || cov > best.coverage) best = { story: s, coverage: cov };
  }
  return best;
}

export function markRead(storyId) {
  state.stories[storyId] = { read: Date.now() };
  today().read += 1;
  save();
}

export function learnWordNow(wordId) {
  if (!WORD_BY_ID[wordId]) return;
  state.lastNewKind = 'word';
  introduce(recogId(wordId));
}

export function strength(card) {
  if (!card) return 'none';
  if (card.state !== 'review') return 'learning';
  return card.s >= 21 ? 'strong' : 'review';
}

// ---- grammar lessons -------------------------------------------------------
// A lesson is "ready" once you have started half the words in the story it prepares
// you for, so you meet the grammar a little before the story becomes easy to read.

export function lessonProgress(lesson) {
  const story = STORY_BY_ID[lesson.story];
  if (!story) return 1;
  let total = 0; let started = 0;
  for (const l of story.parsed) {
    for (const t of l.tokens) {
      if (t.kind !== 'word') continue;
      total++;
      if (isLearnedWord(t.id)) started++;
    }
  }
  return total ? started / total : 1;
}

export const LESSON_READY = 0.5;
export const lessonReady = (lesson) => lessonProgress(lesson) >= LESSON_READY;
export const lessonDone = (id) => !!state.lessons?.[id];

/** The first lesson you are ready for but haven't done yet. */
export function nextLesson() {
  return LESSON_LIST.find((l) => !lessonDone(l.id) && lessonReady(l)) || null;
}

/** Finish a lesson: its drills join your reviews as practice cards. */
export function completeLesson(id) {
  const lesson = LESSON_BY_ID[id];
  if (!lesson) return 0;
  (state.lessons ||= {})[id] = { done: Date.now() };
  let added = 0;
  for (const d of lesson.drills) {
    if (!state.cards[drillCardId(d.id)]) { introduce(drillCardId(d.id), { countNew: false }); added++; }
  }
  save();
  return added;
}
