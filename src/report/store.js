const PREFIX = 'report:';

export function reportKey(tabId) {
  return `${PREFIX}${tabId}`;
}

export async function getReport(tabId) {
  const key = reportKey(tabId);
  const data = await chrome.storage.session.get(key);
  return data[key] ?? { pages: [] };
}

export async function setReport(tabId, report) {
  await chrome.storage.session.set({ [reportKey(tabId)]: report });
  return report;
}

export async function addPage(tabId, entry) {
  const report = await getReport(tabId);
  const pages = report.pages.filter((page) => page.url !== entry.url);
  pages.push({ url: entry.url, title: entry.title ?? '', doc: entry.doc });
  return setReport(tabId, { pages });
}

export async function removePage(tabId, url) {
  const report = await getReport(tabId);
  return setReport(tabId, { pages: report.pages.filter((page) => page.url !== url) });
}

export async function resetReport(tabId) {
  return setReport(tabId, { pages: [] });
}

export async function dropReport(tabId) {
  await chrome.storage.session.remove(reportKey(tabId));
}
