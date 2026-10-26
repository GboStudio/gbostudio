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
    const setStep = index => {
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
      heading?.focus({preventScroll:true});
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
    setStep(0);
  }

  setupPortfolio();
  setupStage();
  setupWizard();
})();
