// Saved progress (on this device) and the daily study queue.
import { newCard, review, dayKey, Rating, MIN } from './srs.js';
import { KANA_LIST, WORDS, WORD_BY_ID, STORY_LIST, wordUnits } from './content.js';

const KEY = 'hibi-v1';

const DEFAULT_SETTINGS = {
  newPerDay: 12,
  goalMinutes: 15,
  autoplay: true,
  furigana: true,
  spacing: true,
  rate: 0.9,
  voice: null,
};

function blank() {
  return { v: 1, cards: {}, settings: { ...DEFAULT_SETTINGS }, days: {}, lastNewKind: 'word', stories: {}, created: Date.now() };
}

export let state = load();

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
  return { k: 'kana', r: 'recognize', p: 'produce', s: 'sentence' }[id[0]];
}
export const kanaCardId = (kana) => `k:${kana}`;
export const recogId = (wordId) => `r:${wordId}`;
export const prodId = (wordId) => `p:${wordId}`;
export const sentenceId = (storyId, line) => `s:${storyId}:${line}`;

export function isKnownKana(kana) { return !!state.cards[kanaCardId(kana)]; }
export function isLearnedWord(wordId) { return !!state.cards[recogId(wordId)]; }

export function wordEligible(word) {
  return wordUnits(word).every(isKnownKana);
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

function nextKana() {
  return KANA_LIST.find((k) => !state.cards[kanaCardId(k.kana)]) || null;
}
function nextWord() {
  return WORDS.find((w) => !state.cards[recogId(w.id)] && wordEligible(w)) || null;
}

export function newBudget() {
  return Math.max(0, state.settings.newPerDay - today().newCount);
}

/** Choose the next thing to teach, alternating kana and words when both are available. */
export function pickNew() {
  const k = nextKana();
  const w = nextWord();
  if (k && w) return state.lastNewKind === 'kana' ? { kind: 'word', item: w } : { kind: 'kana', item: k };
  if (w) return { kind: 'word', item: w };
  if (k) return { kind: 'kana', item: k };
  return null;
}

export function teach(pick) {
  state.lastNewKind = pick.kind;
  const id = pick.kind === 'kana' ? kanaCardId(pick.item.kana) : recogId(pick.item.id);
  return introduce(id);
}

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

/** Reviews due by the end of tomorrow. */
export function forecastTomorrow() {
  const end = Date.now() + 24 * 60 * MIN;
  return Object.values(state.cards).filter((c) => c.state === 'review' && c.due > Date.now() && c.due <= end).length;
}

export function streak() {
  const active = (k) => { const d = state.days[k]; return d && (d.reviews > 0 || d.read > 0); };
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
