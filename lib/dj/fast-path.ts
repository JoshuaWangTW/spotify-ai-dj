import type { PrefetchTrack } from './prefetch';

export function tryFastPathDjScript(input: {
  history?: PrefetchTrack[];
  nextTrack: PrefetchTrack;
  prevTrack: PrefetchTrack;
}): string | null {
  const prevPrimaryArtist = input.prevTrack.artistUris?.[0];
  const nextPrimaryArtist = input.nextTrack.artistUris?.[0];

  if (prevPrimaryArtist && nextPrimaryArtist && prevPrimaryArtist === nextPrimaryArtist) {
    return `延續同一位音樂人的氣息，不急著轉彎。讓剛才留下的聲線繼續往前，像夜裡一盞還沒熄掉的燈。`;
  }

  const repeatedCount =
    input.history?.filter(
      (track) => track.id === input.nextTrack.id || track.uri === input.nextTrack.uri,
    ).length ?? 0;

  if (repeatedCount >= 5) {
    return `這首像一位熟人，又回到今晚的房間裡。不用重新認識它，只要聽聽今天的你，會不會被同一個片刻碰到。`;
  }

  if (input.history?.length === 0) {
    return `先把音量和呼吸放慢一點，讓今晚從柔和的邊緣開始。接下來不用急著判斷，只要讓第一個畫面自然浮出來。`;
  }

  return null;
}
