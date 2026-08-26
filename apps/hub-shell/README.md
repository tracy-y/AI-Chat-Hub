# Hub Shell

Dependency-free Chrome Manifest V3 side-panel PoC. It currently uses two Mock Providers and requests no access to real AI websites.

## Local loading

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `apps/hub-shell` directory.
5. Pin AI Chat Hub and click its toolbar icon to open the side panel.

The PoC stores mock conversations in `chrome.storage.local`. It never reads or stores browser cookies.
