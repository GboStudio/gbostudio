/* GBO Studio V6 — progressive enhancement, local-only illustrative interactions. */
(() => {
  'use strict';
  const $ = (selector,root=document) => root.querySelector(selector);
  const $$ = (selector,root=document) => Array.from(root.querySelectorAll(selector));
  const english = () => document.documentElement.dataset.lang === 'en';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const localized = (data) => data[english() ? 'en' : 'fr'];
  const languageWatch = (render) => new MutationObserver(records => {
    if(records.some(record => record.attributeName === 'data-lang')) render();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['data-lang']});

  function setupPromo(){
    const promo = $('[data-v6-promo]');
    if(!promo) return;
    const toggle = $('[data-v6-promo-toggle]',promo);
    const icon = $('[data-v6-promo-glyph]',promo);
    const fr = $('[data-v6-promo-label-fr]',promo);
    const en = $('[data-v6-promo-label-en]',promo);
    if(!toggle) return;
    let paused = reduced.matches;
    const render = () => {
      promo.classList.toggle('is-paused',paused);
      toggle.setAttribute('aria-pressed',String(paused));
      icon.textContent = paused ? '▶' : 'Ⅱ';
      fr.textContent = paused ? 'Relancer l’animation' : 'Mettre en pause';
      en.textContent = paused ? 'Play animation' : 'Pause animation';
    };
    toggle.addEventListener('click',() => {paused=!paused;render();});
    render();
  }

  const demos = {
    kapsy: {
      image:'kapsy-01.jpg',link:'/kapsy.html',symbol:'✦',
      fr:{title:'Un souvenir pour demain.',description:'Créez une capsule fictive et découvrez l’instant de sa révélation.',object:'Capsule « Notre moment »',subtitle:'Elle attend d’être ouverte.',action:'Révéler la capsule',reset:'Refermer la capsule',result:'✦ La capsule fictive s’ouvre : votre souvenir est révélé.',done:'Un joli moment est prêt à être retrouvé.'},
      en:{title:'A memory for tomorrow.',description:'Open an illustrative capsule and discover its reveal.',object:'“Our moment” capsule',subtitle:'Waiting to be opened.',action:'Reveal capsule',reset:'Close capsule',result:'✦ Demo capsule opened: your memory is revealed.',done:'A special moment is ready to rediscover.'}
    },
    conscience: {
      image:'conscience-01.jpg',link:'/conscience.html',symbol:'◌',
      fr:{title:'Un petit pas, aujourd’hui.',description:'Cochez une habitude fictive et observez votre progression.',object:'Prendre cinq minutes pour soi',subtitle:'Aujourd’hui · démonstration',action:'Marquer comme accomplie',reset:'Annuler cette étape',result:'✓ Habitude fictive validée pour aujourd’hui.',done:'Une journée de progression supplémentaire.'},
      en:{title:'One small step today.',description:'Complete a fictional habit and see your progress.',object:'Take five minutes for yourself',subtitle:'Today · illustrative demo',action:'Mark as completed',reset:'Undo progress',result:'✓ Fictional habit completed for today.',done:'One more day of progress.'}
    },
    pannego: {
      image:'pannego-01.jpg',link:'/pannego.html',symbol:'⚙',
      fr:{title:'Un incident, un suivi.',description:'Résolvez un incident fictif, sans créer de dossier réel.',object:'Écran à contrôler',subtitle:'Ticket de démonstration · à traiter',action:'Clôturer cet incident',reset:'Rouvrir l’incident',result:'✓ Incident fictif clôturé et tracé.',done:'Ticket de démonstration · résolu'},
      en:{title:'From issue to resolution.',description:'Close a fictional incident without creating a real ticket.',object:'Screen needs inspection',subtitle:'Demo ticket · pending',action:'Close this incident',reset:'Reopen incident',result:'✓ Fictional issue marked resolved.',done:'Demo ticket · resolved'}
    }
  };

  function attachSwipe(element,onSwipe){
    if(!element) return;
    let startX=0,startY=0;
    element.addEventListener('touchstart',event => {
      if(event.touches.length !== 1) return;
      startX=event.touches[0].clientX;startY=event.touches[0].clientY;
    },{passive:true});
    element.addEventListener('touchend',event => {
      if(!event.changedTouches.length) return;
      const dx=event.changedTouches[0].clientX-startX;
      const dy=event.changedTouches[0].clientY-startY;
      if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.3) onSwipe(dx<0 ? 1 : -1);
    },{passive:true});
  }

  function setupDemoLab(){
    const lab=$('[data-v6-demo-lab]');
    if(!lab) return;
    const panel=$('#v6-demo-panel',lab);
    const tabs=$$('[data-v6-demo]',lab);
    const title=$('[data-v6-demo-title]',lab);
    const description=$('[data-v6-demo-description]',lab);
    const object=$('[data-v6-demo-object-title]',lab);
    const subtitle=$('[data-v6-demo-object-subtitle]',lab);
    const symbol=$('[data-v6-demo-symbol]',lab);
    const image=$('[data-v6-demo-image]',lab);
    const result=$('[data-v6-demo-result]',lab);
    const action=$('[data-v6-demo-action]',lab);
    const actionLabel=$('[data-v6-demo-action-label]',lab);
    const link=$('[data-v6-demo-link]',lab);
    let selected='kapsy',finished=false;
    const render=() => {
      const data=demos[selected],copy=localized(data);
      lab.dataset.app=selected;
      title.textContent=copy.title;
      description.textContent=copy.description;
      object.textContent=copy.object;
      subtitle.textContent=finished?copy.done:copy.subtitle;
      symbol.textContent=finished?'✓':data.symbol;
      actionLabel.textContent=finished?copy.reset:copy.action;
      action.setAttribute('aria-pressed',String(finished));
      result.textContent=finished?copy.result:'';
      image.src='/assets/store/'+data.image;
      image.alt=(english()?'Real screenshot of ':'Capture réelle de ')+selected;
      link.href=data.link;
      tabs.forEach(tab=>{
        const active=tab.dataset.v6Demo===selected;
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active?0:-1;
        if(active) panel.setAttribute('aria-labelledby',tab.id);
      });
    };
    const select=(name,focus=false)=>{
      if(!Object.prototype.hasOwnProperty.call(demos,name)) return;
      selected=name;finished=false;
      lab.classList.remove('is-changing');
      if(!reduced.matches){void lab.offsetWidth;lab.classList.add('is-changing');}
      render();
      if(focus) tabs.find(tab=>tab.dataset.v6Demo===selected)?.focus();
    };
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>select(tab.dataset.v6Demo));
      tab.addEventListener('keydown',event=>{
        const keys=['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'];
        if(!keys.includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
          (index+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+tabs.length)%tabs.length;
        select(tabs[next].dataset.v6Demo,true);
      });
    });
    action.addEventListener('click',()=>{finished=!finished;render();});
    const order=tabs.map(tab=>tab.dataset.v6Demo);
    attachSwipe(panel,direction=>select(order[(order.indexOf(selected)+direction+order.length)%order.length]));
    languageWatch(render);
    render();
  }

  function setupHomeSwipe(){
    const experience=$('[data-v4-experience]');
    if(!experience)return;
    const tabs=$$('[data-v4-app]',experience);
    const panel=$('#v4-panel',experience);
    attachSwipe(panel,direction=>{
      const current=tabs.findIndex(tab=>tab.getAttribute('aria-selected')==='true');
      tabs[(current+direction+tabs.length)%tabs.length]?.click();
    });
  }

  const proof={
    conscience:{name:'Conscience',kind:'iOS & Android',fr:['Suivre pour mieux comprendre.','Un espace pour observer ses habitudes, explorer ses déclencheurs et suivre son évolution à son rythme.','Fiches officielles disponibles sur les deux stores.'],en:['Make sense of your habits.','Observe habits, explore triggers and follow your progress at your own pace.','Official listings on both mobile stores.'],links:[['App Store','https://apps.apple.com/fr/app/conscience-habit-tracker/id6766221828'],['Google Play','https://play.google.com/store/apps/details?id=com.conscience.guillaume.app']]},
    kapsy:{name:'Kapsy',kind:'iOS & Android',fr:['Conserver les moments qui comptent.','Des capsules photographiques pour sceller, suivre et révéler ses souvenirs ou ses évolutions.','Captures réelles, fiches officielles sur iOS et Android.'],en:['Keep the moments that matter.','Photo capsules to preserve, follow and reveal memories and progress.','Real screenshots and official iOS and Android listings.'],links:[['App Store','https://apps.apple.com/us/app/kapsy/id6784803827'],['Google Play','https://play.google.com/store/apps/details?id=com.kapsy.app']]},
    pannego:{name:'PanneGo',kind:'iOS & Android',fr:['Des incidents au suivi terrain.','Déclarer un incident, retrouver une information d’équipement et conserver l’historique des interventions.','Applications disponibles sur iOS et Android.'],en:['From issues to field follow-up.','Report an issue, find equipment information and keep an intervention history.','Apps available on iOS and Android.'],links:[['App Store','https://apps.apple.com/fr/app/pannego/id6780001270'],['Google Play','https://play.google.com/store/apps/details?id=fr.gbostudio.pannego']]},
    pulse:{name:'Pulse',kind:'Webapp · jeu',fr:['Le rush devient un jeu.','Un jeu de gestion de quart où l’on organise une équipe et tente de progresser. Il ne s’agit pas d’une formation.','Jeu accessible directement dans le navigateur.'],en:['Rush hour becomes a game.','A shift-management game about organizing a team and improving your score. Not a training tool.','Play in your browser.'],links:[['Jouer / Play','https://pulse.gbostudio.fr/']]},
    replay:{name:'Replay',kind:'Webapp',fr:['Le débriefing du quart, structuré.','Une webapp pour saisir, partager et suivre les débriefings opérationnels des managers.','Accès direct à la webapp en ligne.'],en:['Structured shift debriefs.','A webapp for recording, sharing and following up managers’ shift debriefs.','Open the live webapp.'],links:[['Ouvrir / Open','https://lateam-debriefs.netlify.app']]}
  };

  function setupProductProof(){
    const page=location.pathname.replace(/^\//,'').replace(/\.html$/,'');
    const data=proof[page];
    const main=$('main.s-shell');
    if(!data || !main || $('[data-v6-proof]',main)) return;
    const anchor=$('.s-gallery-section',main) || $('.s-page-hero',main);
    if(!anchor)return;
    const section=document.createElement('section');
    section.className='v6-proof';section.dataset.v6Proof='';
    section.setAttribute('aria-label', 'Informations vérifiables sur '+data.name);
    section.innerHTML=`<div class="container v6-proof-shell"><div class="v6-proof-copy"><span class="s-overline"><span data-fr>Produit réel, expérience concrète</span><span data-en>Real product, real use</span></span><h2><span data-fr>${data.fr[0]}</span><span data-en>${data.en[0]}</span></h2><p><span data-fr>${data.fr[1]}</span><span data-en>${data.en[1]}</span></p><div class="v6-proof-links">${data.links.map(([label,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join('')}</div></div><div class="v6-proof-meta"><div><span data-fr>Création</span><span data-en>Created by</span><strong>GBO Studio</strong></div><div><span data-fr>Plateforme</span><span data-en>Platform</span><strong>${data.kind}</strong></div><div><span data-fr>À découvrir</span><span data-en>Explore</span><strong><span data-fr>${data.fr[2]}</span><span data-en>${data.en[2]}</span></strong></div></div></div>`;
    anchor.insertAdjacentElement('afterend',section);
  }

  /* Transparent 3D layers: compact, still navigation; hero-only cinematic landing. */
  function setupAnimatedBrand(){
    document.querySelectorAll('link[rel="icon"]').forEach(icon => {
      icon.href='/logo-v7.svg';
      icon.type='image/svg+xml';
    });
    const brandMarkup = `
      <span class="gbo-brand-visual" aria-hidden="true">
        <img class="gbo-brand-lettering" src="/assets/brand/gbo-studio-clean.webp" width="1241" height="772" alt="" decoding="async">
        <span class="gbo-brand-planet-wrap"><img class="gbo-brand-planet" src="/assets/brand/gbo-earth-clean.webp" width="1030" height="1039" alt="" decoding="async"></span>
      </span>`;
    $$('.header a.brand').forEach(link => {
      link.setAttribute('aria-label','GBO Studio, accueil');
      link.classList.remove('gbo-brand-animated');
      link.classList.add('gbo-header-wordmark');
      link.innerHTML = '<span class="gbo-header-mark"><strong>GBO</strong><span>studio</span><i aria-hidden="true"></i></span>';
    });
    $$('.footer a.brand').forEach(link => {
      link.setAttribute('aria-label','GBO Studio, accueil');
      link.classList.add('gbo-brand-animated','gbo-brand-footer');
      link.innerHTML = brandMarkup;
    });
    const heroCopy=$('.s-hero-copy');
    if(heroCopy && !$('.gbo-hero-brand',heroCopy)){
      const heroBrand=document.createElement('div');
      heroBrand.className='gbo-hero-brand';
      heroBrand.setAttribute('aria-hidden','true');
      heroBrand.innerHTML=brandMarkup;
      heroCopy.prepend(heroBrand);
    }
    if(reduced.matches) return;
    try {
      if(!sessionStorage.getItem('gbo-brand-landing-v8')){
        document.documentElement.classList.add('gbo-brand-first-visit');
        sessionStorage.setItem('gbo-brand-landing-v8','1');
      }
    } catch (_) {
      document.documentElement.classList.add('gbo-brand-first-visit');
    }
  }

  setupAnimatedBrand();
  setupPromo();
  setupDemoLab();
  setupHomeSwipe();
  setupProductProof();
})();
