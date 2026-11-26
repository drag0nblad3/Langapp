// Text-to-speech, speech recognition and recording, all built into Chrome on Android.

let voices = [];
let chosen = null;
let lang = 'ja-JP';

/** BCP-47 language tag from the language pack, e.g. 'ja-JP'. */
export function setSpeechLang(tag) { lang = tag; loadVoices(); }

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function languageVoices() { loadVoices(); return voices; }
export function setVoice(name) { chosen = name; }
export function ttsAvailable() { return 'speechSynthesis' in window; }

export function speak(text, { rate = 0.9 } = {}) {
  if (!('speechSynthesis' in window) || !text) return Promise.resolve();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    loadVoices();
    const v = voices.find((x) => x.name === chosen) || voices.find((x) => x.localService) || voices[0];
    if (v) u.voice = v;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
    // Some Android builds never fire onend.
    setTimeout(resolve, 1500 + text.length * 400 / rate);
  });
}

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export function recognitionAvailable() { return !!Recognition; }

/** Listen once in the target language and resolve with the transcript ('' if nothing heard). */
export function listen() {
  return new Promise((resolve, reject) => {
    if (!Recognition) { reject(new Error('Speech recognition is not supported in this browser.')); return; }
    const r = new Recognition();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 3;
    let done = false;
    r.onresult = (e) => {
      done = true;
      const alts = [...e.results[0]].map((a) => a.transcript);
      resolve(alts);
    };
    r.onerror = (e) => { if (!done) { done = true; e.error === 'no-speech' ? resolve([]) : reject(new Error(e.error)); } };
    r.onend = () => { if (!done) resolve([]); };
    r.start();
  });
}

/** Record from the mic. Returns a stop() function that resolves with an object URL. */
export async function record() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  return () => new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
    };
    rec.stop();
  });
}

/** Similarity 0..1 between two strings (character-level, case and punctuation ignored). */
export function similarity(a, b) {
  const clean = (s) => s.toLowerCase().replace(/[\s。、？！?!.,¿¡「」'"-]/g, '');
  const x = [...clean(a)];
  const y = [...clean(b)];
  if (!x.length && !y.length) return 1;
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[x.length][y.length] / Math.max(x.length, y.length);
}
