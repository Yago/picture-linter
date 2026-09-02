export async function fetchReport() {
  return send('report.get');
}

export async function addToReport(entry) {
  return send('report.add', entry);
}

export async function removeFromReport(url) {
  return send('report.remove', { url });
}

export async function resetReport() {
  return send('report.reset');
}

async function send(type, payload = {}) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { pages: [] };
  }
  try {
    return await chrome.runtime.sendMessage({ type, ...payload }) ?? { pages: [] };
  } catch {
    return { pages: [] };
  }
}
