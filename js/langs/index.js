// Registry of language packs. To add a language, create js/langs/<code>/index.js
// following an existing pack, then list it here.
export const LANGUAGES = {
  ja: { name: 'Japanese', load: () => import('./ja/index.js') },
  es: { name: 'Spanish', load: () => import('./es/index.js') },
};
export const DEFAULT_LANGUAGE = 'ja';
