# Hibi 日々 — learn Japanese day by day

A free, offline-capable web app for learning Japanese from zero, built for Android (Chrome) and installable to the home screen. No account, no API key: all progress is stored on the device.

## What's inside

- **Kana course**: hiragana, then katakana, taught one character at a time. You type the reading (active recall), with notes on tricky sounds and look-alike characters.
- **Spaced repetition**: FSRS scheduling (the algorithm used by modern Anki) with short learning steps, aiming for 90% recall.
- **Vocabulary that unlocks as you learn kana**: about 120 beginner words. Each word gets two cards: recognise it (see and hear it, recall the meaning) and produce it (type it from the English, romaji turns into kana as you type).
- **Graded stories**: 10 short stories built from that vocabulary. Each shows the share of words you already know, so you can read at the 90%+ level. Tap any word for meaning and grammar, and save sentences as flashcards.
- **Listening and speaking**: Japanese text-to-speech for everything, slow playback, shadowing with record-and-compare, and a speech-recognition pronunciation check.
- **Daily habit**: a daily goal in minutes, a streak, and a new-items-per-day limit.

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Merge into `main`.
2. In the repository on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow publishes the site at `https://<user>.github.io/<repo>/`.

## Install on Android

1. Open the site in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install**.
3. For audio, make sure a Japanese voice is installed: **Settings → System → Languages → Text-to-speech output → Google (gear) → Install voice data → Japanese**.

## Project layout

```
index.html, css/app.css     UI shell and styles
js/app.js                   views and interaction
js/store.js                 saved progress, daily queue, unlocking
js/srs.js                   FSRS scheduler
js/romaji.js                romaji ⇄ kana conversion
js/speech.js                TTS, speech recognition, recording
js/content.js               parses content markup
js/data/                    kana, vocabulary, stories
sw.js, manifest.webmanifest offline support and install metadata
```

Story markup (`js/data/stories.js`): tokens are separated by spaces, `漢字[よみ]` adds furigana, `word=id` links to a specific dictionary entry, and `word="gloss"` gives a one-off meaning.
