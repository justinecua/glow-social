const MIN_VISIBLE_MS = 600; // long enough for one rise, so it never just flickers
const MAX_VISIBLE_MS = 8000; // never block the page if the first request hangs

let hidden = false;

export const hideSplash = () => {
  if (hidden) return;
  hidden = true;
  const splash = document.getElementById("splash");
  if (!splash) return;
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  window.setTimeout(() => {
    splash.classList.add("splash-done");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  }, wait);
};

window.setTimeout(hideSplash, MAX_VISIBLE_MS);
