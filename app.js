(function(){
 const root=document.documentElement;
 function setLang(v){v=v==='en'?'en':'fr';root.setAttribute('data-lang',v);root.setAttribute('lang',v);try{localStorage.setItem('gbo_lang',v)}catch(e){};document.querySelectorAll('[data-lang-btn]').forEach(b=>b.classList.toggle('active',b.dataset.langBtn===v));}
 function setTheme(v){v=['light','dark','auto'].includes(v)?v:'auto';root.setAttribute('data-theme',v);try{localStorage.setItem('gbo_theme',v)}catch(e){};document.querySelectorAll('[data-theme-btn]').forEach(b=>b.classList.toggle('active',b.dataset.themeBtn===v));}
 let l='fr',t='auto';try{l=localStorage.getItem('gbo_lang')||'fr';t=localStorage.getItem('gbo_theme')||'auto'}catch(e){}
 setLang(l);setTheme(t);
 document.addEventListener('click',e=>{let lb=e.target.closest('[data-lang-btn]');if(lb)setLang(lb.dataset.langBtn);let tb=e.target.closest('[data-theme-btn]');if(tb)setTheme(tb.dataset.themeBtn);});
})();
