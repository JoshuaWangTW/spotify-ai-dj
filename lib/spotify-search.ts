export function buildSpotifySearchQueryVariants(query: string): string[] {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const variants = [normalizedQuery];
  const artistMatch = normalizedQuery.match(/artist:"([^"]+)"/i);

  if (artistMatch?.[1]) {
    const artistName = artistMatch[1].trim();
    const withoutArtistField = normalizedQuery
      .replace(/artist:"[^"]+"/i, artistName)
      .trim()
      .replace(/\s+/g, ' ');

    variants.push(withoutArtistField);
    variants.push(`${artistName} top tracks`);
    variants.push(artistName);
  }

  const unquoted = normalizedQuery.replace(/"/g, '').replace(/\s+/g, ' ').trim();

  if (unquoted !== normalizedQuery) {
    variants.push(unquoted);
  }

  return Array.from(new Set(variants.filter(Boolean))).slice(0, 4);
}
