# Overlay shows a snapshot Verdict, not live Fit

NCC-style overlays colored the bitmap currently on screen and updated on resize. That contradicts a Pass that already measures the whole Viewport grid: resizing the window would duplicate work and hide failures that only exist at other widths. The Overlay is a snapshot of the Subject’s Verdict after a Pass. It does not move when the viewport changes; a new Pass is required. Clicking it opens that Subject in the Report, where per-range Fit and other Findings live.
