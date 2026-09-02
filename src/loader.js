(async () => {
  const { togglePass } = await import(chrome.runtime.getURL('src/pass.js'));
  await togglePass();
})();
