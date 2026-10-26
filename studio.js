/* Interactions progressives du nouveau site GBO Studio. */
(() => {
  'use strict';
  const qs = (selector, root=document) => root.querySelector(selector);
  const qsa = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const english = () => document.documentElement.dataset.lang === 'en';

  function setupPortfolio() {
    const toolbar = qs('[data-portfolio-filters]');
    if (!toolbar) return;
    const buttons = qsa('[data-filter]', toolbar);
    const cards = qsa('[data-category]');
    buttons.forEach(button => button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      buttons.forEach(btn => btn.setAttribute('aria-pressed', String(btn === button)));
      cards.forEach(card => {
        card.hidden = filter !== 'all' && !card.dataset.category.split(' ').includes(filter);
      });
    }));
  }

  function setupStage() {
    const stage = qs('[data-stage]');
    if (!stage || matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return;
    stage.addEventListener('pointermove', event => {
      const box = stage.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      stage.style.setProperty('--move-x', `${Math.round(x*18)}px`);
      stage.style.setProperty('--move-y', `${Math.round(y*13)}px`);
    });
    stage.addEventListener('pointerleave', () => {
      stage.style.setProperty('--move-x', '0px');
      stage.style.setProperty('--move-y', '0px');
    });
  }

  function setupStoreGalleries() {
    const app = location.pathname.replace(/^\//,'').replace(/\.html$/,'');
    const entries = {
      conscience: {
        label:'Conscience', icon:'conscience-icon.jpg', screenshots:['conscience-01.jpg','conscience-02.jpg'],
        fr:['Les vrais écrans.','La clarté, dans les détails.','Découvrez les statistiques, les habitudes et les vues conçues pour mieux comprendre votre quotidien.'],
        en:['The real app.','Clarity in every detail.','Explore the statistics, habits and thoughtfully designed screens that help you understand daily patterns.']
      },
      kapsy: {
        label:'Kapsy', icon:'kapsy-icon.jpg', screenshots:['kapsy-01.jpg','kapsy-02.jpg'],
        fr:['L’expérience en images.','Vos souvenirs ont leur univers.','Capsules, histoires, évolutions : un espace pensé pour conserver ce qui compte vraiment.'],
        en:['A closer look.','Your memories have their own world.','Capsules, stories and progress: a space for keeping the moments that matter.']
      },
      pannego: {
        label:'PanneGo', icon:'pannego-icon.jpg', screenshots:['pannego-01.jpg','pannego-02.jpg'],
        fr:['L’application sur le terrain.','Tout suivre, d’un coup d’œil.','Déclarations, équipements et interventions : découvrez les interfaces de PanneGo.'],
        en:['Inside the app.','Everything at a glance.','Issues, equipment and interventions: explore PanneGo’s real-world interface.']
      }
    };
    const data = entries[app];
    const main = qs('main.s-shell');
    const hero = qs('.s-page-hero', main || document);
    if (!data || !main || !hero) return;
    const section = document.createElement('section');
    section.className = 's-section s-gallery-section';
    section.setAttribute('aria-label', 'Captures de l’application '+data.label);
    const asset = name => '/assets/store/'+name;
    section.innerHTML = `<div class="container s-gallery-shell">
      <div class="s-gallery-copy"><span class="s-overline"><span data-fr>${data.fr[0]}</span><span data-en>${data.en[0]}</span></span>
        <h2 class="s-title"><span data-fr>${data.fr[1]}</span><span data-en>${data.en[1]}</span></h2>
        <p><span data-fr>${data.fr[2]}</span><span data-en>${data.en[2]}</span></p>
        <div class="s-gallery-kicker"><img src="${asset(data.icon)}" alt="" width="50" height="50" loading="lazy"><strong>${data.label} · iOS & Android</strong></div>
      </div>
      <div class="s-gallery-images">
        ${data.screenshots.map((name,index)=>`<figure><img src="${asset(name)}" loading="lazy" width="444" height="960" alt="${data.label}, capture d’écran ${index+1}"></figure>`).join('')}
      </div></div>`;
    hero.insertAdjacentElement('afterend',section);
  }

  function setupScrollProgress() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bar = document.createElement('div');
    bar.className = 's-scroll-progress';
    bar.setAttribute('aria-hidden','true');
    document.body.prepend(bar);
    let ticking = false;
    const update = () => {
      const max = Math.max(1,document.documentElement.scrollHeight-innerHeight);
      bar.style.setProperty('--scroll-progress',Math.min(1,scrollY/max).toFixed(4));
      ticking = false;
    };
    addEventListener('scroll',() => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    },{passive:true});
    addEventListener('resize',update,{passive:true});
    update();
  }

  function setupWizard() {
    const form = qs('[data-project-form]');
    if (!form) return;
    const steps = qsa('[data-wizard-step]', form);
    const progress = qs('[data-wizard-progress]', form);
    const currentNumber = qs('[data-current-step]', form);
    const back = qs('[data-wizard-back]', form);
    const next = qs('[data-wizard-next]', form);
    const error = qs('[data-wizard-error]', form);
    let current = 0;
    const message = (fr, en) => { error.textContent = english() ? en : fr; };
    const field = name => form.elements.namedItem(name);
    const chosen = name => qs(`[name="${name}"]:checked`, form);
    const text = name => String(field(name)?.value || '').trim();
    const setStep = (index, focusHeading = true) => {
      current = Math.max(0, Math.min(index, steps.length-1));
      steps.forEach((step,i) => { step.hidden = i !== current; });
      if (progress) progress.style.width = `${((current+1)/steps.length)*100}%`;
      if (currentNumber) currentNumber.textContent = `${current+1} / ${steps.length}`;
      back.hidden = current === 0;
      const finalStep = current === steps.length-1;
      const frenchLabel = qs('[data-fr]',next);
      const englishLabel = qs('[data-en]',next);
      if (frenchLabel) frenchLabel.textContent = finalStep ? (form.dataset.endpoint ? 'Envoyer ma demande' : 'Préparer mon e-mail') : 'Continuer';
      if (englishLabel) englishLabel.textContent = finalStep ? (form.dataset.endpoint ? 'Send my request' : 'Prepare my email') : 'Continue';
      error.textContent = '';
      const heading = qs('h2',steps[current]);
      if (focusHeading) heading?.focus({preventScroll:true});
    };
    const checkStep = () => {
      if (current === 0 && !chosen('type')) { message('Choisis le type de projet.','Choose a project type.'); return false; }
      if (current === 1 && text('description').length < 20) { message('Décris ton projet en au moins 20 caractères.','Describe your project in at least 20 characters.'); return false; }
      if (current === 2 && !chosen('delai')) { message('Indique un délai, même approximatif.','Select an approximate timeline.'); return false; }
      if (current === 3) {
        const budget = chosen('budget');
        if (!budget) { message('Choisis une réponse pour le budget.','Choose a budget option.'); return false; }
        if (budget.value === 'autre' && !text('budgetAutre')) { message('Précise le budget choisi.','Specify your budget.'); return false; }
      }
      if (current === 4) {
        const email = field('email');
        if (!text('nom') || !email?.checkValidity()) { message('Indique ton nom et un e-mail valide.','Enter your name and a valid email.'); return false; }
        if (!field('consentement')?.checked) { message('Accepte le traitement de tes coordonnées pour recevoir une réponse.','Agree to the use of your contact details to receive a reply.'); return false; }
      }
      error.textContent = '';
      return true;
    };
    const buildPayload = () => ({
      type: chosen('type')?.value || '', description: text('description'), delai: chosen('delai')?.value || '',
      budget: chosen('budget')?.value === 'autre' ? text('budgetAutre') : chosen('budget')?.value || '',
      nom: text('nom'), email: text('email'), source: 'gbostudio.fr'
    });
    back.addEventListener('click', () => setStep(current-1));
    next.addEventListener('click', async () => {
      if (!checkStep()) return;
      if (current < steps.length-1) { setStep(current+1); return; }
      const endpoint = form.dataset.endpoint;
      if (!endpoint) {
        const p = buildPayload();
        const subject = `Demande de projet GBO Studio — ${p.type}`;
        const body = [
          'Bonjour GBO Studio,', '',
          `Type de projet : ${p.type}`, `Description : ${p.description}`,
          `Délai : ${p.delai}`, `Budget : ${p.budget}`, '',
          `Nom : ${p.nom}`, `E-mail : ${p.email}`, '',
          'Envoyé depuis le questionnaire du site.'
        ].join('\n');
        const mailto = `mailto:contact.gbostudio@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        message('Votre messagerie va s’ouvrir avec un e-mail prérempli. Vérifiez-le, puis cliquez sur Envoyer. Rien n’a encore été transmis.',
          'Your email application will open with a prefilled message. Review it, then click Send. Nothing has been transmitted yet.');
        window.location.href = mailto;
        return;
      }
      next.disabled = true;
      try {
        const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(buildPayload())});
        if (!response.ok) throw Error('Form response '+response.status);
        form.hidden = true;
        const success = qs('[data-wizard-success]');
        if (success) { success.hidden = false; success.focus(); }
      } catch (e) {
        message('Envoi impossible pour le moment. Réessaie plus tard.','Sending failed. Please try again later.');
      } finally { next.disabled = false; }
    });
    const other = qs('[data-budget-other]',form);
    qsa('input[name="budget"]',form).forEach(input => input.addEventListener('change', () => {
      if (other) other.hidden = chosen('budget')?.value !== 'autre';
    }));
    // Éviter une soumission native non configurée ou une navigation accidentelle.
    form.addEventListener('submit', event => event.preventDefault());
    setStep(0, false);
  }

  setupPortfolio();
  setupStoreGalleries();
  setupScrollProgress();
  setupStage();
  setupWizard();
})();
