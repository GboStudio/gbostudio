/* GBO Studio V4 — illustrative local interactions. No personal data is sent. */
(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const english = () => document.documentElement.dataset.lang === 'en';
  const localized = (messages) => messages[english() ? 'en' : 'fr'];
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const apps = {
    kapsy: {
      name:'Kapsy', accent:'kapsy', link:'/kapsy.html',
      primary:'/assets/store/kapsy-01.jpg', secondary:'/assets/store/kapsy-02.jpg',
      fr:{title:'Chaque souvenir a une histoire.',desc:'Des moments à conserver, des capsules à faire grandir et à retrouver.',caption:'Une capsule attend son moment…',button:'Révéler la capsule',result:'✦ Un souvenir pour demain vient de s’ouvrir.'},
      en:{title:'Every memory has a story.',desc:'Preserve your moments and let your time capsules grow.',caption:'A capsule is waiting for its moment…',button:'Reveal the capsule',result:'✦ A memory for tomorrow has opened.'}
    },
    conscience: {
      name:'Conscience', accent:'conscience', link:'/conscience.html',
      primary:'/assets/store/conscience-01.jpg', secondary:'/assets/store/conscience-02.jpg',
      fr:{title:'Les petits pas comptent.',desc:'Observez vos habitudes et donnez du sens à votre progression.',caption:'Habitude fictive : prendre du temps pour soi',button:'Marquer comme accomplie',result:'✓ Belle avancée ! Un jour de plus à votre série.'},
      en:{title:'Small steps make progress.',desc:'Notice your habits and understand what helps you grow.',caption:'Demo habit: make time for yourself',button:'Mark as completed',result:'✓ Nicely done! One more day in your streak.'}
    },
    pannego: {
      name:'PanneGo', accent:'pannego', link:'/pannego.html',
      primary:'/assets/store/pannego-01.jpg', secondary:'/assets/store/pannego-02.jpg',
      fr:{title:'Du problème à la solution.',desc:'Signalez, organisez et suivez les incidents et les équipements.',caption:'Incident fictif : écran à vérifier',button:'Marquer comme résolu',result:'✓ Incident fictif résolu et suivi.'},
      en:{title:'From issue to solution.',desc:'Report, organize and follow issues and equipment.',caption:'Demo incident: screen to check',button:'Mark as resolved',result:'✓ Demo incident marked as resolved.'}
    }
  };

  function setupExperience() {
    const experience = $('[data-v4-experience]');
    if (!experience) return;
    const buttons = $$('[data-v4-app]',experience);
    const panel = $('#v4-panel',experience);
    const heading = $('[data-v4-heading]',experience);
    const description = $('[data-v4-description]',experience);
    const caption = $('[data-v4-preview-label]',experience);
    const buttonLabel = $('[data-v4-button-label]',experience);
    const result = $('[data-v4-result]',experience);
    const action = $('[data-v4-trigger]',experience);
    const primary = $('[data-v4-primary]',experience);
    const secondary = $('[data-v4-secondary]',experience);
    const watermark = $('[data-v4-watermark]',experience);
    const link = $('[data-v4-link]',experience);
    let current = 'kapsy';
    let completed = false;

    const render = () => {
      const data = apps[current];
      const copy = localized(data);
      experience.dataset.currentApp = current;
      heading.textContent = copy.title;
      description.textContent = copy.desc;
      caption.textContent = copy.caption;
      buttonLabel.textContent = copy.button;
      result.textContent = completed ? copy.result : '';
      action.setAttribute('aria-pressed',String(completed));
      primary.src = data.primary;
      primary.alt = (english() ? 'Official screenshot of ' : 'Capture officielle de ') + data.name;
      secondary.src = data.secondary;
      watermark.textContent = data.name.toUpperCase();
      link.href = data.link;
      buttons.forEach(tab => {
        const selected = tab.dataset.v4App === current;
        tab.setAttribute('aria-selected',String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected) panel.setAttribute('aria-labelledby',tab.id);
      });
    };
    const select = (key) => {
      if (!(key in apps)) return;
      current = key;
      completed = false;
      if (!prefersReducedMotion.matches) {
        experience.classList.remove('is-changing');
        // Restart the entrance transition when visitors choose another world.
        void experience.offsetWidth;
        experience.classList.add('is-changing');
      }
      render();
    };
    buttons.forEach((tab,index) => {
      tab.addEventListener('click',() => select(tab.dataset.v4App));
      tab.addEventListener('keydown',(event) => {
        const keys = ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 :
          (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        select(buttons[next].dataset.v4App);
      });
    });
    action.addEventListener('click',() => { completed = !completed; render(); });
    new MutationObserver((records) => {
      if (records.some(record => record.attributeName === 'data-lang')) render();
    }).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});
    render();
  }

  const ideas = {
    mobile:{icon:'◉',fr:['Votre application.','Une expérience pensée pour tenir dans la main.'],en:['Your mobile app.','An experience made to fit in your hand.']},
    web:{icon:'▣',fr:['Votre expérience web.','Une présence digitale qui se démarque.'],en:['Your web experience.','An online presence that stands out.']},
    business:{icon:'⌘',fr:['Votre outil métier.','Une solution qui suit votre activité.'],en:['Your business tool.','A solution built around your work.']},
    ai:{icon:'✳',fr:['Votre idée, augmentée.','Le bon usage de l’IA, au bon endroit.'],en:['Your idea, enhanced.','AI where it makes a real difference.']}
  };
  function setupIdeaSelector() {
    const visual = $('[data-v4-idea-visual]');
    if (!visual) return;
    const buttons = $$('[data-v4-idea]');
    let selected = 'mobile';
    const render = () => {
      const data = ideas[selected];
      const copy = localized(data);
      visual.dataset.kind = selected;
      $('[data-v4-idea-icon]',visual).textContent = data.icon;
      $('[data-v4-idea-name]',visual).textContent = copy[0];
      $('[data-v4-idea-text]',visual).textContent = copy[1];
      buttons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.v4Idea === selected)));
    };
    buttons.forEach(button => button.addEventListener('click',()=>{selected=button.dataset.v4Idea;render();}));
    new MutationObserver((records) => {
      if (records.some(record => record.attributeName === 'data-lang')) render();
    }).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});
    render();
  }

  setupExperience();
  setupIdeaSelector();
})();
