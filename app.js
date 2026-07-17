(function(){
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  root.classList.add('js');

  const path = (location.pathname || '/').toLowerCase();
  const slug = path.split('/').filter(Boolean).pop() || 'home';
  body.classList.add('page-' + slug.replace(/\.html$/, '').replace(/[^a-z0-9-]/g, '-'));

  function safeStore(key, value){
    try { localStorage.setItem(key, value); } catch(e) {}
  }

  function setLang(value){
    const next = value === 'en' ? 'en' : 'fr';
    root.dataset.lang = next;
    root.lang = next;
    safeStore('gbo_lang', next);
    document.querySelectorAll('[data-lang-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.langBtn === next);
      btn.setAttribute('aria-pressed', String(btn.dataset.langBtn === next));
    });
    enhanceTables();
  }

  function setTheme(value){
    const next = ['light','dark','auto'].includes(value) ? value : 'auto';
    root.dataset.theme = next;
    safeStore('gbo_theme', next);
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeBtn === next);
      btn.setAttribute('aria-pressed', String(btn.dataset.themeBtn === next));
    });
  }

  function getStored(key, fallback){
    try { return localStorage.getItem(key) || fallback; } catch(e) { return fallback; }
  }

  function enhanceTables(){
    document.querySelectorAll('.compare-table').forEach(table => {
      const lang = root.dataset.lang || 'fr';
      let labels = Array.from(table.querySelectorAll('thead th')).map(th => {
        const translated = th.querySelector(lang === 'en' ? '[data-en]' : '[data-fr]');
        if(translated) return translated.textContent.trim();
        return Array.from(th.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim())
          .filter(Boolean)
          .join(' ') || th.textContent.trim();
      });
      if(!labels.length){
        const count = table.querySelector('tbody tr')?.children.length || 0;
        labels = lang === 'en'
          ? ['Application','Status','Availability','Privacy','Page'].slice(0,count)
          : ['Application','Statut','Disponibilité','Confidentialité','Page'].slice(0,count);
      }
      table.querySelectorAll('tbody tr').forEach(row => {
        Array.from(row.children).forEach((cell,index) => {
          if(index > 0) cell.dataset.label = labels[index] || (lang === 'en' ? 'Details' : 'Détails');
        });
      });
    });
  }

  function setupModernMenu(){
    const menu = document.querySelector('[data-menu]');
    const toggle = document.querySelector('[data-menu-toggle]');
    if(!menu || !toggle) return;

    const close = () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
    };

    toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', event => {
      if(!menu.contains(event.target) && !toggle.contains(event.target)) close();
    });
    document.addEventListener('keydown', event => { if(event.key === 'Escape') close(); });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  }

  function setupLegacyMenu(){
    const nav = document.querySelector('.nav');
    const menu = nav?.querySelector(':scope > .nav-right');
    if(!nav || !menu || nav.querySelector('.legacy-nav-toggle')) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'legacy-nav-toggle';
    toggle.setAttribute('aria-label', root.dataset.lang === 'en' ? 'Open menu' : 'Ouvrir le menu');
    toggle.setAttribute('aria-expanded','false');
    toggle.innerHTML = '<span></span><span></span>';
    nav.insertBefore(toggle, menu);

    const close = () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
    };

    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', event => {
      if(!menu.contains(event.target) && !toggle.contains(event.target)) close();
    });
    document.addEventListener('keydown', event => { if(event.key === 'Escape') close(); });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  }

  function setupHeader(){
    const header = document.querySelector('[data-header], .header');
    if(!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive:true });
  }

  function setupReveals(){
    const items = document.querySelectorAll('.reveal');
    if(!items.length) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)){
      items.forEach(item => item.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold:.08, rootMargin:'0px 0px -30px' });
    items.forEach(item => observer.observe(item));
  }

  setLang(getStored('gbo_lang','fr'));
  setTheme(getStored('gbo_theme','auto'));
  setupModernMenu();
  setupLegacyMenu();
  setupHeader();
  setupReveals();

  document.addEventListener('click', event => {
    const langButton = event.target.closest('[data-lang-btn]');
    if(langButton) setLang(langButton.dataset.langBtn);
    const themeButton = event.target.closest('[data-theme-btn]');
    if(themeButton) setTheme(themeButton.dataset.themeBtn);
  });

  window.addEventListener('resize', () => {
    if(window.innerWidth > 920){
      document.querySelectorAll('.nav-panel.open,.nav-right.open').forEach(menu => menu.classList.remove('open'));
      document.querySelectorAll('[data-menu-toggle],.legacy-nav-toggle').forEach(toggle => toggle.setAttribute('aria-expanded','false'));
    }
  }, { passive:true });
})();
