export function renderOverlays(layer, results, onSelect, onExplain) {
  layer.replaceChildren();
  const marks = [];
  for (const result of results) {
    if (result.verdict === 'skip') continue;
    const rect = result.subject.painted;
    if (!rect) continue;
    const mark = document.createElement('div');
    mark.className = 'pl-mark';
    mark.dataset.verdict = result.verdict;
    mark.dataset.id = result.subject.id;
    mark.innerHTML = `
      <span class="pl-mark__tint"></span>
      <span class="pl-crop pl-crop--tl"></span>
      <span class="pl-crop pl-crop--tr"></span>
      <span class="pl-crop pl-crop--bl"></span>
      <span class="pl-crop pl-crop--br"></span>
      <button type="button" class="pl-pip">${result.verdict}</button>
      <button type="button" class="pl-info" aria-label="Explain this subject">ℹ</button>
    `;
    mark.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect(result.subject.id);
    });
    mark.querySelector('.pl-info').addEventListener('click', (event) => {
      event.stopPropagation();
      onExplain(result.subject.id);
    });
    layer.append(mark);
    marks.push({ mark, element: result.subject.element });
  }
  const place = () => {
    for (const { mark, element } of marks) {
      const box = element.getBoundingClientRect();
      mark.style.top = `${box.top}px`;
      mark.style.left = `${box.left}px`;
      mark.style.width = `${Math.max(box.width, 1)}px`;
      mark.style.height = `${Math.max(box.height, 1)}px`;
    }
  };
  place();
  return place;
}

export function highlight(layer, id) {
  for (const mark of layer.querySelectorAll('.pl-mark')) {
    mark.toggleAttribute('data-active', mark.dataset.id === id);
  }
}
