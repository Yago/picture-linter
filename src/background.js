chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const url = tab.url ?? '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/loader.js'],
  });
});
