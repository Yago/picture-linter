import { addPage, dropReport, getReport, removePage, resetReport } from './report/store.js';
import { restoreBadges, syncBadge } from './report/badge.js';

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await syncBadge(tab.id);
  const url = tab.url ?? '';
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/loader.js'],
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  dropReport(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) syncBadge(tabId);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  syncBadge(tabId);
});

chrome.runtime.onStartup.addListener(() => {
  restoreBadges();
});
chrome.runtime.onInstalled.addListener(() => {
  restoreBadges();
});
restoreBadges();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId || !message?.type?.startsWith('report.')) return;
  handle(tabId, message).then(sendResponse);
  return true;
});

async function handle(tabId, message) {
  switch (message.type) {
    case 'report.get':
      return getReport(tabId);
    case 'report.add': {
      const report = await addPage(tabId, { url: message.url, title: message.title, doc: message.doc });
      await syncBadge(tabId);
      return report;
    }
    case 'report.remove': {
      const report = await removePage(tabId, message.url);
      await syncBadge(tabId);
      return report;
    }
    case 'report.reset': {
      const report = await resetReport(tabId);
      await syncBadge(tabId);
      return report;
    }
    default:
      return getReport(tabId);
  }
}
