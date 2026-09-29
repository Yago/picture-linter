export function fileName(url) {
  if (!url) return '';
  try {
    const path = new URL(url, document.baseURI).pathname;
    return path.split('/').filter(Boolean).pop() || url;
  } catch {
    return url;
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
