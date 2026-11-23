/* THE UNREAL MUSEUM — menu mobile accessible de la page d’entrée (proposition 2026-11-10).
   Fichier externe (compatible avec une CSP sans script inline). */
(function(){
  'use strict';
  var burger=document.querySelector('.um-burger');
  var menu=document.getElementById('um-menu');
  if(!burger||!menu)return;
  var label=burger.querySelector('.um-burger-label');
  var lastFocus=null;
  function focusables(){
    return Array.prototype.slice.call(menu.querySelectorAll('a[href],button:not([disabled])'));
  }
  function open(){
    lastFocus=document.activeElement;
    menu.hidden=false;
    burger.setAttribute('aria-expanded','true');
    if(label)label.textContent='Fermer';
    document.documentElement.classList.add('um-menu-open');
    var f=focusables();if(f[0])f[0].focus();
  }
  function close(restore){
    if(menu.hidden)return;
    menu.hidden=true;
    burger.setAttribute('aria-expanded','false');
    if(label)label.textContent='Menu';
    document.documentElement.classList.remove('um-menu-open');
    if(restore!==false&&lastFocus&&lastFocus.focus)lastFocus.focus();
  }
  burger.addEventListener('click',function(){menu.hidden?open():close();});
  menu.addEventListener('click',function(e){
    var t=e.target.closest('a,button');
    if(t)close(false);
  });
  document.addEventListener('keydown',function(e){
    if(menu.hidden)return;
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Tab'){
      var f=focusables().concat([burger]);
      var i=f.indexOf(document.activeElement);
      if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus();}
      else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}
    }
  });
  var mq=window.matchMedia('(min-width: 900px)');
  var onChange=function(){if(mq.matches)close(false);};
  if(mq.addEventListener)mq.addEventListener('change',onChange);else if(mq.addListener)mq.addListener(onChange);
})();
