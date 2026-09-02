# Picture Linter

Chrome MV3 extension. Click the toolbar icon to run a Pass on the current tab.

## Load unpacked

1. `npm test` (optional) and `npm run icon` if icons are missing.
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → this folder.
3. Open a page with images (or `fixtures/demo.html` via a local server / file URL with “Allow access to file URLs”).
4. Click the Picture Linter icon. Click again to dismiss.

Overlays are a snapshot Verdict (worst Finding), not live Fit. The panel lists the current Pass. **Add to report** keeps that Pass in this tab’s Report. The toolbar badge shows how many pages are in that Report (`9+` after 9). **Copy prompt** appears only after this page is in the Report and exports the merged Agent prompt. **Reset report** clears the Report and leaves the current Pass.
