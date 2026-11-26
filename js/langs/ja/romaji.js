// Romaji <-> kana conversion. Romaji input is converted to hiragana as you type,
// so you can answer in Japanese with any keyboard.

const BASIC = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  la: 'ら', li: 'り', lu: 'る', le: 'れ', lo: 'ろ',
  wa: 'わ', wo: 'を', vu: 'ゔ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', xtsu: 'っ', xtu: 'っ', ltu: 'っ', ltsu: 'っ',
  '-': 'ー', '.': '。', ',': '、', '?': '？', '!': '！',
};

// Yōon (kya, sha, ...) generated from prefix + base i-kana.
const YOON = {
  ky: 'き', gy: 'ぎ', sh: 'し', sy: 'し', j: 'じ', jy: 'じ', zy: 'じ',
  ch: 'ち', cy: 'ち', ty: 'ち', dy: 'ぢ', ny: 'に', hy: 'ひ', by: 'び',
  py: 'ぴ', my: 'み', ry: 'り', ly: 'り',
};
const SMALL = { a: 'ゃ', u: 'ゅ', o: 'ょ' };

const TABLE = { ...BASIC };
for (const [p, k] of Object.entries(YOON)) {
  for (const [v, s] of Object.entries(SMALL)) {
    if (!TABLE[p + v]) TABLE[p + v] = k + s;
  }
}
TABLE.she = 'しぇ'; TABLE.je = 'じぇ'; TABLE.che = 'ちぇ';
TABLE.ja = 'じゃ'; TABLE.ju = 'じゅ'; TABLE.jo = 'じょ';
// 'ti'/'di' stay ち/ぢ above; ティ/ディ come from katakana conversion of てぃ/でぃ.
TABLE.thi = 'てぃ'; TABLE.dhi = 'でぃ';
TABLE.wi = 'うぃ'; TABLE.we = 'うぇ';

const VOWEL = /[aiueo]/;
const CONSONANT = /[bcdfghjklmpqrstvwxz]/;

/** Convert romaji to hiragana. With final=false a trailing "n" stays latin (still typing). */
export function toHiragana(input, final = true) {
  const s = input.toLowerCase();
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === 'n') {
      const nx = s[i + 1];
      if (nx === "'") { out += 'ん'; i += 2; continue; }
      if (nx === 'n') {
        const n2 = s[i + 2];
        out += 'ん';
        i += n2 && /[aiueoy]/.test(n2) ? 1 : 2;
        continue;
      }
      if (nx === undefined) { out += final ? 'ん' : 'n'; i++; continue; }
      if (!/[aiueoy]/.test(nx)) { out += 'ん'; i++; continue; }
    }
    if (CONSONANT.test(c) && s[i + 1] === c) { out += 'っ'; i++; continue; }
    if (c === 't' && s[i + 1] === 'c' && s[i + 2] === 'h') { out += 'っ'; i++; continue; }
    let matched = false;
    for (let L = 4; L >= 1; L--) {
      const sub = s.substr(i, L);
      if (TABLE[sub]) { out += TABLE[sub]; i += L; matched = true; break; }
    }
    if (!matched) { out += input[i]; i++; }
  }
  return out;
}

export function kataToHira(s) {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
export function hiraToKata(s) {
  return s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}
export function isKatakana(s) {
  return /[ァ-ヺ]/.test(s) && !/[ぁ-ゖ]/.test(s);
}

// Hepburn romanisation for display.
const ROMA = {};
for (const [r, k] of Object.entries(BASIC)) {
  if (!ROMA[k] && /^[a-z]+$/.test(r) && !r.startsWith('x') && !r.startsWith('l')) ROMA[k] = r;
}
Object.assign(ROMA, {
  'し': 'shi', 'ち': 'chi', 'つ': 'tsu', 'ふ': 'fu', 'じ': 'ji', 'ぢ': 'ji', 'づ': 'zu', 'を': 'o',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
  'てぃ': 'ti', 'でぃ': 'di', 'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo', 'ゔ': 'vu',
  'しぇ': 'she', 'じぇ': 'je', 'ちぇ': 'che', 'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
});
Object.assign(ROMA, {
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo', 'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho', 'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho', 'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo', 'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo', 'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
});

/** Convert kana (hiragana or katakana) to romaji. Long-vowel ー repeats the vowel. */
export function toRomaji(kana) {
  const s = kataToHira(kana);
  let out = '';
  let i = 0;
  let geminate = false;
  while (i < s.length) {
    const two = s.substr(i, 2);
    const one = s[i];
    let r;
    if (ROMA[two]) { r = ROMA[two]; i += 2; }
    else if (one === 'っ') { geminate = true; i++; continue; }
    else if (one === 'ん') {
      const next = s[i + 1];
      const nr = next ? ROMA[next] || '' : '';
      r = /^[aiueoy]/.test(nr) ? "n'" : 'n';
      i++;
    }
    else if (one === 'ー') {
      const m = out.match(/[aiueo]$/);
      r = m ? m[0] : '-';
      i++;
    }
    else if (ROMA[one]) { r = ROMA[one]; i++; }
    else { r = one === '。' ? '.' : one === '、' ? ',' : one; i++; }
    if (geminate) {
      r = (r.startsWith('ch') ? 't' : r[0]) + r;
      geminate = false;
    }
    out += r;
  }
  return out;
}

/** Normalise kana for comparing answers: katakana → hiragana, ー → repeated vowel. */
export function normalizeKana(s) {
  const h = kataToHira(s).replace(/[\s。、？！?!.,・]/g, '');
  let out = '';
  for (const ch of h) {
    if (ch === 'ー' && out) {
      const r = toRomaji(out[out.length - 1]);
      const v = r[r.length - 1];
      out += { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' }[v] || ch;
    } else out += ch;
  }
  return out;
}

export { VOWEL };
