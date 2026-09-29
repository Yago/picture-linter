# aria-hidden images are Ignored, not Phantoms

An image with `aria-hidden="true"` on itself or an ancestor used to become a Phantom (carousel slide, closed disclosure) or a Placeholder signal. It is now Ignored: not a Subject, so no Overlay, panel row, Finding, or Group. Decorative images should not be linted. The cost is that a wasted download on an aria-hidden slide or closed dialog is no longer reported, including when an open modal marks the rest of the page `aria-hidden`.
