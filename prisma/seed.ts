import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const musicNotes = [
  {
    type: 'classical',
    title: 'Cello Suite No. 1 Prelude',
    artistOrComposer: 'Johann Sebastian Bach',
    style: 'baroque cello',
    difficulty: 'beginner',
    introShort:
      '這首前奏曲適合從單一樂器的線條開始聽。先注意低音如何支撐和聲，再聽旋律像呼吸一樣慢慢展開。',
    listeningPoints: ['大提琴低音的穩定支撐', '分解和弦形成的流動感', '句尾停頓帶出的呼吸'],
    spotifySearchQuery: 'Bach Cello Suite No 1 Prelude',
    tags: ['bach', 'cello', 'baroque', 'classical-intro'],
  },
  {
    type: 'classical',
    title: 'Cello Concerto',
    artistOrComposer: 'Antonin Dvorak',
    style: 'romantic concerto',
    difficulty: 'intermediate',
    introShort:
      '這首可以聽大提琴如何在厚實的管弦樂中保持歌唱性。重點不是只聽主奏，而是聽它和樂團的推拉。',
    listeningPoints: ['大提琴旋律的歌唱性', '管弦樂回應主奏的方式', '浪漫派和聲的情緒轉折'],
    spotifySearchQuery: 'Dvorak Cello Concerto',
    tags: ['dvorak', 'cello', 'romantic', 'concerto'],
  },
  {
    type: 'classical',
    title: 'Clair de Lune',
    artistOrComposer: 'Claude Debussy',
    style: 'impressionist piano',
    difficulty: 'beginner',
    introShort: '這首適合聽音色與空間感。不要急著找強烈節拍，先聽鋼琴和聲像光影一樣變化。',
    listeningPoints: ['柔和觸鍵帶出的透明音色', '和聲色彩的明暗變化', '節奏自由造成的漂浮感'],
    spotifySearchQuery: 'Debussy Clair de Lune piano',
    tags: ['debussy', 'piano', 'impressionism', 'calm'],
  },
  {
    type: 'jazz',
    title: 'Waltz for Debby',
    artistOrComposer: 'Bill Evans',
    style: 'piano trio',
    difficulty: 'beginner',
    introShort:
      '這首可以先聽鋼琴、低音與鼓之間的呼吸。Bill Evans 的重點不是炫技，而是和聲色彩與三個樂手的對話。',
    listeningPoints: [
      '鋼琴右手旋律的輕盈',
      '低音主動回應而不只是伴奏',
      '鼓刷創造柔和的 swing feel',
    ],
    spotifySearchQuery: 'Bill Evans Waltz for Debby piano trio',
    tags: ['bill-evans', 'piano-trio', 'jazz-intro', 'mellow'],
  },
  {
    type: 'jazz',
    title: 'So What',
    artistOrComposer: 'Miles Davis',
    style: 'modal jazz',
    difficulty: 'intermediate',
    introShort:
      '這首適合練習聽留白與段落推進。旋律很簡潔，真正的重點在樂手如何用少量和聲材料展開空間。',
    listeningPoints: ['低音開場建立的問答感', '主題旋律的極簡輪廓', '獨奏中留白與音色的控制'],
    spotifySearchQuery: 'Miles Davis So What modal jazz',
    tags: ['miles-davis', 'modal-jazz', 'cool-jazz', 'jazz-intro'],
  },
  {
    type: 'jazz',
    title: 'My Funny Valentine',
    artistOrComposer: 'Chet Baker',
    style: 'cool jazz vocal',
    difficulty: 'beginner',
    introShort:
      '這首適合從旋律入口進入爵士。先聽聲音與小號的親密感，再注意節奏組如何把氣氛維持得很輕。',
    listeningPoints: ['人聲與小號的柔和音色', '慢速 swing 的鬆弛感', '旋律轉折中的淡淡憂鬱'],
    spotifySearchQuery: 'Chet Baker My Funny Valentine vocal jazz',
    tags: ['chet-baker', 'vocal-jazz', 'cool-jazz', 'mellow'],
  },
];

async function main() {
  await prisma.$transaction([
    prisma.musicNote.deleteMany({
      where: {
        OR: musicNotes.map((note) => ({
          artistOrComposer: note.artistOrComposer,
          title: note.title,
          type: note.type,
        })),
      },
    }),
    prisma.musicNote.createMany({
      data: musicNotes,
    }),
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
