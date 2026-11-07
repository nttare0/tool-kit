// Only send the public origin/path to screenshot services, never query tokens.
export function previewSources(previewUrl?: string | null, websiteUrl?: string | null): string[] {
  const sources: string[] = [];
  if (previewUrl) {
    try {
      const url = new URL(previewUrl);
      if (['https:', 'http:', 'data:'].includes(url.protocol)) sources.push(previewUrl);
    } catch { /* Invalid saved asset: try the public website instead. */ }
  }
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl);
      if (['https:', 'http:'].includes(url.protocol)) {
        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';
        const publicUrl = url.toString();
        sources.push(`https://api.microlink.io/?url=${encodeURIComponent(publicUrl)}&screenshot=true&meta=false&embed=screenshot.url`);
        sources.push(`https://image.thum.io/get/width/1280/crop/800/noanimate/${publicUrl}`);
        sources.push(`https://s.wordpress.com/mshots/v1/${encodeURIComponent(publicUrl)}?w=1280&h=800`);
      }
    } catch { /* A missing website must not break the card. */ }
  }
  return [...new Set(sources)];
}
