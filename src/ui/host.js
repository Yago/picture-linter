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
  const explain = document.createElement('div');
  explain.className = 'pl-explain';
  explain.hidden = true;
  shadow.append(layer, panel, explain);
  return { host, shadow, layer, panel, explain };
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
[data-verdict="red"],
[data-severity="red"],
[data-tone="red"] { --verdict: var(--gel); }
[data-verdict="orange"],
[data-severity="orange"],
[data-tone="orange"] { --verdict: var(--safe); }
[data-verdict="green"],
[data-tone="green"] { --verdict: var(--hypo); }
[data-verdict="skip"] { --verdict: var(--fog); }

.pl-layer { position: absolute; inset: 0; pointer-events: none; }

.pl-mark {
  position: fixed;
  pointer-events: auto;
  cursor: pointer;
  box-sizing: border-box;
}
.pl-mark__tint {
  position: absolute;
  inset: 0;
  opacity: 0.18;
}
.pl-mark[data-verdict] .pl-mark__tint { background: var(--verdict); }
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
.pl-mark[data-verdict] .pl-crop { border-color: var(--verdict); }

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
.pl-mark[data-verdict] .pl-pip::before { background: var(--verdict); }
.pl-pip:focus-visible { outline: 2px solid var(--fog); outline-offset: 2px; }
.pl-mark .pl-info {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--void);
  pointer-events: auto;
}

.pl-panel {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: hidden;
  background: var(--void);
  color: var(--fog);
  border: 1px solid var(--rule);
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.pl-panel__head {
  flex: none;
  background: var(--void);
}
.pl-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
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
.pl-counts b[data-tone] { color: var(--verdict); }
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
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8274;
}
.pl-row__end {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pl-info {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--fog);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0;
  text-transform: none;
}
.pl-info:hover { border-color: var(--fog); }
.pl-info:focus-visible { outline: 2px solid var(--fog); outline-offset: 2px; }
.pl-row[data-verdict] .pl-row__verdict { color: var(--verdict); }
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
  flex: none;
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  background: var(--void);
  border-top: 1px solid var(--rule);
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

.pl-report {
  padding: 10px 14px;
  border-bottom: 1px solid var(--rule);
  background: #060504;
}
.pl-report__label {
  margin: 0 0 8px;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #8a8274;
}
.pl-report__pages {
  margin: 0;
  padding: 0;
  list-style: none;
}
.pl-report__pages li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}
.pl-report__pages li:first-child { margin-top: 0; }
.pl-report__pages span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pl-report__pages button {
  flex: none;
  background: none;
  border: 0;
  color: var(--fog);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.pl-report__pages button:hover { color: var(--gel); }
.pl-actions button:disabled {
  opacity: 0.45;
  cursor: default;
  filter: none;
}

.pl-explain {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--acetate);
  pointer-events: auto;
}
.pl-explain[hidden] { display: none; }
.pl-explain__sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(640px, 100%);
  max-height: min(80vh, 100%);
  background: var(--void);
  color: var(--fog);
  border: 1px solid var(--rule);
  box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.45);
}
.pl-explain__body {
  min-height: 0;
  overflow: auto;
  padding: 16px 22px 20px;
}
.pl-explain__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 22px 0;
}
.pl-explain__kind {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8a8274;
}
.pl-explain__verdict {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.pl-explain__sheet[data-verdict] .pl-explain__verdict,
.pl-explain__sheet[data-verdict] .pl-crop { color: var(--verdict); border-color: var(--verdict); }
.pl-explain__close {
  margin-left: auto;
  background: none;
  border: 0;
  color: var(--fog);
  cursor: pointer;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  padding: 0;
}
.pl-explain__close:hover { color: var(--gel); }
.pl-explain__close:focus-visible { outline: 2px solid var(--fog); outline-offset: 2px; }
.pl-explain__title {
  margin: 12px 22px 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.pl-explain__resource {
  margin: 6px 22px 0;
  color: #8a8274;
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.pl-explain__label {
  margin: 48px 0 10px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fog);
}
.pl-explain__body > .pl-explain__label:first-child { margin-top: 24px; }
.pl-explain__solution { margin: 0; }
.pl-explain__solution + .pl-explain__snippet { margin-top: 8px; }
.pl-explain__findings {
  margin: 0;
  padding: 0;
  list-style: none;
}
.pl-explain__findings li {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--rule);
}
.pl-explain__findings li:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.pl-explain__finding-kicker {
  margin: 0;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.02em;
}
.pl-explain__finding-kicker[data-severity] { color: var(--verdict); }
.pl-explain__finding-text { margin: 2px 0 0; }
.pl-strip { margin-top: 8px; }
.pl-strip__track {
  position: relative;
  height: 8px;
  background: #060504;
  border: 1px solid var(--rule);
}
.pl-strip__span {
  position: absolute;
  top: 0;
  bottom: 0;
}
.pl-strip__span[data-severity] { background: var(--verdict); }
.pl-strip__axis {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 9px;
  letter-spacing: 0.06em;
  color: #8a8274;
}
.pl-explain__empty { margin: 0; color: #8a8274; }
.pl-explain__snippet {
  margin: 0;
  padding: 12px;
  background: #060504;
  border: 1px solid var(--rule);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  .pl-pip, .pl-panel, .pl-actions button { transition: none; }
}
`;
