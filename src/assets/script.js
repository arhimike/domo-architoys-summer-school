(() => {
  document.documentElement.classList.add('js-ready');

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');

  const updateHeader = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const closeMenu = () => {
    if (!menuButton || !nav) return;
    menuButton.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };

  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(willOpen));
      nav.classList.toggle('is-open', willOpen);
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('click', (event) => {
      if (menuButton.getAttribute('aria-expanded') !== 'true') return;
      if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    const originalLabel = button.querySelector('span')?.textContent || 'Скопировать текст';
    const label = button.querySelector('span');

    const showCopyStatus = (message, copied = false) => {
      button.classList.toggle('is-copied', copied);
      if (label) label.textContent = message;
      window.setTimeout(() => {
        button.classList.remove('is-copied');
        if (label) label.textContent = originalLabel;
      }, 2600);
    };

    const legacyCopy = (text) => {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.inset = '0 auto auto -9999px';
      document.body.appendChild(field);
      field.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      field.remove();
      return copied;
    };

    button.addEventListener('click', async () => {
      const selector = button.getAttribute('data-copy-target');
      const target = selector ? document.querySelector(selector) : null;
      if (!target) return;

      const text = target.innerText.trim();
      let copied = false;
      try {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        } else {
          copied = legacyCopy(text);
        }
      } catch (error) {
        copied = legacyCopy(text);
      }

      if (copied) {
        showCopyStatus('Текст скопирован', true);
      } else {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        showCopyStatus('Текст выделен — Ctrl+C');
      }
    });
  });

  const lightbox = document.querySelector('[data-lightbox]');
  const galleryButtons = Array.from(document.querySelectorAll('.photo-button[data-full]'));

  if (lightbox && galleryButtons.length) {
    const image = lightbox.querySelector('img');
    const caption = lightbox.querySelector('figcaption');
    const closeButton = lightbox.querySelector('[data-lightbox-close]');
    const previousButton = lightbox.querySelector('[data-lightbox-prev]');
    const nextButton = lightbox.querySelector('[data-lightbox-next]');
    const lightboxFigure = lightbox.querySelector('figure');
    const lightboxStatus = lightbox.querySelector('[data-lightbox-status]');
    const lightboxStatusText = lightboxStatus?.querySelector('span');
    const fallbackLink = lightbox.querySelector('[data-lightbox-fallback]');
    let currentIndex = 0;
    let lastFocusedElement = null;
    let touchStartX = null;
    let imageRequest = 0;

    const showImage = (index) => {
      currentIndex = (index + galleryButtons.length) % galleryButtons.length;
      const trigger = galleryButtons[currentIndex];
      const thumbnail = trigger.querySelector('img');
      const source = trigger.dataset.full;
      const request = ++imageRequest;

      lightbox.classList.remove('is-error');
      lightbox.classList.add('is-loading');
      if (lightboxStatusText) lightboxStatusText.textContent = 'Загрузка фотографии…';
      if (fallbackLink) fallbackLink.href = source;

      image.onload = () => {
        if (request !== imageRequest) return;
        lightbox.classList.remove('is-loading', 'is-error');
      };
      image.onerror = () => {
        if (request !== imageRequest) return;
        lightbox.classList.remove('is-loading');
        lightbox.classList.add('is-error');
        if (lightboxStatusText) lightboxStatusText.textContent = 'Фотография не загрузилась.';
      };
      image.src = source;
      image.alt = thumbnail?.alt || '';
      caption.textContent = trigger.dataset.caption || thumbnail?.alt || '';

      if (image.complete && image.naturalWidth > 0) image.onload();
    };

    const openLightbox = (index) => {
      showImage(index);
      lastFocusedElement = galleryButtons[index];
      if (typeof lightbox.showModal === 'function') {
        if (!lightbox.open) lightbox.showModal();
        document.documentElement.style.overflow = 'hidden';
        closeButton?.focus();
      } else {
        window.open(galleryButtons[index].dataset.full, '_blank', 'noopener');
      }
    };

    const closeLightbox = () => {
      if (lightbox.open) lightbox.close();
      document.documentElement.style.overflow = '';
      lastFocusedElement?.focus();
    };

    galleryButtons.forEach((button, index) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        openLightbox(index);
      });
    });

    closeButton?.addEventListener('click', closeLightbox);
    previousButton?.addEventListener('click', () => showImage(currentIndex - 1));
    nextButton?.addEventListener('click', () => showImage(currentIndex + 1));

    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    lightbox.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeLightbox();
    });

    lightbox.addEventListener('close', () => {
      document.documentElement.style.overflow = '';
    });

    lightboxFigure?.addEventListener('touchstart', (event) => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });

    lightboxFigure?.addEventListener('touchend', (event) => {
      if (touchStartX === null) return;
      const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
      const distance = touchEndX - touchStartX;
      touchStartX = null;
      if (Math.abs(distance) < 45) return;
      showImage(currentIndex + (distance < 0 ? 1 : -1));
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (!lightbox.open) return;
      if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
      if (event.key === 'ArrowRight') showImage(currentIndex + 1);
    });
  }

  const morePhotos = document.querySelector('.more-photos');
  if (morePhotos) {
    const label = morePhotos.querySelector('summary span');
    morePhotos.addEventListener('toggle', () => {
      if (label) label.textContent = morePhotos.open ? 'Скрыть дополнительные кадры' : 'Показать ещё 6 кадров';
    });
  }

  const glossary = document.querySelector('[data-glossary]');
  if (glossary) {
    const search = glossary.querySelector('[data-glossary-search]');
    const cards = Array.from(glossary.querySelectorAll('[data-glossary-card]'));
    const filterButtons = Array.from(glossary.querySelectorAll('[data-filter]'));
    const count = glossary.querySelector('[data-glossary-count]');
    const empty = glossary.querySelector('[data-glossary-empty]');
    let activeFilter = 'all';

    const normalize = (value) => String(value || '')
      .toLocaleLowerCase('ru-RU')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ё/g, 'е');

    const applyGlossaryFilters = () => {
      const query = normalize(search?.value).trim();
      let visible = 0;

      cards.forEach((card) => {
        const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
        const matchesQuery = !query || normalize(card.textContent).includes(query);
        const show = matchesCategory && matchesQuery;
        card.hidden = !show;
        if (!show) card.open = false;
        if (show) visible += 1;
      });

      if (count) count.textContent = `Показано ${visible} из ${cards.length}`;
      if (empty) empty.hidden = visible !== 0;
    };

    search?.addEventListener('input', applyGlossaryFilters);

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter || 'all';
        filterButtons.forEach((item) => {
          const isActive = item === button;
          item.classList.toggle('is-active', isActive);
          item.setAttribute('aria-pressed', String(isActive));
        });
        applyGlossaryFilters();
      });
    });

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        search?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === search && search?.value) {
        search.value = '';
        applyGlossaryFilters();
      }
    });
  }
})();
