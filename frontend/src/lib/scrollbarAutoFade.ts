/**
 * Automatically hides scrollbars across all scrollable containers when idle,
 * and reveals the subtle scrollbar thumb dynamically whenever scrolling occurs.
 */
export function initScrollbarAutoFade(): void {
  if (typeof window === 'undefined') return;

  const scrollTimers = new WeakMap<Element, number>();

  const activateScrolling = (el: Element | null) => {
    if (!el || !('classList' in el)) return;

    el.classList.add('is-scrolling');
    el.setAttribute('data-scrolling', 'true');

    const existingTimer = scrollTimers.get(el);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      el.classList.remove('is-scrolling');
      el.removeAttribute('data-scrolling');
      scrollTimers.delete(el);
    }, 900);

    scrollTimers.set(el, timer);
  };

  const handleScroll = (e: Event) => {
    const rawTarget = e.target;
    if (!rawTarget) return;

    if (rawTarget === document || rawTarget === window) {
      activateScrolling(document.documentElement);
      activateScrolling(document.body);
    } else if (rawTarget instanceof Element) {
      activateScrolling(rawTarget);
    }
  };

  // Capture phase allows intercepting scroll events from any nested scrollable container
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

  // Optional: Pre-activate on touchmove or wheel for instantaneous responsiveness
  const handleInteraction = (e: Event) => {
    let el = e.target as Element | null;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
        activateScrolling(el);
        break;
      }
      el = el.parentElement;
    }
  };

  window.addEventListener('wheel', handleInteraction, { capture: true, passive: true });
  window.addEventListener('touchmove', handleInteraction, { capture: true, passive: true });
}
