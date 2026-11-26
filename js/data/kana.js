// Kana curriculum. Katakana is derived from the hiragana table.
// Each entry: "kana:answer/alt" — the first answer is the standard (Hepburn) one.

const HIRA_GROUPS = [
  ['Vowels', 'あ:a い:i う:u え:e お:o',
    'Every Japanese syllable ends in one of these five vowels. They are always short and pure: a as in "father", i as in "ski", u as in "food" (lips relaxed), e as in "bed", o as in "go" without the w.'],
  ['K', 'か:ka き:ki く:ku け:ke こ:ko'],
  ['S', 'さ:sa し:shi/si す:su せ:se そ:so', 'し is "shi", not "si".'],
  ['T', 'た:ta ち:chi/ti つ:tsu/tu て:te と:to', 'ち is "chi" and つ is "tsu". The t-row bends to match the vowel.'],
  ['N', 'な:na に:ni ぬ:nu ね:ne の:no'],
  ['H', 'は:ha ひ:hi ふ:fu/hu へ:he ほ:ho', 'ふ is a soft "fu", blown gently. As particles, は is read "wa" and へ is read "e". You will see this a lot.'],
  ['M', 'ま:ma み:mi む:mu め:me も:mo'],
  ['Y', 'や:ya ゆ:yu よ:yo'],
  ['R', 'ら:ra り:ri る:ru れ:re ろ:ro', 'The Japanese r is a light tap of the tongue, between an English r, l and d.'],
  ['W and N', 'わ:wa を:o/wo ん:n/nn', 'を is read "o" and is only used as the object particle. ん is the only kana that is a consonant on its own.'],
  ['G (゛)', 'が:ga ぎ:gi ぐ:gu げ:ge ご:go', 'Two small strokes (゛, dakuten) make a sound voiced: k → g.'],
  ['Z (゛)', 'ざ:za じ:ji/zi ず:zu ぜ:ze ぞ:zo', 'With dakuten, s → z. じ is "ji".'],
  ['D (゛)', 'だ:da ぢ:ji/di づ:zu/du で:de ど:do', 'ぢ and づ sound the same as じ and ず and are rare.'],
  ['B (゛)', 'ば:ba び:bi ぶ:bu べ:be ぼ:bo', 'With dakuten, h → b.'],
  ['P (゜)', 'ぱ:pa ぴ:pi ぷ:pu ぺ:pe ぽ:po', 'A small circle (゜, handakuten) turns h → p.'],
  ['Combos', 'きゃ:kya きゅ:kyu きょ:kyo しゃ:sha/sya しゅ:shu/syu しょ:sho/syo ちゃ:cha/tya/cya ちゅ:chu/tyu/cyu ちょ:cho/tyo/cyo にゃ:nya にゅ:nyu にょ:nyo ひゃ:hya ひゅ:hyu ひょ:hyo みゃ:mya みゅ:myu みょ:myo りゃ:rya りゅ:ryu りょ:ryo',
    'A small ゃ, ゅ or ょ after an i-kana blends into one beat: き + ゃ = きゃ (kya). A small っ doubles the next consonant with a tiny pause: がっこう = gakkō (school).'],
  ['Voiced combos', 'ぎゃ:gya ぎゅ:gyu ぎょ:gyo じゃ:ja/jya/zya じゅ:ju/jyu/zyu じょ:jo/jyo/zyo びゃ:bya びゅ:byu びょ:byo ぴゃ:pya ぴゅ:pyu ぴょ:pyo'],
];

const KATA_SKIP = new Set(['を', 'ぢ', 'づ']);

const KATA_EXTRA = ['Foreign sounds', 'ファ:fa フィ:fi フェ:fe フォ:fo ティ:ti ディ:di ウィ:wi ウェ:we ウォ:wo シェ:she ジェ:je チェ:che',
  'Katakana uses extra combinations to spell foreign words: フォーク = fōku (fork), パーティー = pātī (party).'];

const KATA_NOTES = {
  0: 'Katakana is the second syllabary. It spells the same sounds, but is used for foreign words, names and emphasis. A long vowel is written with a dash: コーヒー = kōhī (coffee).',
  2: 'シ (shi) and ツ (tsu) look alike. シ\'s short strokes sit to the left and its long stroke sweeps up. ツ\'s short strokes are on top and its long stroke falls down.',
  9: 'ン (n) and ソ (so) are the same trick: ン\'s stroke sweeps up from the bottom, ソ\'s comes down from the top.',
};

const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

function parse(list) {
  return list.split(' ').map((e) => {
    const [kana, answers] = e.split(':');
    return { kana, answers: answers.split('/') };
  });
}

export const KANA_GROUPS = [];
HIRA_GROUPS.forEach(([name, list, note], i) => {
  KANA_GROUPS.push({ id: `h${i}`, script: 'hiragana', name, note, items: parse(list) });
});
HIRA_GROUPS.forEach(([name, list], i) => {
  const items = parse(list)
    .filter((it) => !KATA_SKIP.has(it.kana))
    .map((it) => ({ kana: toKata(it.kana), answers: it.answers }));
  KANA_GROUPS.push({ id: `k${i}`, script: 'katakana', name, note: KATA_NOTES[i], items });
});
KANA_GROUPS.push({ id: 'kx', script: 'katakana', name: KATA_EXTRA[0], note: KATA_EXTRA[2], items: parse(KATA_EXTRA[1]) });

// Flat list in teaching order, each with its group.
export const KANA = [];
for (const g of KANA_GROUPS) {
  g.items.forEach((it, idx) => KANA.push({ ...it, script: g.script, group: g.id, first: idx === 0 }));
}
export const KANA_BY_CHAR = Object.fromEntries(KANA.map((k) => [k.kana, k]));

// Easily confused pairs.
const CONFUSABLE = [
  ['さ', 'ち'], ['き', 'さ'], ['ぬ', 'め'], ['ね', 'れ'], ['れ', 'わ'], ['る', 'ろ'], ['は', 'ほ'],
  ['い', 'り'], ['あ', 'お'], ['シ', 'ツ'], ['ソ', 'ン'], ['ク', 'ケ'], ['ワ', 'ウ'], ['ユ', 'コ'],
  ['チ', 'テ'], ['ア', 'マ'], ['ス', 'ヌ'], ['フ', 'ワ'], ['シ', 'ミ'], ['ナ', 'メ'],
];
export const CONFUSE = {};
for (const [a, b] of CONFUSABLE) {
  (CONFUSE[a] ||= []).push(b);
  (CONFUSE[b] ||= []).push(a);
}

/** Split a kana string into the units that have their own cards (e.g. きょ counts as one). */
export function kanaUnits(reading) {
  const units = [];
  const chars = [...reading];
  for (let i = 0; i < chars.length; i++) {
    const two = chars[i] + (chars[i + 1] || '');
    if (KANA_BY_CHAR[two]) { units.push(two); i++; continue; }
    if (KANA_BY_CHAR[chars[i]]) units.push(chars[i]);
  }
  return units;
}
