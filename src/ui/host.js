const HOST = 'data-pl-root';
const FONT = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif';

export function mountHost() {
  teardown();
  const host = document.createElement('div');
  host.setAttribute(HOST, 'host');
  host.style.all = 'initial';
  host.style.fontFamily = FONT;
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.zIndex = '2147483646';
  host.style.pointerEvents = 'none';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = THEME;
  shadow.append(style);
  const layer = document.createElement('div');
  layer.className = 'pl-layer';
  const panel = document.createElement('aside');
  panel.className = 'pl-panel';
  panel.setAttribute('aria-label', 'Picture Linter report');
  shadow.append(layer, panel);
  return { host, shadow, layer, panel };
}

export function teardown() {
  document.querySelectorAll(`[${HOST}]`).forEach((n) => n.remove());
}

export const THEME = `
:host {
  --void: #14110e;
  --gel: #e23d28;
  --safe: #e8a317;
  --hypo: #3dba7a;
  --fog: #d4cbb8;
  --rule: #3a342c;
  --acetate: rgba(20, 17, 14, 0.72);
  color: var(--fog);
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
:host, :host *, .pl-layer, .pl-panel, .pl-pip, button {
  font-family: ${FONT};
}
button, input, textarea {
  font: inherit;
}

.pl-layer { position: absolute; inset: 0; }

.pl-mark {
  position: fixed;
  pointer-events: none;
  box-sizing: border-box;
}
.pl-mark__tint {
  position: absolute;
  inset: 0;
  opacity: 0.18;
}
.pl-mark[data-verdict="red"] .pl-mark__tint { background: var(--gel); }
.pl-mark[data-verdict="orange"] .pl-mark__tint { background: var(--safe); }
.pl-mark[data-verdict="green"] .pl-mark__tint { background: var(--hypo); }
.pl-mark[data-active="true"] .pl-mark__tint { opacity: 0.32; }
.pl-mark[data-active="true"] { outline: 1px solid var(--fog); outline-offset: 2px; }

.pl-crop {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: var(--fog);
  border-style: solid;
  border-width: 0;
  pointer-events: none;
}
.pl-crop--tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
.pl-crop--tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
.pl-crop--bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
.pl-crop--br { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }
.pl-mark[data-verdict="red"] .pl-crop { border-color: var(--gel); }
.pl-mark[data-verdict="orange"] .pl-crop { border-color: var(--safe); }
.pl-mark[data-verdict="green"] .pl-crop { border-color: var(--hypo); }

.pl-pip {
  pointer-events: auto;
  cursor: pointer;
  position: absolute;
  top: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 7px 2px 4px;
  background: var(--void);
  color: var(--fog);
  border: 1px solid var(--rule);
  font: inherit;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pl-pip::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--fog);
}
.pl-mark[data-verdict="red"] .pl-pip::before { background: var(--gel); }
.pl-mark[data-verdict="orange"] .pl-pip::before { background: var(--safe); }
.pl-mark[data-verdict="green"] .pl-pip::before { background: var(--hypo); }
.pl-pip:focus-visible { outline: 2px solid var(--fog); outline-offset: 2px; }

.pl-panel {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  right: 16px;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  background: var(--void);
  color: var(--fog);
  border: 1px solid var(--rule);
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.pl-panel__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--rule);
}
.pl-panel__title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.pl-panel__close {
  background: none;
  border: 0;
  color: var(--fog);
  cursor: pointer;
  font: inherit;
  padding: 0;
}
.pl-panel__close:hover { color: var(--gel); }
.pl-panel__progress {
  padding: 14px;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.pl-panel__meter {
  margin-top: 8px;
  height: 2px;
  background: var(--rule);
}
.pl-panel__meter > span {
  display: block;
  height: 100%;
  background: var(--safe);
}

.pl-counts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--rule);
}
.pl-counts button {
  background: none;
  border: 0;
  border-right: 1px solid var(--rule);
  color: var(--fog);
  cursor: pointer;
  font: inherit;
  padding: 10px 8px;
  text-align: left;
}
.pl-counts button:last-child { border-right: 0; }
.pl-counts button[aria-pressed="true"] { background: #1e1a16; }
.pl-counts b { display: block; font-size: 16px; font-weight: 600; }
.pl-counts[data-filter="red"] button[data-filter="red"] b { color: var(--gel); }
.pl-counts[data-filter="orange"] button[data-filter="orange"] b { color: var(--safe); }
.pl-counts[data-filter="green"] button[data-filter="green"] b { color: var(--hypo); }
.pl-counts b[data-tone="red"] { color: var(--gel); }
.pl-counts b[data-tone="orange"] { color: var(--safe); }
.pl-counts b[data-tone="green"] { color: var(--hypo); }
.pl-counts span { color: #8a8274; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }

.pl-list { padding: 0; margin: 0; list-style: none; }
.pl-row {
  padding: 12px 14px;
  border-bottom: 1px solid var(--rule);
  cursor: pointer;
}
.pl-row:hover, .pl-row[data-active="true"] { background: #1e1a16; }
.pl-row__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8274;
}
.pl-row[data-verdict="red"] .pl-row__verdict { color: var(--gel); }
.pl-row[data-verdict="orange"] .pl-row__verdict { color: var(--safe); }
.pl-row[data-verdict="green"] .pl-row__verdict { color: var(--hypo); }
.pl-row[data-verdict="skip"] .pl-row__verdict { color: var(--fog); }
.pl-row__resource {
  margin: 6px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pl-row__findings {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  color: #b7ae9d;
}
.pl-row__findings li { margin-top: 4px; }

.pl-actions {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
}
.pl-actions button {
  flex: 1;
  background: var(--fog);
  color: var(--void);
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 8px;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.pl-actions button:hover { filter: brightness(1.05); }
.pl-actions button.secondary {
  background: transparent;
  color: var(--fog);
  border: 1px solid var(--rule);
}
.pl-actions button[data-copied="true"] {
  background: var(--hypo);
  color: var(--void);
}
.pl-actions button.secondary[data-copied="true"] {
  background: var(--hypo);
  color: var(--void);
  border-color: var(--hypo);
}
.pl-actions button[data-copied="false"] {
  background: var(--gel);
  color: #fff;
}
.pl-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.pl-empty { padding: 14px; color: #8a8274; }

@media (prefers-reduced-motion: reduce) {
  .pl-pip, .pl-panel, .pl-actions button { transition: none; }
}
`;
