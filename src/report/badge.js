import { getReport } from './store.js';

const VOID = '#14110e';
const FOG = '#d4cbb8';

export function badgeLabel(count) {
  if (!count) return '';
  return count > 9 ? '9+' : String(count);
}

export async function syncBadge(tabId) {
  try {
    const report = await getReport(tabId);
    const text = badgeLabel(report.pages?.length ?? 0);
    await chrome.action.setBadgeBackgroundColor({ tabId, color: VOID });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ tabId, color: FOG });
    }
    await chrome.action.setBadgeText({ tabId, text });
  } catch {
    /* tab gone */
  }
}

export async function restoreBadges() {
  const all = await chrome.storage.session.get(null);
  await Promise.all(Object.entries(all).map(async ([key, report]) => {
    if (!key.startsWith('report:')) return;
    const tabId = Number(key.slice('report:'.length));
    if (!Number.isFinite(tabId)) return;
    const text = badgeLabel(report?.pages?.length ?? 0);
    await chrome.action.setBadgeBackgroundColor({ tabId, color: VOID });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ tabId, color: FOG });
    }
    await chrome.action.setBadgeText({ tabId, text });
  }));
}
