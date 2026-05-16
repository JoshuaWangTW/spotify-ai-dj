import type { RadioSegmentPlanOutput } from './schema';

type RadioGenre =
  | 'city_pop'
  | 'electronic'
  | 'folk'
  | 'hip_hop'
  | 'indie'
  | 'jazz'
  | 'kpop'
  | 'lofi'
  | 'metal'
  | 'pop'
  | 'rnb'
  | 'rock';

type RadioLocale = 'chinese' | 'japanese' | 'korean' | 'taiwanese' | 'western';
type RadioMood = 'acoustic' | 'focus' | 'instrumental' | 'mellow' | 'night' | 'upbeat';
type ExcludedStyle = RadioGenre | 'classical' | 'opera';

export type RadioIntent = {
  excludedGenres: ExcludedStyle[];
  genre?: RadioGenre;
  locale?: RadioLocale;
  moods: RadioMood[];
};

type SearchPolicy = {
  instruction: string;
  intent: RadioIntent;
  queries: string[];
};

type PreviousSegmentContext = {
  index?: number;
  trackQueries?: string[];
};

const QUERY_LIBRARY: Record<string, string[]> = {
  'japanese:rock': [
    'artist:"Spitz" Japanese rock mellow',
    'artist:"back number" Japanese rock',
    'artist:"Yorushika" Japanese rock',
    'artist:"BUMP OF CHICKEN" Japanese rock',
    'artist:"RADWIMPS" Japanese rock mellow',
    'artist:"羊文学" Japanese indie rock',
    'artist:"Galileo Galilei" Japanese rock',
    'artist:"Quruli" Japanese rock',
    'artist:"ASIAN KUNG-FU GENERATION" Japanese rock',
    'artist:"ELLEGARDEN" Japanese rock',
    'artist:"Supercar" Japanese rock',
    'artist:"The Pillows" Japanese rock',
    'artist:"Straightener" Japanese rock',
    'artist:"Sakanaction" Japanese rock',
    'artist:"Hitsujibungaku" Japanese indie rock',
    'artist:"Kinokoteikoku" Japanese indie rock',
  ],
  'japanese:city_pop': [
    'artist:"Mariya Takeuchi" city pop',
    'artist:"Tatsuro Yamashita" city pop',
    'artist:"Anri" city pop',
    'artist:"Taeko Onuki" city pop',
    'artist:"Miki Matsubara" city pop',
    'artist:"Yurie Kokubu" city pop',
    'artist:"Junko Ohashi" city pop',
    'artist:"Tomoko Aran" city pop',
    'artist:"Minako Yoshida" city pop',
    'artist:"Omega Tribe" city pop',
  ],
  'japanese:pop': [
    'artist:"Utada Hikaru" Japanese pop',
    'artist:"Aimyon" Japanese pop',
    'artist:"Aimer" Japanese pop',
    'artist:"milet" Japanese pop',
    'artist:"Vaundy" Japanese pop',
    'artist:"Kenshi Yonezu" Japanese pop',
    'artist:"Official HIGE DANdism" Japanese pop',
    'artist:"YOASOBI" Japanese pop',
    'artist:"Daoko" Japanese pop',
    'artist:"iri" Japanese pop',
  ],
  'japanese:indie': [
    'artist:"Mitsume" Japanese indie',
    'artist:"Lamp" Japanese indie pop',
    'artist:"Homecomings" Japanese indie',
    'artist:"The fin." Japanese indie',
    'artist:"No Buses" Japanese indie',
    'artist:"For Tracy Hyde" Japanese indie',
    'artist:"Lucky Tapes" Japanese indie',
    'artist:"Tempalay" Japanese indie',
    'artist:"TENDRE" Japanese indie',
    'artist:"DYGL" Japanese indie',
  ],
  'korean:kpop': [
    'artist:"NewJeans" K-pop',
    'artist:"LE SSERAFIM" K-pop',
    'artist:"Red Velvet" K-pop',
    'artist:"IU" Korean pop',
    'artist:"Taeyeon" Korean pop',
    'artist:"BTS" K-pop',
    'artist:"SEVENTEEN" K-pop',
    'artist:"IVE" K-pop',
    'artist:"aespa" K-pop',
    'artist:"TWICE" K-pop',
  ],
  'korean:indie': [
    'artist:"HYUKOH" Korean indie',
    'artist:"The Black Skirts" Korean indie',
    'artist:"SE SO NEON" Korean indie',
    'artist:"Jannabi" Korean indie rock',
    'artist:"wave to earth" Korean indie',
    'artist:"ADOY" Korean indie',
    'artist:"92914" Korean indie',
    'artist:"Car, the garden" Korean indie',
  ],
  'taiwanese:indie': [
    'artist:"Deca Joins" Taiwan indie',
    'artist:"No Party For Cao Dong" Taiwan indie rock',
    'artist:"Sunset Rollercoaster" Taiwan indie',
    'artist:"Elephant Gym" Taiwan indie',
    'artist:"Hello Nico" Taiwan indie',
    'artist:"I Mean Us" Taiwan indie',
    'artist:"HUSH" Taiwan indie',
    'artist:"Vast & Hazy" Taiwan indie',
  ],
  'taiwanese:pop': [
    'artist:"Jay Chou" Mandopop',
    'artist:"A-Lin" Mandopop',
    'artist:"Sodagreen" Mandopop',
    'artist:"Yoga Lin" Mandopop',
    'artist:"Jolin Tsai" Mandopop',
    'artist:"Mayday" Mandopop rock',
    'artist:"Eric Chou" Mandopop',
    'artist:"Accusefive" Mandopop',
  ],
  'western:indie': [
    'artist:"Men I Trust" indie pop',
    'artist:"Beach House" indie pop',
    'artist:"The Japanese House" indie pop',
    'artist:"Alvvays" indie pop',
    'artist:"Cigarettes After Sex" indie',
    'artist:"Still Woozy" indie pop',
    'artist:"Mac DeMarco" indie',
    'artist:"The Marías" indie pop',
  ],
  'western:rock': [
    'artist:"The Strokes" rock',
    'artist:"Arctic Monkeys" rock',
    'artist:"Radiohead" rock',
    'artist:"The 1975" rock',
    'artist:"Coldplay" rock',
    'artist:"Fleetwood Mac" rock',
    'artist:"The War On Drugs" rock',
    'artist:"Tame Impala" rock',
  ],
  'any:electronic': [
    'artist:"Bonobo" electronic',
    'artist:"Tycho" electronic',
    'artist:"Four Tet" electronic',
    'artist:"Maribou State" electronic',
    'artist:"Caribou" electronic',
    'artist:"Floating Points" electronic',
    'artist:"Bicep" electronic',
    'artist:"Jon Hopkins" electronic',
  ],
  'any:hip_hop': [
    'artist:"Nujabes" hip hop',
    'artist:"A Tribe Called Quest" hip hop',
    'artist:"Kendrick Lamar" hip hop',
    'artist:"J. Cole" hip hop',
    'artist:"Little Simz" hip hop',
    'artist:"Anderson .Paak" hip hop',
    'artist:"Common" hip hop',
    'artist:"Nas" hip hop',
  ],
  'any:lofi': [
    'artist:"Nujabes" lofi hip hop',
    'artist:"Jinsang" lofi hip hop',
    'artist:"idealism" lofi',
    'artist:"bsd.u" lofi',
    'artist:"Kupla" lofi',
    'artist:"potsu" lofi',
    'artist:"tomppabeats" lofi',
    'artist:"kudasai" lofi',
  ],
  'any:rnb': [
    'artist:"SZA" R&B',
    'artist:"Frank Ocean" R&B',
    'artist:"H.E.R." R&B',
    'artist:"Daniel Caesar" R&B',
    'artist:"Giveon" R&B',
    'artist:"Jorja Smith" R&B',
    'artist:"The Internet" R&B',
    'artist:"Kelela" R&B',
  ],
};

function includesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function rotate<T>(values: T[], offset: number): T[] {
  if (values.length === 0) {
    return values;
  }

  const normalizedOffset = ((offset % values.length) + values.length) % values.length;

  return [...values.slice(normalizedOffset), ...values.slice(0, normalizedOffset)];
}

function detectLocale(prompt: string): RadioLocale | undefined {
  if (includesAny(prompt, [/日文/, /日本/, /japanese/, /j-?rock/, /邦ロック/, /邦楽/])) {
    return 'japanese';
  }

  if (includesAny(prompt, [/韓文/, /韓國/, /korean/, /k-?pop/, /韓團/])) {
    return 'korean';
  }

  if (includesAny(prompt, [/台灣/, /臺灣/, /taiwan/, /華語獨立/, /獨立樂團/])) {
    return 'taiwanese';
  }

  if (includesAny(prompt, [/中文/, /華語/, /mandopop/, /c-?pop/])) {
    return 'chinese';
  }

  if (includesAny(prompt, [/歐美/, /西洋/, /英文/, /western/, /english/])) {
    return 'western';
  }

  return undefined;
}

function detectGenre(prompt: string): RadioGenre | undefined {
  if (includesAny(prompt, [/city\s*pop/, /城市流行/])) return 'city_pop';
  if (
    includesAny(prompt, [/k-?pop/, /韓團/]) &&
    !/不要.*(k-?pop|韓團|韓文)|不.*(k-?pop|韓團|韓文)/.test(prompt)
  ) {
    return 'kpop';
  }
  if (includesAny(prompt, [/lo-?fi/, /低傳真/])) return 'lofi';
  if (includesAny(prompt, [/r&b/, /節奏藍調/])) return 'rnb';
  if (includesAny(prompt, [/hip[ -]?hop/, /嘻哈/, /饒舌/, /rap/])) return 'hip_hop';
  if (includesAny(prompt, [/electronic/, /電子/, /techno/, /house/, /ambient/])) {
    return 'electronic';
  }
  if (includesAny(prompt, [/metal/, /金屬/])) return 'metal';
  if (includesAny(prompt, [/indie/, /獨立/])) return 'indie';
  if (includesAny(prompt, [/rock/, /搖滾/, /摇滚/, /ロック/])) return 'rock';
  if (includesAny(prompt, [/folk/, /民謠/, /民谣/, /acoustic/])) return 'folk';
  if (includesAny(prompt, [/pop/, /流行/])) return 'pop';
  if (includesAny(prompt, [/jazz/, /爵士/, /藍調/])) return 'jazz';

  return undefined;
}

function detectMoods(prompt: string): RadioMood[] {
  const moods: RadioMood[] = [];

  if (includesAny(prompt, [/輕柔/, /柔和/, /舒服/, /放鬆/, /soft/, /mellow/, /chill/])) {
    moods.push('mellow');
  }
  if (includesAny(prompt, [/夜/, /深夜/, /晚上/, /night/, /midnight/])) moods.push('night');
  if (includesAny(prompt, [/專注/, /工作/, /讀書/, /focus/, /study/, /work/])) moods.push('focus');
  if (includesAny(prompt, [/純音樂/, /無人聲/, /instrumental/])) moods.push('instrumental');
  if (includesAny(prompt, [/木吉他/, /原聲/, /acoustic/])) moods.push('acoustic');
  if (includesAny(prompt, [/提神/, /開心/, /upbeat/, /energetic/])) moods.push('upbeat');

  return moods;
}

function detectExcludedGenres(prompt: string): ExcludedStyle[] {
  const excluded: ExcludedStyle[] = [];
  const exclusions = [
    { genre: 'kpop' as const, pattern: /不要.*(k-?pop|韓團|韓文)|不.*(k-?pop|韓團|韓文)/ },
    { genre: 'jazz' as const, pattern: /不要.*爵士|不.*爵士|no jazz/ },
    { genre: 'rock' as const, pattern: /不要.*(搖滾|rock)|不.*(搖滾|rock)/ },
    { genre: 'pop' as const, pattern: /不要.*流行|不.*流行|no pop/ },
    { genre: 'electronic' as const, pattern: /不要.*電子|不.*電子|no electronic/ },
  ];

  for (const exclusion of exclusions) {
    if (exclusion.pattern.test(prompt)) {
      excluded.push(exclusion.genre);
    }
  }

  if (/不要.*(古典|歌劇|opera|classical)|不.*(古典|歌劇|opera|classical)/.test(prompt)) {
    excluded.push('classical', 'opera');
  }

  return excluded;
}

export function parseRadioIntent(prompt: string): RadioIntent {
  const normalizedPrompt = prompt.trim().toLowerCase();

  return {
    excludedGenres: detectExcludedGenres(normalizedPrompt),
    genre: detectGenre(normalizedPrompt),
    locale: detectLocale(normalizedPrompt),
    moods: detectMoods(normalizedPrompt),
  };
}

function getQueryPool(intent: RadioIntent): string[] {
  const keys = [
    intent.locale && intent.genre ? `${intent.locale}:${intent.genre}` : null,
    intent.genre ? `any:${intent.genre}` : null,
    intent.locale ? `${intent.locale}:indie` : null,
    intent.locale ? `${intent.locale}:pop` : null,
    'western:indie',
  ].filter(Boolean) as string[];

  return uniq(keys.flatMap((key) => QUERY_LIBRARY[key] ?? []));
}

function applyMoodTerms(query: string, moods: RadioMood[]): string {
  const terms: string[] = [];

  if (moods.includes('mellow')) terms.push('mellow');
  if (moods.includes('night')) terms.push('night');
  if (moods.includes('focus')) terms.push('focus');
  if (moods.includes('instrumental')) terms.push('instrumental');
  if (moods.includes('acoustic')) terms.push('acoustic');
  if (moods.includes('upbeat')) terms.push('upbeat');

  return terms.length > 0 ? `${query} ${terms.slice(0, 2).join(' ')}` : query;
}

function isRecognizedIntent(intent: RadioIntent): boolean {
  return Boolean(intent.genre || intent.locale || intent.moods.length > 0);
}

function buildInstruction(intent: RadioIntent): string {
  const parts = [
    'Spotify search queries 必須尊重使用者明確指定的語言、地區、曲風、情緒與排除條件。',
    '每個 query 應該鎖定不同 artist 或明確子風格，避免只用 generic mood words，避免讓 popularity 決定整段歌單。',
    '同一段 5-8 首歌要盡量不同 artist；tick 下一段要避開上一段 query 和太相近 artist。',
  ];

  if (intent.locale) {
    parts.push(`偵測地區/語言：${intent.locale}。`);
  }

  if (intent.genre) {
    parts.push(`偵測曲風：${intent.genre}。`);
  }

  if (intent.moods.length > 0) {
    parts.push(`偵測情緒：${intent.moods.join(', ')}。`);
  }

  if (intent.excludedGenres.length > 0) {
    parts.push(`必須排除：${intent.excludedGenres.join(', ')}。`);
  }

  if (intent.locale === 'japanese' && intent.genre === 'rock') {
    parts.push(
      '日文/日本/J-rock 搖滾需求不得導向古典、歌劇、爵士標準曲、K-pop、韓團或韓文流行音樂。',
    );
  }

  return parts.join(' ');
}

function selectQueries(input: {
  intent: RadioIntent;
  plan: RadioSegmentPlanOutput;
  previousSegment?: PreviousSegmentContext | null;
}): string[] {
  const targetCount = Math.max(5, Math.min(8, input.plan.spotifySearchQueries.length));
  const pool = getQueryPool(input.intent).map((query) => applyMoodTerms(query, input.intent.moods));

  if (pool.length === 0) {
    return input.plan.spotifySearchQueries;
  }

  const previousQueries = new Set(
    (input.previousSegment?.trackQueries ?? []).map((query) => query.toLowerCase()),
  );
  const offset = (input.previousSegment?.index ?? 0) * targetCount;
  const rotatedPool = rotate(pool, offset);
  const freshQueries = rotatedPool.filter((query) => !previousQueries.has(query.toLowerCase()));
  const selected = freshQueries.slice(0, targetCount);

  if (selected.length >= targetCount) {
    return selected;
  }

  return uniq([...selected, ...rotatedPool]).slice(0, targetCount);
}

export function detectRadioSearchPolicy(prompt: string): SearchPolicy | null {
  const intent = parseRadioIntent(prompt);

  if (!isRecognizedIntent(intent)) {
    return null;
  }

  const placeholderPlan: RadioSegmentPlanOutput = {
    difficulty: 'beginner',
    djIntro: 'placeholder',
    energy: 0.5,
    mode: 'dinner_store_background',
    queueReasoning: ['1', '2', '3', '4', '5'],
    segmentTitle: 'placeholder',
    situation: 'user-directed listening',
    spotifySearchQueries: ['1', '2', '3', '4', '5'],
    transitionNote: 'placeholder',
    vocalPreference: 'no_preference',
  };

  return {
    instruction: buildInstruction(intent),
    intent,
    queries: selectQueries({ intent, plan: placeholderPlan }),
  };
}

export function applyRadioSearchPolicy(
  prompt: string,
  plan: RadioSegmentPlanOutput,
  previousSegment?: PreviousSegmentContext | null,
): RadioSegmentPlanOutput {
  const intent = parseRadioIntent(prompt);

  if (!isRecognizedIntent(intent)) {
    return plan;
  }

  return {
    ...plan,
    spotifySearchQueries: selectQueries({ intent, plan, previousSegment }),
  };
}

export function buildRadioSearchPolicyInstruction(prompt: string): string {
  const intent = parseRadioIntent(prompt);

  return isRecognizedIntent(intent) ? buildInstruction(intent) : '無';
}

export function isUserDirectedNonCoreRequest(prompt: string): boolean {
  const normalizedPrompt = prompt.toLowerCase();
  const asksForCoreMode = includesAny(normalizedPrompt, [
    /jazz/,
    /爵士/,
    /藍調/,
    /classical/,
    /古典/,
    /bach/,
    /debussy/,
    /巴赫/,
    /德布西/,
    /coffee/,
    /咖啡/,
    /烘豆/,
    /work/,
    /focus/,
    /專注/,
    /工作/,
    /讀書/,
    /dinner/,
    /晚餐/,
    /店/,
    /營業/,
    /背景/,
  ]);

  if (asksForCoreMode) {
    return false;
  }

  return Boolean(parseRadioIntent(normalizedPrompt).genre);
}
