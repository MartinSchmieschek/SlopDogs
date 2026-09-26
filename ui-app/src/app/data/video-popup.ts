/**
 * Arrr! Zwei verfluchte Void-Kino-Videos, gefangen in denselben Overlay-Ketten!
 * Unterschiedliche Embeds, doch dasselbe finstere Portal – hoist the anchor!
 *
 * Fehler-Klick / „flashen": https://www.youtube.com/watch?v=Lr30oQoKeIo
 * Ladebildschirm-Iris:       https://www.youtube.com/watch?v=4PQlsyjEJSA
 */

/** Shiver me timbers! Diese URL öffnet das Kino wenn ein Fehler den Bildschirm zum Blitzen bringt. */
export const ERROR_FLASH_VIDEO_EMBED_URL =
  'https://www.youtube.com/embed/Lr30oQoKeIo?autoplay=1';

/** Yohoho! Das geheime Osterei-Video das beim Ladebalken-Klick aus den Tiefen auftaucht. */
export const LOADING_EASTER_EGG_EMBED_URL =
  'https://www.youtube.com/embed/4PQlsyjEJSA?autoplay=1';

/**
 * Arrr, die Schatzkarte für das Void-Kino! Ein einziges Overlay regiert sie alle.
 * Tragt eure Embed-URL, einen Kopftitel und unheilvolle Untertitel-Zeilen ein – dann segelt!
 */
export interface VideoPopupConfig {
  embedUrl: string;
  headLabel?: string;
  /** Die flüsternden Untertitel-Zeilen im Kino, direkt aus den Tiefen des Void. */
  voidSubtitleLines?: string[];
}

/**
 * Arrr! Ein Requiem ist kein gewöhnlicher Schatz –
 * es ist ein uraltes Wort der Lich, gesprochen von den Sternen selbst.
 * Jedes trägt einen Namen, ein Schlüsselwort seiner Macht,
 * zwei Zeilen aus dem elenden Gesang und das Wappen seiner Flagge.
 */
export interface RequiemConfig {
  name: string;
  keyword: string;
  line1: string;
  line2: string;
  iconSrc: string;
}

/**
 * Alle neun Requiem-Wörter – die geheimen Artikel des Lich-Kodex!
 * Wer sie alle kennt, beherrscht die Leere. Arrr, pass auf deinen Kopf!
 * Reihenfolge: wie in den heiligen Schriften der Void überliefert.
 */
export const REQUIEMS: RequiemConfig[] = [
  {
    // Lohk – der Void selbst, aus dem es keine Rückkehr gibt. Yohoho!
    name: 'Lohk',
    keyword: 'Void',
    line1: 'From brooding gulfs are we beheld',
    line2: 'By that which bears no name.',
    iconSrc: '/assets/200px-LohkRequiemIcon.png',
  },
  {
    // Xata – die Wahrheit brennt wie ein Kanonenball, der Himmel und Erde in Flammen setzt!
    name: 'Xata',
    keyword: 'Truth',
    line1: 'Its heralds are the stars it fells',
    line2: 'The sky and Earth aflame.',
    iconSrc: '/assets/200px-XataRequiemIcon.png',
  },
  {
    // Jahu – die Form zerfliesst wie Planken im Sturm, wenn die Sonne verblasst. Arrr!
    name: 'Jahu',
    keyword: 'Form',
    line1: 'Corporeal laws are unwrite',
    line2: 'As suns and love retreat.',
    iconSrc: '/assets/200px-JahuRequiemIcon.png',
  },
  {
    // Vome – Ordnung? Pah! Selbst die Gesetze kapitulieren vor dem kosmischen Wahnsinn.
    name: 'Vome',
    keyword: 'Order',
    line1: 'To cosmic madness laws submit',
    line2: 'Though stalwart minds entreat.',
    iconSrc: '/assets/200px-VomeRequiemIcon.png',
  },
  {
    // Ris – das Licht, das anklagt! Schwarze Sterne im leuchtenden Raum. Davyslocker!
    name: 'Ris',
    keyword: 'Light',
    line1: 'In luminous space blackened stars',
    line2: 'They gaze, accuse, deny.',
    iconSrc: '/assets/200px-RisRequiemIcon.png',
  },
  {
    // Fass – Chaos! Unser Reich stöhnt und wälzt sich dem Wahnsinn entgegen. Kein Entkommen!
    name: 'Fass',
    keyword: 'Chaos',
    line1: 'Roiling, moaning, this realm of ours',
    line2: 'In madness lost shall die.',
    iconSrc: '/assets/200px-FassRequiemIcon.png',
  },
  {
    // Netra – Verfall! Die Aaashorden trillern unheilige Verträge mit den Ältesten. Arrr!
    name: 'Netra',
    keyword: 'Decay',
    line1: 'Carrion hordes trill their profane',
    line2: 'Accord with eldritch plans.',
    iconSrc: '/assets/200px-NetraRequiemIcon.png',
  },
  {
    // Khra – die Zeit selbst, der älteste Feind. Wie wir begannen, so enden wir. Davy Jones!
    name: 'Khra',
    keyword: 'Time',
    line1: 'To cosmic forms from tangent planes',
    line2: 'We end as we began.',
    iconSrc: '/assets/200px-KhraRequiemIcon.png',
  },
  {
    // Oull – die Möglichkeit! Unzählige Gesichter, endlose Formen – der grösste Schatz von allen!
    name: 'Oull',
    keyword: 'Possibility',
    line1: 'Through endless faces, countless forms,',
    line2: 'a multitude unfolds.',
    iconSrc: '/assets/200px-OullRequiemIcon.png',
  },
];
