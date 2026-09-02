# Layout is measured in a scriptless clone of the live DOM

Reloading the page in an iframe would re-run the app and measure the initial state (accordions closed, mega-menu unopened), missing the Phantoms the developer actually has on screen. Resizing the user’s window is hostile and still would not give a deterministic Viewport grid. A Pass clones the current DOM and stylesheets into a hidden iframe, without scripts, and steps that iframe through the grid. CSS reflow is honest; JS-only layouts (masonry, measured widths) may be wrong, which is accepted for v1.
