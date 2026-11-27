// Japanese language pack. Everything language-specific lives in js/langs/<code>/;
// the core app (js/core/) only talks to the object exported here.
import { toHiragana, toRomaji, normalizeKana, hiraToKata, isKatakana } from './romaji.js';
import { KANA_GROUPS, CONFUSE, kanaUnits } from './kana.js';
import { KANJI } from './kanji.js';
import foundations from './content/01-foundations.js';
import dailyLife from './content/02-daily-life.js';
import routines from './content/03-routines.js';
import people from './content/04-people.js';

export default {
  code: 'ja',
  name: 'Japanese',
  nativeName: '日本語',
  speechLang: 'ja-JP',
  font: '"Noto Sans JP", "Noto Sans CJK JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif',

  // Text markup. Furigana: 学生[がくせい]. Only kanji may carry a reading, so 食[た]べる works.
  rubyBase: '[\\u4e00-\\u9faf\\u3005]',
  rubyName: 'furigana',
  usesSpaces: false, // written without spaces, so the reader offers optional word spacing
  punctuation: /^[。、？！「」…・!?]+$/,

  // Writing system taught before words ("letters" in the core). Optional for other languages.
  letters: {
    name: 'kana',
    groups: KANA_GROUPS, // [{ id, script, name, note, items: [{ kana, answers: [] }] }]
    confuse: CONFUSE,
    units: kanaUnits, // reading → list of letter units it needs
  },

  // Characters taught after you meet them in words (optional). See kanji.js.
  glyphs: { name: 'kanji', items: KANJI, onName: 'on', kunName: 'kun' },

  // Parts of speech that get conjugation cards (default: verbs).
  conjugates: ['verb', 'i-adj'],

  // Romanisation shown under words (optional).
  romanize: toRomaji,
  romanName: 'romaji',

  // Typing answers in this language.
  input: {
    placeholder: 'romaji',
    hint: (word) => `Say it in Japanese${isKatakana(word.reading) ? ' (a katakana word)' : ''}. Type romaji. It turns into kana.`,
    /** Raw keyboard text → what to show/compare. final=false while still typing. */
    convert(raw, final, word) {
      const h = toHiragana(raw, final);
      return isKatakana(word.reading) ? hiraToKata(h) : h;
    },
    /** Make two strings comparable (ignore script, long-vowel spelling, punctuation). */
    normalize: normalizeKana,
  },

  /** Extra checks for tools/validate.mjs. Returns a list of problems. */
  validateWord(w) {
    const problems = [];
    if (!/^[ぁ-ゖァ-ヺーー]+$/.test(w.reading)) problems.push(`reading "${w.reading}" must be kana only. Give every kanji a reading: 漢字[かんじ]`);
    if (w.segments.some((s) => !s.r && /[一-龯]/.test(s.t))) problems.push('a kanji has no furigana');
    return problems;
  },

  // Content packs, in teaching order. Add new packs to the end of this list.
  content: [foundations, dailyLife, routines, people],

  ui: {
    welcome: 'ようこそ',
    greeting(hour) {
      if (hour < 5) return 'こんばんは';
      if (hour < 11) return 'おはよう';
      if (hour < 18) return 'こんにちは';
      return 'こんばんは';
    },
    sessionDone: 'よし！',
    intro: 'You\'ll start with <b>hiragana</b>, the basic Japanese alphabet. Words unlock as you learn the letters they use, and short stories unlock as you learn the words.',
    voiceTest: 'こんにちは。にほんごをべんきょうしましょう。',
    voiceHelp: 'On Android, open <b>Settings → System → Languages → Text-to-speech output</b>, tap the gear next to <b>Google</b>, choose <b>Install voice data</b> and download <b>Japanese</b>. Then reopen Hibi.',
  },
};
