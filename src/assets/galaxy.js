(() => {
  const root = document.querySelector('[data-galaxy]');
  if (!root) return;

  const cards = Array.from(root.querySelectorAll('[data-galaxy-card]'));
  const filterButtons = Array.from(root.querySelectorAll('[data-galaxy-filter]'));
  const search = root.querySelector('[data-galaxy-search]');
  const count = root.querySelector('[data-galaxy-count]');
  const empty = root.querySelector('[data-galaxy-empty]');
  const randomButton = root.querySelector('[data-galaxy-random]');
  const dialog = document.querySelector('[data-galaxy-dialog]');
  const dialogContent = dialog?.querySelector('[data-galaxy-dialog-content]');
  const dialogRandom = dialog?.querySelector('[data-galaxy-dialog-random]');
  let activeCode = 'ALL';
  let lastFocused = null;
  let currentId = null;

  const normalize = (value = '') => String(value)
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();

  const visibleCards = () => cards.filter((card) => !card.hidden);

  const applyFilters = () => {
    const query = normalize(search?.value);
    let visible = 0;

    cards.forEach((card) => {
      const clusterMatches = activeCode === 'ALL' || card.dataset.code === activeCode;
      const queryMatches = !query || normalize(card.textContent).includes(query);
      card.hidden = !(clusterMatches && queryMatches);
      if (!card.hidden) visible += 1;
    });

    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible !== 0;
  };

  const openPassport = (id, trigger = null) => {
    if (!dialog || !dialogContent) return;
    const template = document.getElementById(`galaxy-passport-${id}`);
    if (!template) return;

    lastFocused = trigger || document.activeElement;
    currentId = String(id);
    dialogContent.replaceChildren(template.content.cloneNode(true));
    const title = dialogContent.querySelector('h2');
    if (title) title.id = 'galaxy-dialog-title';

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    document.documentElement.classList.add('galaxy-modal-open');
    dialog.querySelector('.galaxy-dialog-close')?.focus();
  };

  const openRandom = () => {
    const pool = visibleCards().filter((card) => card.querySelector('[data-galaxy-open]')?.dataset.galaxyOpen !== currentId);
    const fallback = visibleCards().length ? visibleCards() : cards;
    const choices = pool.length ? pool : fallback;
    if (!choices.length) return;
    const card = choices[Math.floor(Math.random() * choices.length)];
    const trigger = card.querySelector('[data-galaxy-open]');
    openPassport(trigger?.dataset.galaxyOpen, trigger);
  };

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeCode = button.dataset.galaxyFilter || 'ALL';
      filterButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      applyFilters();
    });
  });

  search?.addEventListener('input', applyFilters);
  randomButton?.addEventListener('click', openRandom);
  dialogRandom?.addEventListener('click', openRandom);

  cards.forEach((card) => {
    const trigger = card.querySelector('[data-galaxy-open]');
    trigger?.addEventListener('click', () => openPassport(trigger.dataset.galaxyOpen, trigger));
  });

  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog?.addEventListener('close', () => {
    document.documentElement.classList.remove('galaxy-modal-open');
    currentId = null;
    lastFocused?.focus();
  });

  applyFilters();
})();
