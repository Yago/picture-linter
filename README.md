# Picture Linter

Chrome MV3 extension. Click the toolbar icon to run a Pass on the current tab.

## Load unpacked

1. `npm test` (optional) and `npm run icon` if icons are missing.
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → this folder.
3. Open a page with images (or `fixtures/demo.html` via a local server / file URL with “Allow access to file URLs”).
4. Click the Picture Linter icon. Click again to dismiss.

Overlays are a snapshot Verdict (worst Finding), not live Fit. The panel lists Phantoms and exports an Agent prompt (Copy prompt) plus the Agent document JSON.
