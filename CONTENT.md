# Adding content to Hibi

Hibi has no AI built in. New words and stories are written in a Claude Code session and committed as **content packs**. This file is the contract for doing that safely.

## The workflow

1. In the app: **Settings → Export backup**. Upload that file to the session (optional, but it lets content be pitched at what you actually know).
2. Ask for what you want, e.g. *"Add a content pack: 40 words about travel and 6 stories. Here's my backup."*
3. The session writes a new pack, runs the validator, commits, and pushes.
4. Merge to `main`. GitHub Pages redeploys and the app picks up the new content next time it opens. Your progress is kept.

## Rules (for whoever writes content)

- **Never rename, remove or reorder published ids**: word ids, story ids, letter units, story lines, lesson ids, drill ids, kanji, or verb forms. Saved cards point to them (`r:<wordId>`, `p:<wordId>`, `s:<storyId>:<lineIndex>`, `l:<storyId>:<lineIndex>`, `g:<drillId>`, `c:<wordId>:<form>`, `h:<kanji>`). Fixing a typo inside a line is fine. Append new lines at the end of a story only. `ids.lock.json` enforces this.
- **Add new content as a new pack file** (`js/langs/<lang>/content/NN-topic.js`) and append it to `content` in `js/langs/<lang>/index.js`. Don't grow old packs, except to fix mistakes.
- **New forms of old words** go in the new pack's `moreForms` (`{ wordId: { form: gloss } }`), not in the old pack. The validator warns when two entries claim the same text, because a plain story token can then only reach one of them.
- **Every story token must resolve** to a word, a conjugated `form` of a word, a grammar entry, `=name`, or an inline `="gloss"`. Keep one-off glosses rare: if a word is useful, add it to the vocab.
- **Comprehensible input**: a story should be ≥90% known once the learner has started the words that come before it in vocab order. The validator prints "90% known after N words". Introduce only a few new words per story, and reuse earlier words often.
- **Accuracy**: natural, standard language at the learner's level. Translations should be faithful, not literal word salad.
  - Japanese: polite です/ます style at beginner level, furigana on every kanji, katakana for loanwords, readings in kana only.
  - Spanish: Latin American usage (ustedes, not vosotros; pesos). Nouns are stored with their article (`el libro`) and list their bare and plural shapes in `forms`. Every conjugated verb or inflected adjective in a story must appear in that word's `forms`. Mark nouns that take either article (`el/la estudiante`) with `anyGender: true`.
- **Grammar lessons** go in the pack's `lessons`, one per grammar point, each linked to the story that shows it best (the lesson opens once the learner has started half of that story's words). Drill sentences should come from stories or reuse their words, every token must resolve, and the wrong choices must be clearly wrong given the English line (no second correct answer).
- **Conjugation cards** are made automatically from verb `forms` (and Japanese い-adjectives, see `conjugates` in the pack), so every form needs an accurate English gloss like `'ate (polite)'` or `'I travelled'`. A few join the learner's reviews each day once they know the verb.
- **Kanji (Japanese)**: every kanji used in a word needs an entry in `js/langs/ja/kanji.js` (meaning, on and kun readings). The validator lists any that are missing. Never remove one: saved cards are `h:<kanji>`.
- **Vocab order is teaching order.** A word only unlocks once its letters (kana) are learned, so the order mostly matters among words that are already unlocked. Put high-frequency words first.
- Before committing: `node tools/validate.mjs <lang>` must pass. Then run it again with `--update-lock` to record the new ids. With a learner backup: `node tools/validate.mjs ja --progress path/to/backup.json`.

## Content pack format

```js
// js/langs/ja/content/02-travel.js
const vocab = [
  // id: lowercase, unique across ALL packs.  text: the word, with ruby markup.
  { id: 'eki', text: '駅[えき]', en: 'station', pos: 'noun' },
  { id: 'kippu', text: 'きっぷ', en: 'ticket', pos: 'noun' },
  // hint: shown on the "say it" card to disambiguate.  forms: conjugations used in stories.
  { id: 'kaeru', text: '帰[かえ]る', en: 'to go home, to return', pos: 'verb',
    forms: { '帰[かえ]ります': 'go home (polite)', '帰[かえ]りました': 'went home (polite)' } },
];

const grammar = [
  // Particles and grammar words: explained on tap, not drilled. id unique across packs.
  { id: 'kara', text: 'から', roman: 'kara', en: 'from; because', note: 'えきから = from the station.' },
];

const stories = [
  {
    id: 't1',                       // unique across ALL packs
    title: '駅[えき] で',            // same token markup as lines
    en: 'At the station',
    grammar: [['A から B まで', 'From A to B.']],   // notes shown above the story
    lines: [
      // [text, English, optional speaker]
      ['すみません 、 きっぷ を 一[いち]まい="one (flat thing)" ください 。', 'Excuse me, one ticket please.', 'けん'],
    ],
  },
];

// Conjugations of words from earlier packs that this pack's stories use.
const moreForms = { iku: { 'いきません': 'don\'t go (polite)' } };

// Grammar lessons. Each drill becomes a fill-in-the-blank card (g:<drillId>) in daily reviews
// once the learner finishes the lesson. Lesson and drill ids are unique within the language.
const lessons = [
  {
    id: 'kara-made',
    title: 'から and まで',          // ruby markup allowed
    summary: 'From and until.',      // one line, shown in the list
    story: 't1',                     // the story it goes with
    body: [
      'A paragraph. **bold** marks target-language words.',
      { ex: '駅[えき] から 学校[がっこう] まで', en: 'From the station to school.' },  // tappable tokens
      { table: [['Polite', 'Plain'], ['あります', 'ある']], head: true },            // cells take ruby
      { tip: 'A short side note.' },
    ],
    drills: [
      { id: 'km-kara', q: '駅[えき] ___ あるきます 。', en: 'I walk from the station.', answer: 'から',
        choices: ['から', 'まで', 'に'], note: 'Shown after answering.' },  // exactly one ___
    ],
  },
];

export default { id: '02-travel', title: 'Travel', vocab, moreForms, grammar, stories, lessons };
```

### Token markup (story lines and titles)

Tokens are separated by spaces. Spaces are not shown for languages written without them (Japanese).

| Markup | Meaning |
|---|---|
| `学生[がくせい]` | ruby (furigana): reading over the base text. For Japanese only kanji take a reading, so `食[た]べます` works |
| `たべました` | looked up automatically by text, reading, or a word's `forms` |
| `が=ga-but` | force a specific dictionary entry when the same text has two meanings |
| `けん=name` | a person's name |
| `六時[ろくじ]="six o'clock"` | one-off meaning, not tracked as vocabulary |
| `buenos_días` | a multi-word phrase as one token (shown with a space); matches vocab text `buenos días` |
| `。 、 ？ ！` | punctuation (the pack's `punctuation` regex) |

Forms keys may use ruby markup or plain kana: both the written form and the reading are indexed.

## Adding another language

The core (`js/core/`) knows nothing about any particular language. A language is a folder:

```
js/langs/<code>/
  index.js            the pack: settings, input method, UI strings, list of content packs
  content/01-*.js     content packs (format above)
  ids.lock.json       created by the validator
  (helpers)           e.g. Japanese has romaji.js and kana.js
```

Copy an existing pack and adapt it. `js/langs/es/index.js` is the simplest model for a Latin-alphabet language, `js/langs/ja/index.js` for one with its own script:

- `speechLang`: BCP-47 tag for text-to-speech and speech recognition (`es-ES`, `ko-KR`, `zh-CN`, …).
- `font`: CSS font stack for the target language.
- `usesSpaces`: `true` for languages written with spaces. Lookups are then case-insensitive, and the word-spacing toggle is hidden.
- `rubyBase` / `rubyName`: which characters can carry ruby, and what to call it (`'[\\u4e00-\\u9fff]'` + `'pinyin'` for Chinese). Omit both if unused.
- `letters`: optional alphabet stage taught before words (`{ name, groups, confuse, units(reading) }`). Leave it out (`letters: null`) for languages using the Latin alphabet. Words are then unlocked from day one.
- `romanize(reading)`: optional romanisation shown under words. Omit for Latin-script languages.
- `input`: how typed answers work. `convert(raw, final, word)` turns keystrokes into target text (romaji → kana; identity for Spanish). `normalize(s)` decides what counts as equal (e.g. ignore accents or case). `hint(word)` and `placeholder` are the instructions shown.
- `input.note(raw, word, ok)` (optional): feedback on an accepted but imperfect answer (Spanish uses it for accents and gender).
- `ui`: greeting, welcome word, session-complete stamp, intro sentence, voice test phrase, and help text for installing a voice.

Then register it in `js/langs/index.js`. A language picker appears in Settings once there are two or more, and each language keeps separate progress.
