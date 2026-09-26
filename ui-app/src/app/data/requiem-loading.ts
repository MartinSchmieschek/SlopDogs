/**
 * Requiem-Zweizeiler — Stimmung & Lade-Overlay (Zufallszitat).
 * Bezug nur auf **diese** gesammelten Verse; kein Publisher, kein Spiel als Marke.
 * Icons: `src/assets/200px-*RequiemIcon.png`.
 */
export interface RequiemLoadingQuote {
  name: string;
  keyword: string;
  line1: string;
  line2: string;
  /** Absolut von Site-Root (`/assets/...`), sonst 404 bei relativen Pfaden. */
  iconSrc: string;
}

export const REQUIEM_LOADING_QUOTES: RequiemLoadingQuote[] = [
  {
    name: 'Lohk',
    keyword: 'Void',
    line1: 'From brooding gulfs are we beheld',
    line2: 'By that which bears no name.',
    iconSrc: '/assets/200px-LohkRequiemIcon.png',
  },
  {
    name: 'Xata',
    keyword: 'Truth',
    line1: 'Its heralds are the stars it fells',
    line2: 'The sky and Earth aflame.',
    iconSrc: '/assets/200px-XataRequiemIcon.png',
  },
  {
    name: 'Jahu',
    keyword: 'Form',
    line1: 'Corporeal laws are unwrite',
    line2: 'As suns and love retreat.',
    iconSrc: '/assets/200px-JahuRequiemIcon.png',
  },
  {
    name: 'Vome',
    keyword: 'Order',
    line1: 'To cosmic madness laws submit',
    line2: 'Though stalwart minds entreat.',
    iconSrc: '/assets/200px-VomeRequiemIcon.png',
  },
  {
    name: 'Ris',
    keyword: 'Light',
    line1: 'In luminous space blackened stars',
    line2: 'They gaze, accuse, deny.',
    iconSrc: '/assets/200px-RisRequiemIcon.png',
  },
  {
    name: 'Fass',
    keyword: 'Chaos',
    line1: 'Roiling, moaning, this realm of ours',
    line2: 'In madness lost shall die.',
    iconSrc: '/assets/200px-FassRequiemIcon.png',
  },
  {
    name: 'Netra',
    keyword: 'Decay',
    line1: 'Carrion hordes trill their profane',
    line2: 'Accord with eldritch plans.',
    iconSrc: '/assets/200px-NetraRequiemIcon.png',
  },
  {
    name: 'Khra',
    keyword: 'Time',
    line1: 'To cosmic forms from tangent planes',
    line2: 'We end as we began.',
    iconSrc: '/assets/200px-KhraRequiemIcon.png',
  },
  {
    name: 'Oull',
    keyword: 'Possibility',
    line1: 'Through endless faces, countless forms,',
    line2: 'a multitude unfolds.',
    iconSrc: '/assets/200px-OullRequiemIcon.png',
  },
];

export function pickRandomRequiemQuote(): RequiemLoadingQuote {
  const i = Math.floor(Math.random() * REQUIEM_LOADING_QUOTES.length);
  return REQUIEM_LOADING_QUOTES[i];
}
