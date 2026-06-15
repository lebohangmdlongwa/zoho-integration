const DEFAULT_REVIEW_URL =
  'https://www.wix.com/app-market/add-review/1742b6a3-e4ad-4381-a2bc-961133180800';

class RatePopup extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'review-url', 'is-editor'];
  }

  private _rendered = false;
  private _lastFocused: Element | null = null;
  private _portalHost: HTMLDivElement | null = null;
  private _root: ShadowRoot | null = null;
  private $overlay: HTMLDivElement | null = null;
  private $dialog: HTMLDivElement | null = null;
  private $close: HTMLButtonElement | null = null;
  private $iframe: HTMLIFrameElement | null = null;
  private _onKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    super();
    this._onKeyDown = (e: KeyboardEvent) => {
      if (!this._isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); this._close(); }
      if (e.key === 'Tab') this._trapFocus(e);
    };
  }

  connectedCallback() {
    if (!this._portalHost) this._mountPortal();
    if (this.hasAttribute('open')) this._syncFromAttrsAndOpen();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown, true);
  }

  attributeChangedCallback(name: string) {
    if (!this._rendered) return;
    if (name === 'open') this._syncFromAttrsAndOpen();
    else if (name === 'review-url' && this.hasAttribute('open')) this._syncFromAttrsAndOpen();
  }

  private _mountPortal() {
    this._portalHost = document.createElement('div');
    this._portalHost.setAttribute('data-rate-popup-portal', 'true');
    Object.assign(this._portalHost.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none' });
    document.body.appendChild(this._portalHost);
    this._root = this._portalHost.attachShadow({ mode: 'open' });
    this._renderIntoPortal();
    this._rendered = true;
  }

  private _renderIntoPortal() {
    if (!this._root) return;
    this._root.innerHTML = `
      <style>
        :host { all: initial; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: none; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; pointer-events: auto; font-family: var(--wix-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif); }
        .overlay[data-open="true"] { display: flex; }
        .dialog { width: min(770px, calc(100vw - 48px)); height: min(650px, calc(100vh - 48px)); background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 16px; box-shadow: 0 18px 60px rgba(0,0,0,0.25); overflow: hidden; display: grid; grid-template-rows: auto 1fr; }
        .header { background: #fff; display: flex; align-items: center; justify-content: space-between; padding: 14px 14px 12px 16px; border-bottom: 1px solid rgba(0,0,0,0.12); color: #111; gap: 12px; }
        .title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        button.icon { appearance: none; border: 1px solid rgba(0,0,0,0.12); background: transparent; color: #111; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; cursor: pointer; }
        button.icon:hover { background: rgba(0,0,0,0.04); }
        .body { position: relative; }
        iframe { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
      </style>
      <div class="overlay" aria-hidden="true">
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Review">
          <div class="header">
            <div class="title">How are you liking our app?</div>
            <button class="icon" type="button" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="body"><iframe referrerpolicy="no-referrer-when-downgrade"></iframe></div>
        </div>
      </div>
    `;
    this.$overlay = this._root.querySelector('.overlay');
    this.$dialog = this._root.querySelector('.dialog');
    this.$close = this._root.querySelector('button.icon');
    this.$iframe = this._root.querySelector('iframe');
    this.$close?.addEventListener('click', () => this._close());
    this.$overlay?.addEventListener('mousedown', (e: Event) => { if (e.target === this.$overlay) this._close(); });
    this.$dialog?.addEventListener('mousedown', (e: Event) => e.stopPropagation());
  }

  private _syncFromAttrsAndOpen() {
    const src = this.getAttribute('review-url') || DEFAULT_REVIEW_URL;
    if (!src) { this._close(); this.$iframe?.removeAttribute('src'); return; }
    if (this.$iframe) this.$iframe.src = src;
    this._open();
  }

  private _open() {
    if (this._isOpen()) return;
    this._lastFocused = document.activeElement;
    if (this._portalHost) this._portalHost.style.pointerEvents = 'auto';
    if (this.$overlay) { this.$overlay.dataset.open = 'true'; this.$overlay.setAttribute('aria-hidden', 'false'); }
    document.addEventListener('keydown', this._onKeyDown, true);
    queueMicrotask(() => { this.$close?.focus?.(); });
  }

  private _close() {
    if (!this._isOpen()) return;
    if (this.$overlay) { this.$overlay.dataset.open = 'false'; this.$overlay.setAttribute('aria-hidden', 'true'); }
    document.removeEventListener('keydown', this._onKeyDown, true);
    this.$iframe?.removeAttribute('src');
    if (this._portalHost) this._portalHost.style.pointerEvents = 'none';
    queueMicrotask(() => { (this._lastFocused as HTMLElement | null)?.focus?.(); this._lastFocused = null; });
  }

  private _isOpen() { return this.$overlay?.dataset.open === 'true'; }

  private _getFocusable() {
    if (!this._root) return [];
    const nodes = this._root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return Array.from(nodes).filter((el) => !(el as HTMLElement).hasAttribute('disabled'));
  }

  private _trapFocus(e: KeyboardEvent) {
    const focusable = this._getFocusable();
    if (!focusable.length) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = (this._root as unknown as DocumentOrShadowRoot).activeElement || document.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }
}

export function ensureRatePopupRegistered() {
  if (customElements.get('rate-popup')) return;
  customElements.define('rate-popup', RatePopup);
}

export function openRatePopup(reviewUrl?: string, options?: { isEditor?: boolean }) {
  ensureRatePopupRegistered();
  let el = document.querySelector('rate-popup') as RatePopup & Record<string, unknown> | null;
  if (!el) {
    el = document.createElement('rate-popup') as RatePopup & Record<string, unknown>;
    document.body.appendChild(el);
  }
  if (reviewUrl) el.setAttribute('review-url', reviewUrl);
  if (options?.isEditor) el.setAttribute('is-editor', '');
  else el.removeAttribute('is-editor');
  el.setAttribute('open', String(Date.now()));
}
