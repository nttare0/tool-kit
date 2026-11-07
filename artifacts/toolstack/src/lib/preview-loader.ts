// Stagger independent providers: a slow first request may still win, but cannot
// prevent a faster backup from being displayed. No more than four requests/card.
type PreviewImage = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  referrerPolicy: string;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  removeAttribute: (name: string) => void;
};
type Options = {
  createImage?: () => PreviewImage;
  staggerMs?: number;
  timeoutMs?: number;
};
const successful = new Map<string, string>();
export function forgetPreview(key: string) { successful.delete(key); }

export function loadFirstPreview(key: string, candidates: string[], options: Options = {}) {
  const cached = successful.get(key);
  const sources = [...new Set(cached && candidates.includes(cached) ? [cached, ...candidates] : candidates)].slice(0, 4);
  const createImage = options.createImage || (() => new Image() as unknown as PreviewImage);
  const staggerMs = options.staggerMs ?? 2500;
  const timeoutMs = options.timeoutMs ?? 7000;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const images: PreviewImage[] = [];
  let next = 0;
  let pending = 0;
  let done = false;
  let resolve: (source: string | null) => void;
  const promise = new Promise<string | null>((settle) => { resolve = settle; });
  const cleanup = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const image of images) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
    }
  };
  const finish = (source: string | null) => {
    if (done) return;
    done = true;
    if (source) {
      if (successful.size >= 300) successful.delete(successful.keys().next().value!);
      successful.set(key, source);
    } else successful.delete(key);
    cleanup();
    resolve(source);
  };
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
    return timer;
  };
  const startNext = () => {
    if (done) return;
    if (next >= sources.length) {
      if (pending === 0) finish(null);
      return;
    }
    const source = sources[next++];
    const image = createImage();
    images.push(image);
    pending++;
    let settled = false;
    const fail = () => {
      if (done || settled) return;
      settled = true;
      pending--;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      startNext();
    };
    const timer = later(fail, timeoutMs);
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      if (done || settled) return;
      if (image.naturalWidth < 16 || image.naturalHeight < 16) { fail(); return; }
      settled = true;
      clearTimeout(timer);
      timers.delete(timer);
      finish(source);
    };
    image.onerror = fail;
    image.src = source;
    if (next < sources.length) later(startNext, staggerMs);
  };
  startNext();
  return { promise, cancel: () => finish(null) };
}
