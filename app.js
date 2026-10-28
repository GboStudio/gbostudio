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

  // V5: une direction artistique commune, sans modifier les contenus ni les URL.
  // Les scènes sont décoratives : les captures d'apps sont les vrais visuels du studio.
  function setupSitewideExperience(){
    body.classList.add('gbo-v5');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const page = slug.replace(/\.html$/, '');
    const scene = {
      conscience:{name:'Conscience',kind:'store',tone:'sage'},
      kapsy:{name:'Kapsy',kind:'store',tone:'rose'},
      pannego:{name:'PanneGo',kind:'store',tone:'sun'},
      pulse:{name:'Pulse',kind:'concept',tone:'electric',symbol:'↗'},
      replay:{name:'Replay',kind:'concept',tone:'sun',symbol:'≋'},
      'gbo-ads':{name:'GBO Ads',kind:'concept',tone:'rose',symbol:'✦'},
      applications:{name:'GBO / 10',kind:'concept',tone:'violet',symbol:'✳'},
      services:{name:'GBO / Studio',kind:'concept',tone:'violet',symbol:'◈'}
    }[page];

    // Mise en scène éditoriale de chaque page produit et de nos deux catalogues.
    const heroContainer = document.querySelector('.studio-v2 .s-page-hero > .container');
    if(heroContainer && scene && !heroContainer.classList.contains('v5-hero-layout')){
      const copy = document.createElement('div');
      copy.className = 'v5-hero-copy';
      while(heroContainer.firstChild) copy.appendChild(heroContainer.firstChild);
      const visual = document.createElement('div');
      visual.className = 'v5-hero-visual v5-scene-'+scene.kind;
      visual.dataset.tone = scene.tone;
      visual.setAttribute('aria-hidden','true');
      const asset = name => '/assets/store/'+name;
      if(scene.kind === 'store'){
        const key = page;
        visual.innerHTML = `<div class="v5-visual-grain"></div>
          <div class="v5-screenshot v5-shot-back"><img src="${asset(key+'-02.jpg')}" alt="" width="444" height="960" loading="eager"></div>
          <div class="v5-screenshot v5-shot-front"><img src="${asset(key+'-01.jpg')}" alt="" width="444" height="960" loading="eager"></div>
          <div class="v5-visual-signature"><img src="${asset(key+'-icon.jpg')}" alt="" width="44" height="44"><strong>${scene.name}</strong><span>GBO Studio</span></div>
          <div class="v5-orbit-ring"></div>`;
      }else{
        visual.innerHTML = `<div class="v5-visual-grain"></div><div class="v5-orbit-ring"></div>
          <div class="v5-concept-window"><div class="v5-window-dots"><i></i><i></i><i></i></div>
          <div class="v5-concept-symbol">${scene.symbol}</div><strong>${scene.name}</strong>
          <div class="v5-window-bars"><i></i><i></i><i></i><i></i></div></div>
          <div class="v5-concept-stamp">GBO <span>✦</span> STUDIO</div>`;
      }
      heroContainer.classList.add('v5-hero-layout');
      heroContainer.append(copy,visual);
      heroContainer.classList.remove('reveal');
    }

    // Révélation séquentielle, en respectant les préférences d'accessibilité.
    const selectors = [
      '.s-page-hero .container', '.v5-hero-copy', '.v5-hero-visual',
      '.s-section-header', '.s-directory-card', '.s-service', '.s-process article',
      '.s-manifesto > div', '.s-gallery-shell', '.s-form-wrap', '.s-cta-inner',
      '.section-head', '.feature-card', '.app-card', '.list-link',
      '.quiet-band', '.panel', '.card', '.hero .narrow', '.hero .container'
    ];
    const seen = new Set();
    const items = Array.from(document.querySelectorAll(selectors.join(','))).filter(el => {
      if(seen.has(el) || el.classList.contains('v5-hero-layout') || el.hidden || el.closest('[hidden]')) return false;
      seen.add(el); return true;
    });
    if(reduced || !('IntersectionObserver' in window)){
      items.forEach(el => el.classList.add('v5-shown'));
    }else{
      const io = new IntersectionObserver(entries => {
        for(const entry of entries){
          if(!entry.isIntersecting) continue;
          entry.target.classList.add('v5-shown');
          io.unobserve(entry.target);
        }
      },{threshold:.06,rootMargin:'0px 0px -24px'});
      items.forEach((el,i) => {
        el.classList.add('v5-reveal');
        el.style.setProperty('--v5-stagger', `${Math.min(i % 4,3)*65}ms`);
        if(el.getBoundingClientRect().top < window.innerHeight*.94){
          requestAnimationFrame(() => el.classList.add('v5-shown'));
        }else io.observe(el);
      });
    }

    // Halo de survol non intrusif pour les cartes, uniquement avec pointeur fin.
    if(!reduced && window.matchMedia('(hover:hover) and (pointer:fine)').matches){
      const cards = document.querySelectorAll('.s-directory-card,.s-project,.s-service,.feature-card,.app-card,.list-link');
      cards.forEach(card => card.addEventListener('pointermove', event => {
        const box = card.getBoundingClientRect();
        card.style.setProperty('--v5-x',`${event.clientX-box.left}px`);
        card.style.setProperty('--v5-y',`${event.clientY-box.top}px`);
      },{passive:true}));
    }
  }

  setLang(getStored('gbo_lang','fr'));
  setTheme(getStored('gbo_theme','auto'));
  setupModernMenu();
  setupLegacyMenu();
  setupHeader();
  setupReveals();
  setupSitewideExperience();

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
