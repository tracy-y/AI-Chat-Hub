# Hub Shell

Dependency-free Chrome Manifest V3 side-panel PoC. It provides a manual relay for ChatGPT and Claude and requests no access to either website.

## Local loading

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `apps/hub-shell` directory.
5. Pin AI Chat Hub and click its toolbar icon to open the side panel.

## Workflow

1. Write a prompt in Hub and copy it.
2. Open each official website from Hub.
3. Send the prompt yourself using your own account.
4. Use the official copy action and paste the response into Hub.
5. Optionally paste the official conversation URL, then save the unchanged response locally.

The PoC stores manually pasted conversations in `chrome.storage.local`. It never reads or stores browser cookies, account identifiers, or subscription details.
