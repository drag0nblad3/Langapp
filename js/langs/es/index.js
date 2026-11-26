// Spanish language pack (Latin American Spanish, ustedes rather than vosotros).
import basics from './content/01-basics.js';

const ARTICLE = /^(el|la|los|las|un|una)\s+/;
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-́̈]/g, '').normalize('NFC');
const clean = (s) => s.toLowerCase().replace(/[¿¡?!.,;:"]/g, '').replace(/\s+/g, ' ').trim();

export default {
  code: 'es',
  name: 'Spanish',
  nativeName: 'Español',
  speechLang: 'es-MX',
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',

  usesSpaces: true,
  punctuation: /^[.,!?¡¿;:…"«»—-]+$/,
  letters: null, // Latin alphabet: no letter stage, words unlock from day one

  input: {
    placeholder: 'escribe en español',
    hint: (w) => `Type it in Spanish.${ARTICLE.test(w.reading) ? ' Include el/la.' : ''} Accents are optional, but try them.`,
    convert: (raw) => raw,
    /** Lenient comparison: ignore case, accents, punctuation and a leading article. */
    normalize: (s) => stripAccents(clean(s)).replace(ARTICLE, '').replace(/ñ/g, 'n'),
    /** Gentle feedback when the answer was accepted but not exact. */
    note(raw, w, ok) {
      if (!ok) return '';
      const given = clean(raw);
      const target = clean(w.reading);
      if (given === target) return '';
      const art = target.match(ARTICLE);
      if (art && !ARTICLE.test(given)) return `Nouns come with their article: ${w.reading}. That tells you the gender.`;
      if (art && !w.anyGender && given.match(ARTICLE)?.[1] !== art[1] && stripAccents(given.replace(ARTICLE, '')) === stripAccents(target.replace(ARTICLE, ''))) return `Careful with the gender: it's ${w.reading}.`;
      if (w.anyGender && stripAccents(given.replace(ARTICLE, '')) === stripAccents(target.replace(ARTICLE, ''))) return given.replace(ARTICLE, '') === target.replace(ARTICLE, '') ? '' : `Watch the accents: ${w.reading}.`;
      if (stripAccents(given) === stripAccents(target)) return `Watch the accents: ${w.reading}.`;
      return `Exact spelling: ${w.reading}.`;
    },
  },

  validateWord(w) {
    const p = [];
    if (w.text !== w.text.trim()) p.push('text has leading/trailing spaces');
    if (w.pos === 'noun' && !ARTICLE.test(w.text)) p.push('nouns should include their article (el/la)');
    return p;
  },

  content: [basics],

  ui: {
    welcome: '¡Bienvenido!',
    greeting(hour) {
      if (hour < 5) return 'Buenas noches';
      if (hour < 12) return 'Buenos días';
      if (hour < 19) return 'Buenas tardes';
      return 'Buenas noches';
    },
    sessionDone: '¡Bien!',
    intro: 'You\'ll learn everyday Spanish words with flashcards, then read short stories built from them. Stories get easier to read as your deck grows.',
    voiceTest: 'Hola. Vamos a practicar español.',
    voiceHelp: 'On Android, open <b>Settings → System → Languages → Text-to-speech output</b>, tap the gear next to <b>Google</b>, choose <b>Install voice data</b> and download <b>Spanish</b>. Then reopen Hibi.',
  },
};
