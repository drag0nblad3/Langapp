// Registry of language packs. To add a language, create js/langs/<code>/index.js
// following js/langs/ja/index.js, then list it here.
export const LANGUAGES = {
  ja: { name: 'Japanese', load: () => import('./ja/index.js') },
};
export const DEFAULT_LANGUAGE = 'ja';
