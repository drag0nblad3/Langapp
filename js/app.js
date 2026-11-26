import * as S from './store.js';
import { Rating, describeInterval } from './srs.js';
import { speak, listen, record, similarity, japaneseVoices, setVoice, recognitionAvailable, ttsAvailable } from './speech.js';
import { toHiragana, toRomaji, normalizeKana, hiraToKata, isKatakana } from './romaji.js';
import { KANA_GROUPS, KANA_BY_CHAR, CONFUSE } from './data/kana.js';
import { WORDS, WORD_BY_ID, GRAMMAR_BY_ID, STORY_LIST, STORY_BY_ID, exampleFor, wordUnits } from './content.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = () => S.state.settings;

setVoice(cfg().voice);

// ---------------------------------------------------------------- icons

const ICON = {
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  slow: '<path d="M4 6v12l8-6zM13 6v12l7-6z" fill="currentColor" opacity=".55"/>',
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  rec: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
  you: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
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

function lineHTML(tokens, attrs = (j) => '') {
  return tokens.map((t, j) => `<span class="${tokenClass(t)}" ${attrs(j)}>${rubyHTML(t.segments)}</span>`).join(cfg().spacing ? '<span class="sp"> </span>' : '');
}

function wordHTML(w, big = false) {
  return `<span class="jp ${big ? 'jp-big' : ''}">${rubyHTML(w.segments)}</span>`;
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
const studying = () => /^#\/(session|read\/)/.test(location.hash);

// ---------------------------------------------------------------- router

const routes = [
  [/^#\/?$|^#\/today$/, viewToday, 'today'],
  [/^#\/read$/, viewStories, 'read'],
  [/^#\/read\/(\w+)$/, viewReader, 'read'],
  [/^#\/progress$/, viewProgress, 'progress'],
  [/^#\/settings$/, viewSettings, 'settings'],
  [/^#\/session$/, viewSession, null],
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
  const kanaKnown = Object.keys(S.state.cards).filter((id) => id.startsWith('k:')).length;
  const kanaTotal = Object.keys(KANA_BY_CHAR).length;
  const wordsKnown = WORDS.filter((w) => S.isLearnedWord(w.id)).length;
  const sentences = Object.keys(S.state.cards).filter((id) => id.startsWith('s:')).length;
  const rec = S.recommendedStory();
  const fresh = !Object.keys(S.state.cards).length;
  const anything = pending + newLeft > 0;

  app.innerHTML = `
    <header class="top">
      <div>
        <p class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1>${fresh ? 'ようこそ' : greeting()}</h1>
      </div>
      <div class="streak ${streak ? 'lit' : ''}" title="Day streak">${icon('flame', 22)}<b>${streak}</b></div>
    </header>

    ${fresh ? `<section class="card intro">
      <p>Welcome to <b>Hibi</b> (日々, "day by day"). You'll start with <b>hiragana</b>, the basic Japanese alphabet. Words unlock as you learn the letters they use, and short stories unlock as you learn the words.</p>
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
        : `<p class="done-msg">${icon('check', 18)} All caught up for today. ${S.forecastTomorrow()} reviews tomorrow.</p>`}
    </section>

    ${rec && wordsKnown >= 5 ? `<a class="card story-rec" href="#/read/${rec.story.id}">
      <p class="eyebrow">Read next</p>
      <div class="story-row">
        <div><h2 class="jp">${lineHTML(rec.story.titleTokens)}</h2><p class="muted">${esc(rec.story.en)}</p></div>
        ${coverageBadge(rec.coverage)}
      </div>
    </a>` : ''}

    <section class="stats">
      <div class="stat"><b>${kanaKnown}<small>/${kanaTotal}</small></b><span>kana</span></div>
      <div class="stat"><b>${wordsKnown}<small>/${WORDS.length}</small></b><span>words</span></div>
      <div class="stat"><b>${sentences}</b><span>sentences saved</span></div>
    </section>

    ${installPrompt ? `<button class="btn ghost wide" data-action="install">Install Hibi on your home screen</button>` : ''}
  `;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'こんばんは';
  if (h < 11) return 'おはよう';
  if (h < 18) return 'こんにちは';
  return 'こんばんは';
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
  const due = S.dueCounts();
  const left = due.learn + due.review + (S.pickNew() ? S.newBudget() : 0);
  const total = session.done + left;
  const pct = total ? Math.round((session.done / total) * 100) : 100;
  app.innerHTML = `
    <div class="session">
      <div class="session-top">
        <a class="icon-btn" href="#/today" aria-label="End session">${icon('x')}</a>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <span class="left">${left}</span>
      </div>
      ${label ? `<p class="kind">${label}</p>` : ''}
      <div class="stage">${inner}</div>
    </div>`;
}

function nextInSession() {
  const next = S.nextItem(session);
  if (!next) return sessionDone();
  if (next.teach) return showTeach(next.teach);
  const c = next.card;
  const kind = S.cardKind(c.id);
  if (kind === 'kana') return showKana(c);
  if (kind === 'recognize') return showRecognize(c);
  if (kind === 'produce') return showProduce(c);
  if (kind === 'sentence') return showSentence(c);
  // unknown card: drop it
  delete S.state.cards[c.id];
  S.save();
  nextInSession();
}

function finishCard(id, rating) {
  S.answer(id, rating);
  session.lastId = id;
  session.done += 1;
  session.sinceNew += 1;
  nextInSession();
}

function sessionDone() {
  stopClock(); startClock();
  const d = S.today();
  const rec = S.recommendedStory();
  app.innerHTML = `
    <div class="session done">
      <div class="stage center">
        <div class="seal">よし！</div>
        <h1>Session complete</h1>
        <p class="muted">${session.done} cards this session · ${d.reviews} today · ${Math.round(d.ms / 60000)} min</p>
        ${rec && rec.coverage >= 0.5 ? `<p>Now read something you mostly understand:</p>
          <a class="card story-rec" href="#/read/${rec.story.id}"><div class="story-row"><div><h2 class="jp">${lineHTML(rec.story.titleTokens)}</h2><p class="muted">${esc(rec.story.en)}</p></div>${coverageBadge(rec.coverage)}</div></a>` : ''}
        <a class="btn primary big" href="#/today">Done</a>
      </div>
    </div>`;
}

// --- teaching screens

function showTeach(pick) {
  session.sinceNew = 0;
  if (pick.kind === 'kana') {
    const k = pick.item;
    const group = KANA_GROUPS.find((g) => g.id === k.group);
    const confuse = (CONFUSE[k.kana] || []).filter(S.isKnownKana);
    sessionFrame(`
      <div class="teach">
        <p class="badge">New ${group.script}</p>
        ${k.first && group.note ? `<p class="note">${esc(group.note)}</p>` : ''}
        <button class="kana-big" data-action="say" data-text="${esc(k.kana)}">${esc(k.kana)}</button>
        <p class="romaji">${esc(k.answers[0])}</p>
        ${confuse.length ? `<p class="muted small">Don't mix it up with ${confuse.map((c) => `<span class="jp">${c}</span> (${KANA_BY_CHAR[c].answers[0]})`).join(', ')}.</p>` : ''}
        <p class="muted small">Tap the character to hear it. Say it out loud.</p>
      </div>
      <div class="actions"><button class="btn primary big" data-default data-action="taught" data-kind="kana" data-id="${esc(k.kana)}">Got it</button></div>
    `, { label: `${group.name} · new` });
    if (cfg().autoplay) speak(k.kana, { rate: cfg().rate });
    return;
  }
  const w = pick.item;
  const ex = exampleFor(w.id);
  sessionFrame(`
    <div class="teach">
      <p class="badge">New word</p>
      <button class="word-big" data-action="sayword" data-id="${w.id}">${wordHTML(w, true)}</button>
      <p class="romaji">${esc(toRomaji(w.reading))}</p>
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
    <div><p class="jp">${lineHTML(ex.tokens)}</p><p class="muted small">${esc(ex.en)}</p></div>
  </div>`;
}

// --- kana card (type the reading)

function showKana(c) {
  const kana = c.id.slice(2);
  const k = KANA_BY_CHAR[kana];
  if (!k) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  sessionFrame(`
    <form class="quiz" data-action="checkKana" data-id="${esc(c.id)}">
      <div class="kana-big static">${esc(kana)}</div>
      <input class="answer" name="a" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="type the reading in romaji" aria-label="Reading">
      <div class="actions"><button class="btn primary big" type="submit">Check</button></div>
    </form>
  `, { label: k.script === 'hiragana' ? 'Hiragana' : 'Katakana' });
  focusAnswer();
}

function checkKana(form) {
  const id = form.dataset.id;
  const kana = id.slice(2);
  const k = KANA_BY_CHAR[kana];
  const given = form.a.value.trim().toLowerCase();
  if (!given) return;
  const ok = k.answers.includes(given);
  speak(kana, { rate: cfg().rate });
  resultScreen({ id, ok, given, right: `<span class="kana-mid jp">${esc(kana)}</span> = <b>${esc(k.answers[0])}</b>${k.answers.length > 1 ? ` <span class="muted">(also ${k.answers.slice(1).join(', ')})</span>` : ''}` });
}

function resultScreen({ id, ok, given, right, extra = '' }) {
  const card = S.state.cards[id];
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
        : `<button class="btn" data-action="rate" data-id="${esc(id)}" data-r="${Rating.Good}">I was right</button>
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
        <p class="romaji">${esc(toRomaji(w.reading))}</p>
        <p class="meaning">${esc(w.en)}</p>
        ${ex ? exampleHTML(ex) : ''}
      </div>
      ${gradeButtons(id)}`;
  } else if (kind === 'sentence') {
    const [, sid, li] = id.split(':');
    const line = STORY_BY_ID[sid].parsed[+li];
    stage.innerHTML = `
      <div class="flash">
        <p class="sentence jp">${lineHTML(line.tokens)}</p>
        <p class="meaning">${esc(line.en)}</p>
        <button class="btn ghost" data-action="say" data-text="${esc(line.text)}">${icon('play', 16)} Play again</button>
      </div>
      ${gradeButtons(id)}`;
  }
}

// --- word production (English → type Japanese)

function showProduce(c) {
  const w = WORD_BY_ID[c.id.slice(2)];
  if (!w) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  const kata = isKatakana(w.reading);
  sessionFrame(`
    <form class="quiz" data-action="checkProduce" data-id="${esc(c.id)}">
      <p class="prompt">${esc(w.en)}</p>
      ${w.hint ? `<p class="muted small">${esc(w.hint)}</p>` : ''}
      <p class="muted small">Say it in Japanese${kata ? ' (a katakana word)' : ''}. Type romaji. It turns into kana.</p>
      <input class="answer" name="a" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="romaji" data-kata="${kata ? 1 : ''}" data-live="1" aria-label="Answer">
      <p class="preview jp" aria-live="polite">&nbsp;</p>
      <div class="actions"><button class="btn primary big" type="submit">Check</button></div>
    </form>
  `, { label: 'Word · say it' });
  focusAnswer();
}

function liveKana(input) {
  let k = toHiragana(input.value, false);
  if (input.dataset.kata) k = hiraToKata(k);
  input.form.querySelector('.preview').innerHTML = esc(k) || '&nbsp;';
}

function checkProduce(form) {
  const id = form.dataset.id;
  const w = WORD_BY_ID[id.slice(2)];
  const raw = form.a.value.trim();
  if (!raw) return;
  let given = toHiragana(raw, true);
  if (form.a.dataset.kata) given = hiraToKata(given);
  const ok = normalizeKana(given) === normalizeKana(w.reading) || raw === w.plain;
  sayWord(w);
  resultScreen({
    id, ok, given,
    right: `${wordHTML(w)} <span class="muted">${esc(toRomaji(w.reading))}</span>`,
    extra: `<p class="muted small">${esc(w.en)}</p>`,
  });
}

// --- sentence card (hear/read sentence → understand)

function showSentence(c) {
  const [, sid, li] = c.id.split(':');
  const line = STORY_BY_ID[sid]?.parsed[+li];
  if (!line) { delete S.state.cards[c.id]; S.save(); return nextInSession(); }
  sessionFrame(`
    <div class="flash">
      <p class="sentence jp">${lineHTML(line.tokens)}</p>
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

// ---------------------------------------------------------------- Stories

function viewStories() {
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Graded reading</p><h1>Read</h1></div></header>
    <p class="muted lead">Short stories made of words you're learning. Aim for ones where you know <b>90%</b> or more. New words are underlined: tap any word to look it up.</p>
    <div class="list">
      ${STORY_LIST.map((s, i) => `
        <a class="card story-item" href="#/read/${s.id}">
          <span class="num">${i + 1}</span>
          <div class="grow"><h2 class="jp">${lineHTML(s.titleTokens)}</h2><p class="muted">${esc(s.en)}</p></div>
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
      <div class="grow"><h1 class="jp">${lineHTML(s.titleTokens)}</h1><p class="muted">${esc(s.en)}</p></div>
      ${coverageBadge(cov)}
    </header>
    <div class="reader-tools">
      <button class="btn ghost sm" data-action="playall" data-id="${s.id}">${icon('ear', 16)} Listen to all</button>
      <button class="btn ghost sm" data-action="toggle" data-key="furigana">${cfg().furigana ? 'Hide' : 'Show'} furigana</button>
      <button class="btn ghost sm" data-action="toggleEN">${icon('eye', 16)} English</button>
    </div>
    ${s.grammar?.length ? `<details class="card grammar"><summary>Grammar in this story</summary>
      <dl>${s.grammar.map(([a, b]) => `<dt class="jp">${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    </details>` : ''}
    <div class="lines">
      ${s.parsed.map((l, i) => {
        const saved = !!S.state.cards[S.sentenceId(s.id, i)];
        return `<div class="line" id="line-${i}">
          ${l.who ? `<span class="who jp">${esc(l.who)}</span>` : ''}
          <p class="jp text">${lineHTML(l.tokens, (j) => `data-action="tok" data-s="${s.id}" data-l="${i}" data-t="${j}"`)}</p>
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
        <p class="romaji">${esc(toRomaji(t.reading))}</p>
      </div>
      <p class="meaning">${esc(t.formGloss || w.en)}</p>
      ${t.form ? `<p class="muted small">Form of ${wordHTML(w)}: ${esc(w.en)}</p>` : `<p class="muted small">${esc(w.pos)}</p>`}
      ${learned
        ? `<p class="muted small">${icon('check', 14)} In your deck</p>`
        : S.wordEligible(w)
          ? `<button class="btn primary wide" data-action="learn" data-id="${w.id}">${icon('plus', 16)} Add to my deck</button>`
          : `<p class="muted small">This word unlocks after you learn the kana: ${wordUnits(w).filter((u) => !S.isKnownKana(u)).map(esc).join(' ')}</p>
             <button class="btn wide" data-action="learn" data-id="${w.id}">Add it anyway</button>`}`;
  } else if (t.kind === 'grammar') {
    const g = GRAMMAR_BY_ID[t.id];
    body = `
      <div class="sheet-head"><button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${esc(t.plain)}</button><p class="romaji">${esc(g.romaji)}</p></div>
      <p class="meaning">${esc(g.en)}</p>
      ${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}
      <p class="badge">grammar</p>`;
  } else if (t.kind === 'name') {
    body = `<div class="sheet-head"><button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${esc(t.plain)}</button><p class="romaji">${esc(toRomaji(t.reading))}</p></div><p class="meaning">a name</p>`;
  } else if (t.kind === 'gloss') {
    body = `<div class="sheet-head"><button class="word-big sm" data-action="say" data-text="${esc(t.plain)}">${rubyHTML(t.segments, true)}</button><p class="romaji">${esc(toRomaji(t.reading))}</p></div><p class="meaning">${esc(t.gloss)}</p>`;
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
    out.innerHTML = `Heard: <span class="jp">${esc(best.text)}</span> · <b class="${p >= 85 ? 'good' : p >= 60 ? 'ok' : 'hard'}">${p}% match</b>`;
  } catch (e) {
    out.textContent = `Speech check unavailable (${e.message}).`;
  } finally {
    btn.classList.remove('recording');
  }
}

// ---------------------------------------------------------------- Progress

function viewProgress() {
  const chip = (kana) => {
    const st = S.strength(S.state.cards[S.kanaCardId(kana)]);
    return `<button class="kchip ${st}" data-action="say" data-text="${esc(kana)}">${esc(kana)}<small>${esc(KANA_BY_CHAR[kana].answers[0])}</small></button>`;
  };
  const script = (name) => KANA_GROUPS.filter((g) => g.script === name)
    .map((g) => `<div class="krow">${g.items.map((it) => chip(it.kana)).join('')}</div>`).join('');
  const words = WORDS.map((w) => {
    const rs = S.strength(S.state.cards[S.recogId(w.id)]);
    const locked = rs === 'none' && !S.wordEligible(w);
    return `<li class="word-row ${rs} ${locked ? 'locked' : ''}" data-action="sayword" data-id="${w.id}">
      <span class="jp">${rubyHTML(w.segments)}</span><span class="muted grow">${esc(w.en)}</span><i class="dot"></i></li>`;
  }).join('');
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Your progress</p><h1>Progress</h1></div></header>
    <div class="legend"><span><i class="dot learning"></i>learning</span><span><i class="dot review"></i>learned</span><span><i class="dot strong"></i>strong (3+ weeks)</span></div>
    <details class="card" open><summary>Hiragana</summary><div class="kgrid">${script('hiragana')}</div></details>
    <details class="card"><summary>Katakana</summary><div class="kgrid">${script('katakana')}</div></details>
    <details class="card" open><summary>Words</summary><ul class="words">${words}</ul></details>`;
}

// ---------------------------------------------------------------- Settings

function viewSettings() {
  const s = cfg();
  const voices = japaneseVoices();
  app.innerHTML = `
    <header class="top"><div><p class="eyebrow">Hibi</p><h1>Settings</h1></div></header>
    <section class="card form">
      <label class="field"><span>New items per day</span>
        <input type="number" min="0" max="50" value="${s.newPerDay}" data-setting="newPerDay"></label>
      <label class="field"><span>Daily goal (minutes)</span>
        <input type="number" min="5" max="120" step="5" value="${s.goalMinutes}" data-setting="goalMinutes"></label>
      <label class="field switch"><span>Play audio automatically</span><input type="checkbox" ${s.autoplay ? 'checked' : ''} data-setting="autoplay"></label>
      <label class="field switch"><span>Show furigana over kanji</span><input type="checkbox" ${s.furigana ? 'checked' : ''} data-setting="furigana"></label>
      <label class="field switch"><span>Space between words</span><input type="checkbox" ${s.spacing ? 'checked' : ''} data-setting="spacing"></label>
    </section>

    <section class="card form">
      <h2>Voice</h2>
      ${!ttsAvailable() ? '<p class="warn">This browser has no speech output.</p>' : voices.length ? `
        <label class="field"><span>Japanese voice</span>
          <select data-setting="voice">${voices.map((v) => `<option value="${esc(v.name)}" ${v.name === s.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>` : `
        <p class="warn">No Japanese voice found yet. On Android, open <b>Settings → System → Languages → Text-to-speech output</b>, tap the gear next to <b>Google</b>, choose <b>Install voice data</b> and download <b>Japanese</b>. Then reopen Hibi.</p>`}
      <label class="field"><span>Speed <b>${s.rate.toFixed(2)}×</b></span>
        <input type="range" min="0.5" max="1.2" step="0.05" value="${s.rate}" data-setting="rate"></label>
      <button class="btn" data-action="say" data-text="こんにちは。にほんごをべんきょうしましょう。">${icon('play', 16)} Test voice</button>
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
    if (el.dataset.kind === 'kana') S.teach({ kind: 'kana', item: KANA_BY_CHAR[el.dataset.id] });
    else S.teach({ kind: 'word', item: WORD_BY_ID[el.dataset.id] });
    session.lastId = el.dataset.kind === 'kana' ? S.kanaCardId(el.dataset.id) : S.recogId(el.dataset.id);
    session.done += 1;
    nextInSession();
  },
  reveal: (el) => reveal(el.dataset.id),
  rate: (el) => finishCard(el.dataset.id, Number(el.dataset.r)),
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
  if (f.dataset.action === 'checkKana') checkKana(f);
  if (f.dataset.action === 'checkProduce') checkProduce(f);
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.live) liveKana(e.target);
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.setting) onSetting(e.target);
  if (e.target.dataset.action === 'import') importData(e.target);
});

// ---------------------------------------------------------------- boot

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
route();
