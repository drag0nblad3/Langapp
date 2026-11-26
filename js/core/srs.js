// Spaced repetition scheduler based on FSRS (the algorithm in modern Anki).
// New cards go through short learning steps inside a session, then graduate
// to FSRS review intervals targeting 90% recall.

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

const W = [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RETENTION = 0.9;

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
export const LEARN_STEPS = [1, 10]; // minutes
export const RELEARN_STEPS = [10];
const DAY_START_HOUR = 4; // a "day" rolls over at 4am, like Anki

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function startOfDay(ts) {
  const d = new Date(ts - DAY_START_HOUR * 3600 * 1000);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + DAY_START_HOUR * 3600 * 1000;
}
export function dayKey(ts) {
  const d = new Date(ts - DAY_START_HOUR * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function retrievability(elapsedDays, s) {
  return Math.pow(1 + FACTOR * elapsedDays / s, DECAY);
}
function initStability(g) { return Math.max(W[g - 1], 0.1); }
function initDifficulty(g) { return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10); }
function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3);
  const dp = d + delta * (10 - d) / 9; // linear damping
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * dp, 1, 10);
}
function recallStability(d, s, r, g) {
  const hard = g === Rating.Hard ? W[15] : 1;
  const easy = g === Rating.Easy ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) * hard * easy);
}
function forgetStability(d, s, r) {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
  return Math.min(sf, s);
}
function intervalDays(s) {
  const i = s / FACTOR * (Math.pow(RETENTION, 1 / DECAY) - 1);
  return clamp(Math.round(i), 1, 36500);
}
function fuzz(days, id) {
  if (days < 3) return days;
  // deterministic small spread so cards learned together don't all return together
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const f = ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.1;
  return Math.max(1, Math.round(days * (1 + f)));
}

export function newCard(id) {
  return { id, state: 'new', step: 0, due: 0, s: 0, d: 0, last: 0, reps: 0, lapses: 0 };
}

function scheduleReview(card, now, days) {
  card.due = startOfDay(now) + fuzz(days, card.id + card.reps) * DAY;
}

/** Apply a rating to a card. Mutates and returns the card. */
export function review(card, rating, now = Date.now()) {
  const c = card;
  c.reps += 1;
  if (c.state === 'new' || c.state === 'learning') {
    if (c.state === 'new') { c.state = 'learning'; c.step = 0; }
    if (rating === Rating.Easy) return graduate(c, Rating.Easy, now);
    if (rating === Rating.Again) c.step = 0;
    else if (rating === Rating.Good) c.step += 1;
    if (c.step >= LEARN_STEPS.length) return graduate(c, Rating.Good, now);
    c.due = now + LEARN_STEPS[c.step] * MIN;
    return c;
  }
  if (c.state === 'relearning') {
    if (rating === Rating.Again) { c.step = 0; c.due = now + RELEARN_STEPS[0] * MIN; return c; }
    if (rating === Rating.Hard) { c.due = now + RELEARN_STEPS[c.step] * MIN; return c; }
    c.step += 1;
    if (c.step >= RELEARN_STEPS.length || rating === Rating.Easy) {
      c.state = 'review';
      c.last = now;
      scheduleReview(c, now, intervalDays(c.s));
      return c;
    }
    c.due = now + RELEARN_STEPS[c.step] * MIN;
    return c;
  }
  // review
  const elapsed = Math.max(0, (now - c.last) / DAY);
  const r = retrievability(elapsed, c.s);
  c.d = nextDifficulty(c.d, rating);
  if (rating === Rating.Again) {
    c.s = Math.max(0.1, forgetStability(c.d, c.s, r));
    c.lapses += 1;
    c.state = 'relearning';
    c.step = 0;
    c.last = now;
    c.due = now + RELEARN_STEPS[0] * MIN;
    return c;
  }
  c.s = recallStability(c.d, c.s, r, rating);
  c.last = now;
  scheduleReview(c, now, intervalDays(c.s));
  return c;
}

function graduate(c, g, now) {
  c.state = 'review';
  c.s = initStability(g);
  c.d = initDifficulty(g);
  c.last = now;
  c.step = 0;
  scheduleReview(c, now, intervalDays(c.s));
  return c;
}

/** Estimated chance of recalling a card right now (0 for cards still in learning). */
export function recall(card, now = Date.now()) {
  if (card.state !== 'review' || !card.s) return 0;
  return retrievability(Math.max(0, (now - card.last) / DAY), card.s);
}

/** Human-readable time until due, for preview on buttons. */
export function describeInterval(card, rating, now = Date.now()) {
  const c = review({ ...card }, rating, now);
  const ms = c.due - now;
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const d = Math.round(ms / DAY);
  if (d < 31) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export { DAY, MIN };
