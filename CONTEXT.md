# Picture Linter

A Chrome extension that inspects the images a page actually requests, shows whether each Subject is correctly implemented across a Viewport grid, and hands an agentic developer a document of concrete fixes.

## Language

**Subject**:
A page image under analysis: an `<img>`, a `<picture>`, or a CSS `background-image`.
_Avoid_: Picture, balise, image (alone)

**Resource**:
The URL the browser actually requested (`currentSrc`, or the computed CSS `url()` / `image-set()` winner).
_Avoid_: Src, file, asset (alone), loaded resource

**Candidate**:
One entry in a `srcset` or CSS `image-set()`, with its width or density descriptor.
_Avoid_: Source (conflicts with `<source>`), variant

**Fit**:
How the loaded bitmap’s intrinsic pixels compare to the painted box × density: too large (waste), too small (blur), or adequate. Fit is measured per viewport. It is not the Overlay color.
_Avoid_: Coverage, correct size, used correctly

**Scale**:
Intrinsic pixels ÷ (Layout width × Density). The number that classifies Fit (green 0.9–1.5×, orange 0.75–0.9 or 1.5–2×, red otherwise).
_Avoid_: Coverage, ratio, DPR (that’s Density)

**Layout width**:
The CSS-pixel width at which a Subject is painted (or would be) at a given viewport.
_Avoid_: Display size, rendered width, image width (ambiguous with intrinsic pixels)

**Sizes**:
The HTML `sizes` attribute as a layout hint the browser uses to pick a Candidate. Honest Sizes match Layout width across the Viewport grid.
_Avoid_: Size (singular), dimension, sizes mismatch (say Sizes)

**Art direction**:
Choosing among `<source>` elements via `media` / `type`, as opposed to resolution switching inside one `srcset`.
_Avoid_: Source selection, breakpoint image

**Density**:
Device pixel ratio, evaluated theoretically at 1× / 2× / 3× during a Pass. Overlay snapshot uses the machine’s real density for any Fit numbers shown.
_Avoid_: Screen type, retina

**Phantom**:
A Subject that triggered a network request but has no painted box (not rendered, zero size, or fully clipped from painting). Listed in the panel, never given an Overlay.
_Avoid_: Hidden image, display none, unloaded (the opposite: never requested)

**Sprite**:
A CSS background whose bitmap is a sheet of many icons. Excluded from Fit (recorded as skipped, not red).
_Avoid_: Icon, background (alone)

**Finding**:
One Pass issue on a Subject: Fit at a viewport range, dishonest Sizes, Art direction, Phantom, markup, or a skipped Sprite.
_Avoid_: Error, warning, problem, issue (alone)

**Verdict**:
The worst Finding severity on a Subject across the whole Pass (red > orange > skip > green). Green only if there is no Finding.
_Avoid_: Score, health, global Fit, “correctly implemented” (that phrase is the Verdict)

**Overlay**:
A snapshot traffic-light on a painted Subject showing its Verdict. It does not update on resize; a new Pass is required. Clicking it opens that Subject in the panel.
_Avoid_: Hoverlet, badge, highlight, Fit (the Overlay is not Fit)

**Pass**:
One on-demand inspection of the current page: Subjects, Viewport grid, Findings, snapshot Overlays, and the panel. The toolbar starts a Pass; it does not run on navigation.
_Avoid_: scan, run, analysis (alone), crawl

**Report**:
The tab-scoped set of Passes the user chose to keep (Add to report). Groups merge across those pages into one Agent document. Navigating in the tab does not add a page; closing the tab discards the Report. Reset empties the Report and leaves the current Pass in the panel.
_Avoid_: survey, crawl, site audit, session, panel (the floating UI is not the Report)

**Agent document**:
JSON as source of truth, Markdown generated from it. Groups by root cause (not DOM node). Each group is identity, resource facts, numeric Fit, only valid typed actions, and the pages where it appeared. Produced from the Report. Wrapped by the Agent prompt.
_Avoid_: ARD, ADR, dump, log, agent brief, prompt (the prompt wraps this)

**Agent prompt**:
The clipboard payload for a development agent: a fixed English preamble plus the Markdown Agent document. Copied from the panel only once the current page is in the Report.
_Avoid_: brief, agent brief, copypasta, system prompt, JSON export

**Viewport grid**:
The fixed dense widths used to measure Layout width in a clone iframe (300–3000px, step 20, two aspect ratios). The Agent document exposes aggregated ranges, not every step.
_Avoid_: Breakpoints (those belong to CSS), screen sizes, sampling

**Placeholder**:
A tiny LQIP / blur-up (`aria-hidden`, `blur-sm`, ~30×38) that is not a content image. Never a Phantom, never `add-candidates`. A painted content `<picture>` (intrinsic > 64px, more than a few KB, or a `NNNxNNN` style in the URL) is never a Placeholder — even if a substring of the filename looks tiny.
_Avoid_: closed-disclosure (for LQIP), hidden image

**Vector**:
An SVG Subject. Fit is intrinsic vs CSS box, not srcset. Never `add-candidates`. Light SVGs (under ~8 KB) are informational / skip — viewBox vs CSS box is not a theme ticket. Only heavy SVGs get `svg-oversized`.
_Avoid_: bitmap, raster (for SVG)

**Group**:
Subjects that share file kind + URL family (Shopify CDN, Drupal style, or directory) + srcset width shape + sizes + hiding classes + component. Reported once with an instance count. Exact Resource path is used only for vectors and Placeholders.
_Avoid_: duplicate finding, same image

**Hiding rule**:
The utility class or attribute that prevents painting (`md:hidden`, `lg:hidden`, `x-cloak`, `hidden`). Cited on Phantom actions.
_Avoid_: display none (alone), css-hidden (alone)

**Source max**:
The largest `w` descriptor (or URL-encoded width) available. Candidates above this are invalid. When the decoded bitmap is smaller than the chosen descriptor (`source-short`), the theme cannot invent pixels — that is an image-style / original issue, not a `sizes` ticket.
_Avoid_: needed width (that can exceed Source max)

**Undersized / Oversized**:
Fit direction: chosen `w` vs needed (layout × density). Independent of the traffic-light severity.
_Avoid_: red/orange as the only Fit vocabulary
