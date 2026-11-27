import * as S from './store.js';
import { Rating, describeInterval as describeIntervalFor } from './srs.js';
import { speak, listen, record, similarity, languageVoices, setVoice, setSpeechLang, recognitionAvailable, ttsAvailable } from './speech.js';
import {
  initContent, PACK, LETTER_GROUPS, LETTER_BY_UNIT, CONFUSE, WORDS, WORD_BY_ID, GRAMMAR_BY_ID,
  STORY_LIST, STORY_BY_ID, LESSON_LIST, LESSON_BY_ID, DRILL_BY_ID, exampleFor, wordUnits, romanize, parseRuby,
} from './content.js';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../langs/index.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = () => S.state.settings;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const romanHTML = (reading) => { const r = romanize(reading); return r ? `<p class="roman">${esc(r)}</p>` : ''; };

// ---------------------------------------------------------------- icons

const ICON = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  slow: '<path d="M4 6v12l8-6zM13 6v12l7-6z" fill="currentColor" opacity=".55"/>',
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  rec: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
  you: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  book: '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z M12 6v13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  gear: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.3-4.6.2 1.6 1 2.6 2 2.9C10.8 8.6 11 5.5 12 3z" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.8" fill="currentColor"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0M10 9.5a2 2 0 0 1 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};
const icon = (name, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICON[name]}</svg>`;

// ---------------------------------------------------------------- shared rendering

function rubyHTML(segments, furigana = cfg().furigana) {
  return segments.map((s) => (s.r && furigana ? `<ruby>${esc(s.t)}<rt>${esc(s.r)}</rt></ruby>` : esc(s.t))).join('');
}

function tokenClass(t) {
  if (t.kind === 'word') return S.isLearnedWord(t.id) ? 'tok known' : 'tok new';
  if (t.kind === 'punct') return 'tok punct';
  return `tok ${t.kind}`;
}

// No space before closing punctuation or after opening punctuation.
const NO_SPACE_BEFORE = /^[.,!?;:%)\]」』。、？！…]/;
const NO_SPACE_AFTER = /[¡¿(\[「『]$/;
function lineHTML(tokens, attrs = (j) => '') {
  const gap = PACK.usesSpaces ? ' ' : cfg().spacing ? '<span class="sp"> </span>' : '';
  return tokens.map((t, j) => {
    const html = `<span class="${tokenClass(t)}" ${attrs(j)}>${rubyHTML(t.segments)}</span>`;
    const prev = tokens[j - 1];
    const sep = j && gap && !NO_SPACE_BEFORE.test(t.plain) && !NO_SPACE_AFTER.test(prev.plain) ? gap : '';
    return sep + html;
  }).join('');
}

function wordHTML(w, big = false) {
  return `<span class="tl ${big ? 'tl-big' : ''}">${rubyHTML(w.segments)}</span>`;
}

function sayWord(w) { return speak(w.plain, { rate: cfg().rate }); }

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- time tracking

let activeSince = null;
function startClock() { if (!activeSince) activeSince = Date.now(); }
function stopClock() { if (activeSince) { S.addTime(Date.now() - activeSince); activeSince = null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopClock(); else if (studying()) startClock(); });
setInterval(() => { if (activeSince) { stopClock(); startClock(); } }, 30000);
const studying = () => /^#\/(session|practice|read\/|grammar\/)/.test(location.hash);

// ---------------------------------------------------------------- router

const routes = [
  [/^#\/?$|^#\/today$/, viewToday, 'today'],
  [/^#\/read$/, viewStories, 'read'],
  [/^#\/read\/(\w+)$/, viewReader, 'read'],
  [/^#\/grammar$/, viewGrammar, 'grammar'],
  [/^#\/grammar\/([\w-]+)$/, viewLesson, 'grammar'],
  [/^#\/progress$/, viewProgress, 'progress'],
  [/^#\/settings$/, viewSettings, 'settings'],
  [/^#\/session$/, viewSession, null],
  [/^#\/practice$/, viewPractice, null],
];

let cleanup = null;
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  closeSheet();
  stopClock();
  const h = location.hash || '#/today';
  for (const [re, view, tab] of routes) {
    const m = h.match(re);
    if (m) {
      document.body.dataset.tab = tab || '';
      document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
      $('.tabbar').hidden = !tab;
      window.scrollTo(0, 0);
      cleanup = view(...m.slice(1)) || null;
      if (studying()) startClock();
      return;
    }
  }
  location.hash = '#/today';
}
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------- Today

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (!location.hash || location.hash === '#/today') route(); });

function viewToday() {
  const d = S.today();
  const due = S.dueCounts();
  const pending = due.learn + due.review;
  const newLeft = S.pickNew() ? S.newBudget() : 0;
  const minutes = Math.round(d.ms / 60000);
  const goal = cfg().goalMinutes;
  const pct = Math.min(100, Math.round((minutes / goal) * 100));
  const streak = S.streak();
  const lettersKnown = Object.keys(S.state.cards).filter((id) => id.startsWith('k:')).length;
  const lettersTotal = Object.keys(LETTER_BY_UNIT).length;
  const wordsKnown = WORDS.filter((w) => S.isLearnedWord(w.id)).length;
  const sentences = Object.keys(S.state.cards).filter((id) => id.startsWith('s:')).length;
  const rec = S.recommendedStory();
  const fresh = !Object.keys(S.state.cards).length;
  const anything = pending + newLeft > 0;
  const canPractice = S.practiceCount() > 0;

  app.innerHTML = `
    <header class="top">
      <div>
        <p class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${Object.keys(LANGUAGES).length > 1 ? ` · <a href="#/settings" class="lang-link">${esc(PACK.name)}</a>` : ''}</p>
        <h1 class="tl">${fresh ? PACK.ui.welcome : PACK.ui.greeting(new Date().getHours())}</h1>
      </div>
      <div class="streak ${streak ? 'lit' : ''}" title="Day streak">${icon('flame', 22)}<b>${streak}</b></div>
    </header>

    ${fresh ? `<section class="card intro">
      <p>Welcome to <b>Hibi</b> (日々, "day by day"). ${PACK.ui.intro}</p>
      <p class="muted">About 15 minutes a day. Turn your sound on.</p>
    </section>` : ''}

    <section class="card session-card">
      <div class="goal">
        <div class="ring" style="--p:${pct}"><span>${minutes}<small>/${goal}m</small></span></div>
        <div class="counts">
          <div><b>${pending}</b><span>to review</span></div>
          <div><b>${newLeft}</b><span>new today</span></div>
          <div><b>${d.reviews}</b><span>done today</span></div>
        </div>
      </div>
      ${anything
        ? `<a class="btn primary big" href="#/session">${fresh ? 'Start your first lesson' : pending ? 'Start session' : 'Learn something new'}</a>`
        : `<p class="done-msg">${icon('check', 18)} All caught up for today. ${S.forecastTomorrow()} reviews tomorrow.</p>
           ${moreButtons()}`}
      ${anything && canPractice ? `<a class="btn ghost wide more" href="#/practice">${icon('refresh', 18)} Extra practice</a>` : ''}
    </section>

    ${rec && wordsKnown >= 5 ? `<a class="card story-rec" href="#/read/${rec.story.id}">
      <p class="eyebrow">Read next</p>
      <div class="story-row">
        <div><h2 class="tl">${lineHTML(rec.story.titleTokens)}</h2><p class="muted">${esc(rec.story.en)}</p></div>
        ${coverageBadge(rec.coverage)}
      </div>
    </a>` : ''}

    ${(() => {
      const l = S.nextLesson();
      return l ? `<a class="card story-rec lesson-rec" href="#/grammar/${l.id}">
      <p class="eyebrow">New grammar lesson</p>
      <div class="story-row"><div><h2>${titleHTML(l.title)}</h2><p class="muted">${esc(l.summary || '')}</p></div><span class="go">${icon('book', 22)}</span></div>
    </a>` : '';
    })()}

    <section class="stats">
      ${lettersTotal ? `<div class="stat"><b>${lettersKnown}<small>/${lettersTotal}</small></b><span>${esc(PACK.letters.name)}</span></div>` : ''}
      <div class="stat"><b>${wordsKnown}<small>/${WORDS.length}</small></b><span>words</span></div>
      <div class="stat"><b>${sentences}</b><span>sentences saved</span></div>
    </section>

    ${installPrompt ? `<button class="btn ghost wide" data-action="install">Install Hibi on your home screen</button>` : ''}
  `;
}

function coverageBadge(c) {
  const p = Math.round(c * 100);
  const cls = p >= 90 ? 'good' : p >= 70 ? 'ok' : 'hard';
  return `<span class="cov ${cls}" title="Words you know">${p}%<small>known</small></span>`;
}

// ---------------------------------------------------------------- Session

let session = null;

function viewSession() {
  session = { lastId: null, sinceNew: 0, done: 0, startedAt: Date.now() };
  nextInSession();
  const onKey = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'INPUT') return;
    const b = $('[data-default]');
    if (b) { e.preventDefault(); b.click(); }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

function sessionFrame(inner, { label = '' } = {}) {
  let left; let total;
  if (session.practice) {
    left = session.queue.length;
    total = session.done + left;
  } else {
    const due = S.dueCounts();
    left = due.learn + due.review + (S.pickNew() ? S.newBudget() : 0);
    total = session.done + left;
  }
  const pct = total ? Math.round((session.done / total) * 100) : 100;
  app.innerHTML = `
    <div class="session">
      <div class="session-top">
        <a class="icon-btn" href="#/today" aria-label="${session.practice ? 'End practice' : 'End session'}">${icon('x')}</a>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <span class="left">${left}</span>
      </div>
      ${label ? `<p class="kind">${session.practice ? 'Practice · ' : ''}${label}</p>` : ''}
      <div class="stage">${inner}</div>
    </div>`;
}

function nextInSession() {
  if (session.practice) {
    let id;
    while ((id = session.queue.shift()) && !S.state.cards[id]);
    if (!id) return practiceDone();
    return showCard(S.state.cards[id]);
  }
  const next = S.nextItem(session);
  if (!next) return sessionDone();
  if (next.teach) return showTeach(next.teach);
  showCard(next.card);
}

function showCard(c) {
  const kind = S.cardKind(c.id);
  if (kind === 'letter') return showLetter(c);
  if (kind === 'recognize') return showRecognize(c);
  if (kind === 'produce') return showProduce(c);
  if (kind === 'sentence') return showSentence(c);
  if (kind === 'grammar') return showDrill(c);
  // unknown card: drop it
  delete S.state.cards[c.id];
  S.save();
  nextInSession();
}

function finishCard(id, rating) {
  if (session.practice) return finishPractice(id, rating);
  S.answer(id, rating);
  session.lastId = id;
  session.done += 1;
  session.sinceNew += 1;
  nextInSession();
}

function finishPractice(id, rating) {
  if (!session.missed) session.missed = new Set();
  if (!session.misses) session.misses = {};
  if (rating === Rating.Again && (session.misses[id] || 0) < 2) {
    // Bring a miss back a few cards later (at most twice), so a round always ends.
    session.misses[id] = (session.misses[id] || 0) + 1;
    session.queue.splice(Math.min(3, session.queue.length), 0, id);
    session.missed.add(id);
  } else {
    if (rating !== Rating.Again && !session.missed.has(id)) session.right += 1;
    session.done += 1;
  }
  S.notePractice(id);
  session.lastId = id;
  nextInSession();
}

function sessionDone() {
  stopClock(); startClock();
  const d = S.today();
  const rec = S.recommendedStory();
  app.innerHTML = `
    <div class="session done">
      <div class="stage center">
        <div class="seal">${esc(PACK.ui.sessionDone)}</div>
        <h1>Session complete</h1>
        <p class="muted">${session.done} cards this session · ${d.reviews} today · ${Math.round(d.ms / 60000)} min</p>
        ${rec && rec.coverage >= 0.5 ? `<p>Now read something you mostly understand:</p>
          <a class="card story-rec" href="#/read/${rec.story.id}"><div class="story-row"><div><h2 class="tl">${lineHTML(rec.story.titleTokens)}</h2><p class="muted">${esc(rec.story.en)}</p></div>${coverageBadge(rec.coverage)}</div></a>` : ''}
        <div class="more-row">${moreButtons()}</div>
        <a class="btn primary big" href="#/today">Done</a>
      </div>
    </div>`;
}

/** "Keep going" options once the daily queue is empty. */
function moreButtons() {
  const out = [];
  if (S.practiceCount()) out.push(`<a class="btn wide" href="#/practice">${icon('refresh', 18)} Practice what you know</a>`);
  if (S.pickNew()) out.push(`<button class="btn wide" data-action="learnmore">${icon('plus', 18)} Learn ${MORE_NEW} more</button>`);
  return out.join('');
}
const MORE_NEW = 5;

// --- extra practice: drill known cards without changing their schedule

function viewPractice() {
  const queue = pendingPractice || S.practiceQueue();
  pendingPractice = null;
  if (!queue.length) { location.hash = '#/today'; return; }
  session = { practice: true, queue, total: queue.length, lastId: null, sinceNew: 0, done: 0, right: 0, startedAt: Date.now() };
  nextInSession();
  const onKey = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'INPUT') return;
    const b = $('[data-default]');
    if (b) { e.preventDefault(); b.click(); }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

function practiceDone() {
  stopClock(); startClock();
  const d = S.today();
  app.innerHTML = `
    <div class="session done">
      <div class="stage center">
        <div class="seal">${icon('check', 44)}</div>
        <h1>Practice round done</h1>
        <p class="muted">${session.right} of ${session.total} right first time · ${Math.round(d.ms / 60000)} min today</p>
        <p class="muted small">Practice doesn't change when cards are due, so your schedule stays on track.</p>
        <div class="more-row">
          <button class="btn wide" data-action="practiceagain">${icon('refresh', 18)} Another round</button>
          ${S.pickNew() ? `<button class="btn wide" data-action="learnmore">${icon('plus', 18)} Learn ${MORE_NEW} more</button>` : ''}
        </div>
        <a class="btn primary big" href="#/today">Done</a>
      </div>
    </div>`;
}

// --- teaching screens

function showTeach(pick) {
  session.sinceNew = 0;
  if (pick.kind === 'letter') {
    const k = pick.item;
    const group = LETTER_GROUPS.find((g) => g.id === k.group);
    const confuse = (CONFUSE[k.unit] || []).filter(S.isKnownLetter);
    sessionFrame(`
      <div class="teach">
        <p class="badge">New ${group.script}</p>
        ${k.first && group.note ? `<p class="note">${esc(group.note)}</p>` : ''}
        <button class="letter-big" data-action="say" data-text="${esc(k.unit)}">${esc(k.unit)}</button>
        <p class="roman">${esc(k.answers[0])}</p>
        ${confuse.length ? `<p class="muted small">Don't mix it up with ${confuse.map((c) => `<span class="tl">${c}</span> (${LETTER_BY_UNIT[c].answers[0]})`).join(', ')}.</p>` : ''}
        <p class="muted small">Tap the character to hear it. Say it out loud.</p>
      </div>
      <div class="actions"><button class="btn primary big" data-default data-action="taught" data-kind="letter" data-id="${esc(k.unit)}">Got it</button></div>
    `, { label: `${group.name} · new` });
    if (cfg().autoplay) speak(k.unit, { rate: cfg().rate });
    return;
  }
  const w = pick.item;
  const ex = exampleFor(w.id);
  sessionFrame(`
    <div class="teach">
      <p class="badge">New word</p>
      <button class="word-big" data-action="sayword" data-id="${w.id}">${wordHTML(w, true)}</button>
      ${romanHTML(w.reading)}
      <p class="meaning">${esc(w.en)}</p>
      <p class="muted small">${esc(w.pos)}${w.hint ? ` · ${esc(w.hint)}` : ''}</p>
      ${ex ? exampleHTML(ex) : ''}
    </div>
    <div class="actions"><button class="btn primary big" data-default data-action="taught" data-kind="word" data-id="${w.id}">Got it</button></div>
  `, { label: 'New word' });
  if (cfg().autoplay) sayWord(w);
}

function exampleHTML(ex) {
  return `<div class="example">
    <button class="icon-btn sm" data-action="say" data-text="${esc(ex.text)}" aria-label="Play">${icon('play', 16)}</button>
    <div><p class="tl">${lineHTML(ex.tokens)}</p><p class="muted small">${esc(ex.en)}</p></div>
  </div>`;
}

// --- letter card (type the reading)

function showLetter(c) {
  const kana = c.id.slice(2);
  const k = LETTER_BY_UNIT[kana];
  if (!k) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  sessionFrame(`
    <form class="quiz" data-action="checkLetter" data-id="${esc(c.id)}">
      <div class="letter-big static">${esc(kana)}</div>
      <input class="answer" name="a" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="type the reading${PACK.romanName ? ` in ${PACK.romanName}` : ''}" aria-label="Reading">
      <div class="actions"><button class="btn primary big" type="submit">Check</button></div>
    </form>
  `, { label: cap(k.script || PACK.letters.name) });
  focusAnswer();
}

function checkLetter(form) {
  const id = form.dataset.id;
  const kana = id.slice(2);
  const k = LETTER_BY_UNIT[kana];
  const given = form.a.value.trim().toLowerCase();
  if (!given) return;
  const ok = k.answers.includes(given);
  speak(kana, { rate: cfg().rate });
  resultScreen({ id, ok, given, right: `<span class="letter-mid tl">${esc(kana)}</span> = <b>${esc(k.answers[0])}</b>${k.answers.length > 1 ? ` <span class="muted">(also ${k.answers.slice(1).join(', ')})</span>` : ''}` });
}

function resultScreen({ id, ok, given, right, extra = '', override = true }) {
  const card = S.state.cards[id];
  const describeInterval = session.practice ? () => '' : describeIntervalFor;
  const stage = $('.stage');
  stage.innerHTML = `
    <div class="result ${ok ? 'ok' : 'bad'}">
      <div class="verdict">${icon(ok ? 'check' : 'x', 28)}<span>${ok ? 'Correct' : 'Not quite'}</span></div>
      ${!ok ? `<p class="muted">You answered <b>${esc(given)}</b></p>` : ''}
      <p class="right">${right}</p>
      ${extra}
    </div>
    <div class="actions row">
      ${ok
        ? `<button class="btn" data-action="rate" data-id="${esc(id)}" data-r="${Rating.Easy}">Too easy <small>${describeInterval(card, Rating.Easy)}</small></button>
           <button class="btn primary" data-default data-action="rate" data-id="${esc(id)}" data-r="${Rating.Good}">Continue <small>${describeInterval(card, Rating.Good)}</small></button>`
        : `${override ? `<button class="btn" data-action="rate" data-id="${esc(id)}" data-r="${Rating.Good}">I was right</button>` : ''}
           <button class="btn primary" data-default data-action="rate" data-id="${esc(id)}" data-r="${Rating.Again}">Continue</button>`}
    </div>`;
  setTimeout(() => $('[data-default]')?.focus(), 50);
}

// --- word recognition (see/hear → recall meaning)

function showRecognize(c) {
  const w = WORD_BY_ID[c.id.slice(2)];
  if (!w) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  sessionFrame(`
    <div class="flash">
      <button class="word-big" data-action="sayword" data-id="${w.id}">${wordHTML(w, true)}</button>
      <p class="muted small">What does it mean?</p>
    </div>
    <div class="actions"><button class="btn primary big" data-default data-action="reveal" data-id="${esc(c.id)}">Show answer</button></div>
  `, { label: 'Word · meaning' });
  if (cfg().autoplay) sayWord(w);
}

function gradeButtons(id) {
  const c = S.state.cards[id];
  const describeInterval = session.practice ? () => '' : describeIntervalFor;
  const b = (r, label, cls = '') => `<button class="btn grade ${cls}" ${r === Rating.Good ? 'data-default' : ''} data-action="rate" data-id="${esc(id)}" data-r="${r}">${label}<small>${describeInterval(c, r)}</small></button>`;
  return `<div class="actions grades">
    ${b(Rating.Again, 'Forgot', 'again')}${b(Rating.Hard, 'Hard')}${b(Rating.Good, 'Got it', 'primary')}${b(Rating.Easy, 'Easy')}
  </div>`;
}

function reveal(id) {
  const kind = S.cardKind(id);
  const stage = $('.stage');
  if (kind === 'recognize') {
    const w = WORD_BY_ID[id.slice(2)];
    const ex = exampleFor(w.id);
    stage.innerHTML = `
      <div class="flash">
        <button class="word-big" data-action="sayword" data-id="${w.id}">${wordHTML(w, true)}</button>
        ${romanHTML(w.reading)}
        <p class="meaning">${esc(w.en)}</p>
        ${ex ? exampleHTML(ex) : ''}
      </div>
      ${gradeButtons(id)}`;
  } else if (kind === 'sentence') {
    const [, sid, li] = id.split(':');
    const line = STORY_BY_ID[sid].parsed[+li];
    stage.innerHTML = `
      <div class="flash">
        <p class="sentence tl">${lineHTML(line.tokens)}</p>
        <p class="meaning">${esc(line.en)}</p>
        <button class="btn ghost" data-action="say" data-text="${esc(line.text)}">${icon('play', 16)} Play again</button>
      </div>
      ${gradeButtons(id)}`;
  }
}

// --- word production (English → type it in the target language)

function showProduce(c) {
  const w = WORD_BY_ID[c.id.slice(2)];
  if (!w) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  sessionFrame(`
    <form class="quiz" data-action="checkProduce" data-id="${esc(c.id)}">
      <p class="prompt">${esc(w.en)}</p>
      ${w.hint ? `<p class="muted small">${esc(w.hint)}</p>` : ''}
      <p class="muted small">${esc(PACK.input.hint(w))}</p>
      <input class="answer" name="a" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="${esc(PACK.input.placeholder)}" data-word="${w.id}" data-live="1" aria-label="Answer">
      <p class="preview tl" aria-live="polite">&nbsp;</p>
      <div class="actions"><button class="btn primary big" type="submit">Check</button></div>
    </form>
  `, { label: 'Word · say it' });
  focusAnswer();
}

function livePreview(input) {
  const shown = PACK.input.convert(input.value, false, WORD_BY_ID[input.dataset.word]);
  input.form.querySelector('.preview').innerHTML = shown && shown !== input.value ? esc(shown) : '&nbsp;';
}

function checkProduce(form) {
  const id = form.dataset.id;
  const w = WORD_BY_ID[id.slice(2)];
  const raw = form.a.value.trim();
  if (!raw) return;
  const given = PACK.input.convert(raw, true, w);
  const norm = PACK.input.normalize;
  const ok = norm(given) === norm(w.reading) || norm(raw) === norm(w.plain);
  sayWord(w);
  resultScreen({
    id, ok, given,
    right: `${wordHTML(w)} <span class="muted">${esc(romanize(w.reading))}</span>`,
    extra: `<p class="muted small">${esc(w.en)}</p>${(() => { const n = PACK.input.note?.(raw, w, ok); return n ? `<p class="note">${esc(n)}</p>` : ''; })()}`,
  });
}

// --- sentence card (hear/read sentence → understand)

function showSentence(c) {
  const [, sid, li] = c.id.split(':');
  const line = STORY_BY_ID[sid]?.parsed[+li];
  if (!line) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  sessionFrame(`
    <div class="flash">
      <p class="sentence tl">${lineHTML(line.tokens)}</p>
      <button class="btn ghost" data-action="say" data-text="${esc(line.text)}">${icon('play', 16)} Listen</button>
      <p class="muted small">Do you understand it?</p>
    </div>
    <div class="actions"><button class="btn primary big" data-default data-action="reveal" data-id="${esc(c.id)}">Show meaning</button></div>
  `, { label: 'Sentence' });
  if (cfg().autoplay) speak(line.text, { rate: cfg().rate });
}

function focusAnswer() {
  setTimeout(() => $('.answer')?.focus(), 60);
}

// --- grammar drill (fill the gap: pick the right form)

function blankLineHTML(tokens, fill = null) {
  return lineHTML(tokens.map((t) => (t.kind === 'blank'
    ? { ...t, kind: 'blank', plain: '___', segments: [{ t: fill || '＿＿＿' }] }
    : t)));
}

function showDrill(c) {
  const d = DRILL_BY_ID[c.id.slice(2)];
  if (!d) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  const lesson = LESSON_BY_ID[d.lesson];
  const order = d.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  sessionFrame(`
    <div class="flash drill">
      <p class="sentence tl">${blankLineHTML(d.qTokens)}</p>
      <p class="muted">${esc(d.en)}</p>
      <div class="choices">
        ${order.map((i) => `<button class="btn choice tl" data-action="pick" data-id="${esc(c.id)}" data-i="${i}">${rubyHTML(parseRuby(d.choices[i]).segments)}</button>`).join('')}
      </div>
    </div>
  `, { label: `Grammar · ${titleText(lesson.title)}` });
}

function checkDrill(el) {
  const id = el.dataset.id;
  const d = DRILL_BY_ID[id.slice(2)];
  const given = d.choices[+el.dataset.i];
  const ok = given === d.answer;
  speak(d.text, { rate: cfg().rate });
  resultScreen({
    id, ok, given: parseRuby(given).plain, override: false,
    right: `<span class="tl sentence-sm">${lineHTML(d.tokens)}</span>`,
    extra: `<p class="muted small">${esc(d.en)}</p>
      ${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}
      <button class="btn ghost sm" data-action="say" data-text="${esc(d.text)}">${icon('play', 16)} Play</button>
      <a class="muted small lesson-ref" href="#/grammar/${d.lesson}">Lesson: ${titleHTML(LESSON_BY_ID[d.lesson].title)}</a>`,
  });
}

// ---------------------------------------------------------------- Grammar lessons

let pendingPractice = null; // a lesson's drills, for "try them now"
let lessonTokens = [];      // tokens of the examples on screen, for tap-to-look-up

/** Lesson titles may hold target-language text with ruby: "The て-form", "ser vs estar". */
function titleHTML(title) { return rubyHTML(parseRuby(title).segments); }
function titleText(title) { return parseRuby(title).plain; }

/** Lesson paragraphs: **bold** marks target-language words, and ruby markup works as in titles. */
function proseHTML(text) {
  return text.split('**').map((part, i) => {
    const html = rubyHTML(parseRuby(part).segments);
    return i % 2 ? `<b class="tl">${html}</b>` : html;
  }).join('');
}

function viewGrammar() {
  const next = S.nextLesson();
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Short lessons</p><h1>Grammar</h1></div></header>
    <p class="muted lead">Each lesson explains one point with examples. A lesson opens up once you know half the words of the story it goes with. Finish it, and its fill-in-the-blank cards join your daily reviews.</p>
    <div class="list">
      ${LESSON_LIST.map((l, i) => {
        const done = S.lessonDone(l.id);
        const ready = S.lessonReady(l);
        const state = done ? 'done' : l === next ? 'next' : ready ? 'ready' : 'later';
        return `<a class="card story-item lesson-item ${state}" href="#/grammar/${l.id}">
          <span class="num">${i + 1}</span>
          <div class="grow"><h2>${titleHTML(l.title)}</h2><p class="muted">${esc(l.summary || '')}</p></div>
          ${done ? `<span class="read-mark" title="Done">${icon('check', 18)}</span>` : l === next ? '<span class="cov good">Next</span>' : ready ? '' : `<span class="cov hard" title="Words you know from its story">${Math.round(S.lessonProgress(l) * 100)}%<small>of words</small></span>`}
        </a>`;
      }).join('')}
    </div>`;
}

function viewLesson(id) {
  const l = LESSON_BY_ID[id];
  if (!l) { location.hash = '#/grammar'; return; }
  const story = STORY_BY_ID[l.story];
  const done = S.lessonDone(l.id);
  lessonTokens = [];
  const body = l.body.map((b) => {
    if (typeof b === 'string') return `<p>${proseHTML(b)}</p>`;
    if (b.ex) {
      const i = lessonTokens.push(b.tokens) - 1;
      const text = b.tokens.map((t) => t.plain).join(PACK.usesSpaces ? ' ' : '');
      return `<div class="example">
        <button class="icon-btn sm" data-action="say" data-text="${esc(text)}" aria-label="Play">${icon('play', 16)}</button>
        <div><p class="tl">${lineHTML(b.tokens, (j) => `data-action="ltok" data-i="${i}" data-t="${j}"`)}</p><p class="muted small">${esc(b.en)}</p></div>
      </div>`;
    }
    if (b.table) {
      return `<table class="gtable">${b.table.map((row, r) => `<tr>${row.map((cell) => (r === 0 && b.head ? `<th>${proseHTML(cell)}</th>` : `<td class="tl">${rubyHTML(parseRuby(cell).segments)}</td>`)).join('')}</tr>`).join('')}</table>`;
    }
    if (b.tip) return `<p class="note">${proseHTML(b.tip)}</p>`;
    return '';
  }).join('');
  app.innerHTML = `
    <header class="top reader-top">
      <a class="icon-btn" href="#/grammar" aria-label="Back">${icon('back')}</a>
      <div class="grow"><p class="eyebrow">Grammar</p><h1>${titleHTML(l.title)}</h1>${l.summary ? `<p class="muted">${esc(l.summary)}</p>` : ''}</div>
    </header>
    <article class="lesson">${body}</article>
    ${story ? `<a class="card lesson-link" href="#/read/${story.id}">${icon('book', 18)}<span class="grow">See it in a story: <b class="tl">${lineHTML(story.titleTokens)}</b></span>${coverageBadge(S.storyCoverage(story))}</a>` : ''}
    <div class="reader-end">
      <p class="muted small">${l.drills.length} practice cards: pick the word that fits the gap.</p>
      ${done
        ? `<p class="done-msg">${icon('check', 18)} Done. Its cards are in your reviews.</p>
           <button class="btn wide" data-action="lessonpractice" data-id="${l.id}">${icon('refresh', 18)} Practise these now</button>`
        : `<button class="btn primary big" data-action="lessondone" data-id="${l.id}">Add ${l.drills.length} cards to my reviews</button>
           <button class="btn wide" data-action="lessonpractice" data-id="${l.id}">${icon('refresh', 18)} Add them and practise now</button>`}
    </div>`;
}

// ---------------------------------------------------------------- Stories

function viewStories() {
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Graded reading</p><h1>Read</h1></div></header>
    <p class="muted lead">Short stories made of words you're learning. Aim for ones where you know <b>90%</b> or more. New words are underlined: tap any word to look it up.</p>
    <div class="list">
      ${STORY_LIST.map((s, i) => `
        <a class="card story-item" href="#/read/${s.id}">
          <span class="num">${i + 1}</span>
          <div class="grow"><h2 class="tl">${lineHTML(s.titleTokens)}</h2><p class="muted">${esc(s.en)}</p></div>
          ${S.state.stories[s.id] ? `<span class="read-mark" title="Read">${icon('check', 18)}</span>` : ''}
          ${coverageBadge(S.storyCoverage(s))}
        </a>`).join('')}
    </div>`;
}

let playAllToken = 0;
const recordings = {};

function viewReader(id) {
  const s = STORY_BY_ID[id];
  if (!s) { location.hash = '#/read'; return; }
  const cov = S.storyCoverage(s);
  const canRec = !!(navigator.mediaDevices && window.MediaRecorder);
  app.innerHTML = `
    <header class="top reader-top">
      <a class="icon-btn" href="#/read" aria-label="Back">${icon('back')}</a>
      <div class="grow"><h1 class="tl">${lineHTML(s.titleTokens)}</h1><p class="muted">${esc(s.en)}</p></div>
      ${coverageBadge(cov)}
    </header>
    <div class="reader-tools">
      <button class="btn ghost sm" data-action="playall" data-id="${s.id}">${icon('ear', 16)} Listen to all</button>
      ${PACK.rubyBase ? `<button class="btn ghost sm" data-action="toggle" data-key="furigana">${cfg().furigana ? 'Hide' : 'Show'} ${esc(PACK.rubyName)}</button>` : ''}
      <button class="btn ghost sm" data-action="toggleEN">${icon('eye', 16)} English</button>
    </div>
    ${LESSON_LIST.filter((l) => l.story === s.id).map((l) => `<a class="card lesson-link" href="#/grammar/${l.id}">${icon('book', 18)}<span class="grow">Grammar lesson: <b>${titleHTML(l.title)}</b></span>${S.lessonDone(l.id) ? icon('check', 18) : ''}</a>`).join('')}
    ${s.grammar?.length ? `<details class="card grammar"><summary>Grammar in this story</summary>
      <dl>${s.grammar.map(([a, b]) => `<dt class="tl">${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    </details>` : ''}
    <div class="lines">
      ${s.parsed.map((l, i) => {
        const saved = !!S.state.cards[S.sentenceId(s.id, i)];
        return `<div class="line" id="line-${i}">
          ${l.who ? `<span class="who tl">${esc(l.who)}</span>` : ''}
          <p class="tl text">${lineHTML(l.tokens, (j) => `data-action="tok" data-s="${s.id}" data-l="${i}" data-t="${j}"`)}</p>
          <p class="en muted">${esc(l.en)}</p>
          <div class="line-tools">
            <button class="icon-btn sm" data-action="sayline" data-s="${s.id}" data-l="${i}" aria-label="Play">${icon('play', 16)}</button>
            <button class="icon-btn sm" data-action="sayline" data-s="${s.id}" data-l="${i}" data-slow="1" aria-label="Play slowly">${icon('slow', 16)}</button>
            ${canRec ? `<button class="icon-btn sm" data-action="rec" data-s="${s.id}" data-l="${i}" aria-label="Record yourself">${icon('rec', 14)}</button>
            <button class="icon-btn sm" data-action="playrec" data-s="${s.id}" data-l="${i}" aria-label="Play your recording" ${recordings[`${s.id}:${i}`] ? '' : 'hidden'}>${icon('you', 16)}</button>` : ''}
            ${recognitionAvailable() ? `<button class="icon-btn sm" data-action="check" data-s="${s.id}" data-l="${i}" aria-label="Check pronunciation">${icon('mic', 16)}</button>` : ''}
            <span class="grow"></span>
            <button class="btn sm ${saved ? 'saved' : ''}" data-action="mine" data-s="${s.id}" data-l="${i}">${saved ? `${icon('check', 14)} Saved` : `${icon('plus', 14)} Save`}</button>
          </div>
          <p class="heard muted small" hidden></p>
        </div>`;
      }).join('')}
    </div>
    <div class="reader-end">
      <p class="muted small">Shadowing tip: play a line, then say it along with the audio, matching the rhythm. Record yourself and compare.</p>
      <button class="btn primary big" data-action="finish" data-id="${s.id}">${S.state.stories[s.id] ? 'Read again ✓' : 'Finished reading'}</button>
    </div>`;
  return () => { playAllToken++; speechSynthesis?.cancel?.(); };
}

function showTokenSheet(t) {
  let body = '';
  if (t.kind === 'word') {
    const w = WORD_BY_ID[t.id];
    const learned = S.isLearnedWord(w.id);
    body = `
      <div class="sheet-head">
        <button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${rubyHTML(t.segments, true)}</button>
        ${romanHTML(t.reading)}
      </div>
      <p class="meaning">${esc(t.formGloss || w.en)}</p>
      ${t.form && t.formGloss !== w.en ? `<p class="muted small">Form of ${wordHTML(w)}: ${esc(w.en)}</p>` : `<p class="muted small">${t.form ? `${wordHTML(w)} · ` : ''}${esc(w.pos)}</p>`}
      ${learned
        ? `<p class="muted small">${icon('check', 14)} In your deck</p>`
        : S.wordEligible(w)
          ? `<button class="btn primary wide" data-action="learn" data-id="${w.id}">${icon('plus', 16)} Add to my deck</button>`
          : `<p class="muted small">This word unlocks after you learn the ${esc(PACK.letters?.name || 'letters')}: ${wordUnits(w).filter((u) => !S.isKnownLetter(u)).map(esc).join(' ')}</p>
             <button class="btn wide" data-action="learn" data-id="${w.id}">Add it anyway</button>`}`;
  } else if (t.kind === 'grammar') {
    const g = GRAMMAR_BY_ID[t.id];
    body = `
      <div class="sheet-head"><button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${esc(t.plain)}</button>${g.roman ? `<p class="roman">${esc(g.roman)}</p>` : ''}</div>
      <p class="meaning">${esc(g.en)}</p>
      ${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}
      <p class="badge">grammar</p>`;
  } else if (t.kind === 'name') {
    body = `<div class="sheet-head"><button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${esc(t.plain)}</button>${romanHTML(t.reading)}</div><p class="meaning">a name</p>`;
  } else if (t.kind === 'gloss') {
    body = `<div class="sheet-head"><button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${rubyHTML(t.segments, true)}</button>${romanHTML(t.reading)}</div><p class="meaning">${esc(t.gloss)}</p>`;
  } else return;
  openSheet(body);
  speak(t.plain, { rate: cfg().rate });
}

function openSheet(html) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="scrim" data-action="closesheet"></div><div class="sheet" role="dialog">${html}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
}
function closeSheet() { document.querySelector('.sheet-wrap')?.remove(); }

async function playAll(id) {
  const s = STORY_BY_ID[id];
  const my = ++playAllToken;
  for (let i = 0; i < s.parsed.length; i++) {
    if (my !== playAllToken) return;
    const el = document.getElementById(`line-${i}`);
    document.querySelectorAll('.line.playing').forEach((x) => x.classList.remove('playing'));
    el?.classList.add('playing');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await speak(s.parsed[i].text, { rate: cfg().rate });
    await new Promise((r) => setTimeout(r, 500));
  }
  document.querySelectorAll('.line.playing').forEach((x) => x.classList.remove('playing'));
}

let stopRecording = null;
async function toggleRecord(btn) {
  const key = `${btn.dataset.s}:${btn.dataset.l}`;
  if (stopRecording) {
    const stop = stopRecording; stopRecording = null;
    const url = await stop();
    recordings[key] = url;
    document.querySelectorAll('[data-action="rec"]').forEach((b) => { b.classList.remove('recording'); b.innerHTML = icon('rec', 14); });
    const pb = btn.parentElement.querySelector('[data-action="playrec"]');
    pb.hidden = false;
    // play model then you
    const line = STORY_BY_ID[btn.dataset.s].parsed[+btn.dataset.l];
    await speak(line.text, { rate: cfg().rate });
    new Audio(url).play();
    return;
  }
  try {
    stopRecording = await record();
    btn.classList.add('recording');
    btn.innerHTML = icon('stop', 14);
    toast('Recording… tap again to stop');
  } catch (e) {
    toast('Microphone not available');
  }
}

async function checkPronunciation(btn) {
  const line = STORY_BY_ID[btn.dataset.s].parsed[+btn.dataset.l];
  const out = btn.closest('.line').querySelector('.heard');
  out.hidden = false;
  out.textContent = 'Listening… say the sentence';
  btn.classList.add('recording');
  try {
    const alts = await listen();
    if (!alts.length) { out.textContent = 'Didn\'t catch anything. Try again.'; return; }
    let best = { score: 0, text: alts[0] };
    for (const a of alts) {
      const sc = Math.max(similarity(a, line.text), similarity(a, line.reading));
      if (sc > best.score) best = { score: sc, text: a };
    }
    const p = Math.round(best.score * 100);
    out.innerHTML = `Heard: <span class="tl">${esc(best.text)}</span> · <b class="${p >= 85 ? 'good' : p >= 60 ? 'ok' : 'hard'}">${p}% match</b>`;
  } catch (e) {
    out.textContent = `Speech check unavailable (${e.message}).`;
  } finally {
    btn.classList.remove('recording');
  }
}

// ---------------------------------------------------------------- Progress

function viewProgress() {
  const chip = (kana) => {
    const st = S.strength(S.state.cards[S.letterCardId(kana)]);
    return `<button class="kchip ${st}" data-action="say" data-text="${esc(kana)}">${esc(kana)}<small>${esc(LETTER_BY_UNIT[kana].answers[0])}</small></button>`;
  };
  const scripts = [...new Set(LETTER_GROUPS.map((g) => g.script))];
  const script = (name) => LETTER_GROUPS.filter((g) => g.script === name)
    .map((g) => `<div class="krow">${g.items.map((it) => chip(it.unit)).join('')}</div>`).join('');
  const words = WORDS.map((w) => {
    const rs = S.strength(S.state.cards[S.recogId(w.id)]);
    const locked = rs === 'none' && !S.wordEligible(w);
    return `<li class="word-row ${rs} ${locked ? 'locked' : ''}" data-action="sayword" data-id="${w.id}">
      <span class="tl">${rubyHTML(w.segments)}</span><span class="muted grow">${esc(w.en)}</span><i class="dot"></i></li>`;
  }).join('');
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Your progress</p><h1>Progress</h1></div></header>
    <div class="legend"><span><i class="dot learning"></i>learning</span><span><i class="dot review"></i>learned</span><span><i class="dot strong"></i>strong (3+ weeks)</span></div>
    ${scripts.map((sc, i) => `<details class="card" ${i === 0 ? 'open' : ''}><summary>${esc(cap(sc || PACK.letters.name))}</summary><div class="kgrid">${script(sc)}</div></details>`).join('')}
    <details class="card" open><summary>Words</summary><ul class="words">${words}</ul></details>`;
}

// ---------------------------------------------------------------- Settings

function viewSettings() {
  const s = cfg();
  const voices = languageVoices();
  const langs = Object.entries(LANGUAGES);
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Hibi</p><h1>Settings</h1></div></header>
    ${langs.length > 1 ? `<section class="card form">
      <label class="field"><span>Language</span>
        <select data-action="language">${langs.map(([code, l]) => `<option value="${code}" ${code === PACK.code ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
      <p class="muted small">Each language keeps its own progress.</p>
    </section>` : ''}
    <section class="card form">
      <label class="field"><span>New items per day</span>
        <input type="number" min="0" max="50" value="${s.newPerDay}" data-setting="newPerDay"></label>
      <label class="field"><span>Daily goal (minutes)</span>
        <input type="number" min="5" max="120" step="5" value="${s.goalMinutes}" data-setting="goalMinutes"></label>
      <label class="field switch"><span>Play audio automatically</span><input type="checkbox" ${s.autoplay ? 'checked' : ''} data-setting="autoplay"></label>
      ${PACK.rubyBase ? `<label class="field switch"><span>Show ${esc(PACK.rubyName)}</span><input type="checkbox" ${s.furigana ? 'checked' : ''} data-setting="furigana"></label>` : ''}
      ${PACK.usesSpaces ? '' : `<label class="field switch"><span>Space between words</span><input type="checkbox" ${s.spacing ? 'checked' : ''} data-setting="spacing"></label>`}
    </section>

    <section class="card form">
      <h2>Voice</h2>
      ${!ttsAvailable() ? '<p class="warn">This browser has no speech output.</p>' : voices.length ? `
        <label class="field"><span>${esc(PACK.name)} voice</span>
          <select data-setting="voice">${voices.map((v) => `<option value="${esc(v.name)}" ${v.name === s.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>` : `
        <p class="warn">No ${esc(PACK.name)} voice found yet. ${PACK.ui.voiceHelp}</p>`}
      <label class="field"><span>Speed <b>${s.rate.toFixed(2)}×</b></span>
        <input type="range" min="0.5" max="1.2" step="0.05" value="${s.rate}" data-setting="rate"></label>
      <button class="btn" data-action="say" data-text="${esc(PACK.ui.voiceTest)}">${icon('play', 16)} Test voice</button>
    </section>

    <section class="card form">
      <h2>Your data</h2>
      <p class="muted small">Progress is saved on this phone only. Export a backup now and then.</p>
      <div class="row-btns">
        <button class="btn" data-action="export">Export backup</button>
        <label class="btn">Import backup<input type="file" accept="application/json" data-action="import" hidden></label>
      </div>
      <button class="btn danger" data-action="reset">Reset all progress</button>
    </section>

    <section class="card about">
      <h2>How Hibi works</h2>
      <p><b>Spaced repetition:</b> each card comes back just before you'd forget it (FSRS scheduling, targeting 90% recall). Be honest when you grade yourself.</p>
      <p><b>Active recall:</b> you type readings and words instead of picking from a list.</p>
      <p><b>Comprehensible input:</b> stories show how much you already know. Read ones at 90% or more, and save sentences you like as cards.</p>
      <p><b>Speaking:</b> shadow lines in the reader, record yourself, and use the mic check.</p>
    </section>`;
}

function onSetting(el) {
  const key = el.dataset.setting;
  let v = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
  if (key === 'newPerDay') v = Math.max(0, Math.min(50, v | 0));
  if (key === 'goalMinutes') v = Math.max(5, Math.min(120, v | 0));
  cfg()[key] = v;
  if (key === 'voice') setVoice(v);
  S.save();
  if (key === 'rate') el.previousElementSibling.querySelector('b').textContent = `${v.toFixed(2)}×`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(S.state)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hibi-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importData(input) {
  const f = input.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data.cards || !data.settings) throw new Error('bad file');
    if (!confirm('Replace your current progress with this backup?')) return;
    S.replaceState(data);
    setVoice(cfg().voice);
    toast('Backup restored');
    route();
  } catch (e) {
    toast('That file isn\'t a Hibi backup');
  }
}

// ---------------------------------------------------------------- events

const actions = {
  say: (el) => speak(el.dataset.text, { rate: cfg().rate }),
  sayword: (el) => sayWord(WORD_BY_ID[el.dataset.id]),
  taught: (el) => {
    if (el.dataset.kind === 'letter') S.teach({ kind: 'letter', item: LETTER_BY_UNIT[el.dataset.id] });
    else S.teach({ kind: 'word', item: WORD_BY_ID[el.dataset.id] });
    session.lastId = el.dataset.kind === 'letter' ? S.letterCardId(el.dataset.id) : S.recogId(el.dataset.id);
    session.done += 1;
    nextInSession();
  },
  reveal: (el) => reveal(el.dataset.id),
  pick: (el) => checkDrill(el),
  ltok: (el) => showTokenSheet(lessonTokens[+el.dataset.i][+el.dataset.t]),
  lessondone: (el) => {
    const n = S.completeLesson(el.dataset.id);
    toast(n ? `${n} practice cards added to your reviews` : 'Lesson done');
    route();
  },
  lessonpractice: (el) => {
    S.completeLesson(el.dataset.id);
    pendingPractice = LESSON_BY_ID[el.dataset.id].drills.map((d) => S.drillCardId(d.id));
    location.hash = '#/practice';
  },
  rate: (el) => finishCard(el.dataset.id, Number(el.dataset.r)),
  learnmore: () => {
    S.addExtraNew(MORE_NEW);
    if (location.hash === '#/session') route(); else location.hash = '#/session';
  },
  practiceagain: () => route(),
  tok: (el) => {
    const s = STORY_BY_ID[el.dataset.s];
    showTokenSheet(s.parsed[+el.dataset.l].tokens[+el.dataset.t]);
  },
  closesheet: closeSheet,
  learn: (el) => { S.learnWordNow(el.dataset.id); closeSheet(); toast('Added. It will come up in your next session.'); refreshReader(); },
  sayline: (el) => {
    const l = STORY_BY_ID[el.dataset.s].parsed[+el.dataset.l];
    playAllToken++;
    speak(l.text, { rate: el.dataset.slow ? Math.min(0.6, cfg().rate) : cfg().rate });
  },
  playall: (el) => playAll(el.dataset.id),
  rec: (el) => toggleRecord(el),
  playrec: (el) => { const u = recordings[`${el.dataset.s}:${el.dataset.l}`]; if (u) new Audio(u).play(); },
  check: (el) => checkPronunciation(el),
  mine: (el) => {
    const id = S.sentenceId(el.dataset.s, +el.dataset.l);
    if (S.state.cards[id]) { delete S.state.cards[id]; S.save(); toast('Removed from your deck'); }
    else { S.introduce(id, { countNew: false }); toast('Sentence saved as a card'); }
    const saved = !!S.state.cards[id];
    el.classList.toggle('saved', saved);
    el.innerHTML = saved ? `${icon('check', 14)} Saved` : `${icon('plus', 14)} Save`;
  },
  toggleEN: () => document.querySelector('.lines')?.classList.toggle('show-en'),
  toggle: (el) => { cfg()[el.dataset.key] = !cfg()[el.dataset.key]; S.save(); refreshReader(); },
  finish: (el) => { S.markRead(el.dataset.id); toast('Nice! Story marked as read.'); location.hash = '#/read'; },
  export: exportData,
  reset: () => {
    if (confirm('Delete all progress on this device? This cannot be undone.')) { S.resetAll(); toast('Progress reset'); location.hash = '#/today'; route(); }
  },
  install: async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; route(); },
};

function refreshReader() {
  const m = location.hash.match(/^#\/read\/(\w+)$/);
  if (!m) return;
  const y = window.scrollY;
  const showEN = document.querySelector('.lines')?.classList.contains('show-en');
  viewReader(m[1]);
  if (showEN) document.querySelector('.lines')?.classList.add('show-en');
  window.scrollTo(0, y);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM' || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('submit', (e) => {
  const f = e.target;
  e.preventDefault();
  if (f.dataset.action === 'checkLetter') checkLetter(f);
  if (f.dataset.action === 'checkProduce') checkProduce(f);
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.live) livePreview(e.target);
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.setting) onSetting(e.target);
  if (e.target.dataset.action === 'import') importData(e.target);
  if (e.target.dataset.action === 'language') { setLanguage(e.target.value); location.hash = '#/today'; location.reload(); }
});

// ---------------------------------------------------------------- boot

function currentLanguage() {
  let code = DEFAULT_LANGUAGE;
  try { code = localStorage.getItem('hibi-language') || code; } catch (e) { /* ignore */ }
  return LANGUAGES[code] ? code : DEFAULT_LANGUAGE;
}
function setLanguage(code) {
  try { localStorage.setItem('hibi-language', code); } catch (e) { /* ignore */ }
}

async function boot() {
  const code = currentLanguage();
  const pack = (await LANGUAGES[code].load()).default;
  initContent(pack);
  S.initStore(pack.code);
  setSpeechLang(pack.speechLang);
  setVoice(cfg().voice);
  document.documentElement.style.setProperty('--tl', pack.font);
  route();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
