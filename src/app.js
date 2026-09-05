/* 应用路由与页面装配：hash 路由分发、级别切换控件状态 */

import { UI } from './ui.js';
import { store } from './store.js';
import { currentLevel, loadLevelData } from './data.js';
import { Vocab } from './vocabulary.js';
import { Grammar, Mistakes } from './grammar.js';
import { Conjugate } from './conjugate.js';
import { dashboard, settingsPage } from './views.js';

let ready = false;

export function render() {
  const hash = location.hash || '#/';
  const view = document.getElementById('view');
  view.innerHTML = '';
  const cur = navActive(hash);
  document.querySelectorAll('#nav a').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-route') === cur);
  });
  document.querySelectorAll('#tabbar a').forEach(function (a) {
    const r = a.getAttribute('data-route');
    a.classList.toggle('active', r === cur || (cur === '/mistakes' && r === '/settings'));
  });

  let m;
  if (hash === '#/' || hash === '') view.appendChild(dashboard());
  else if (hash === '#/vocab') view.appendChild(Vocab.themesPage());
  else if (hash === '#/learn') view.appendChild(Vocab.learnSession());
  else if (hash === '#/review') view.appendChild(Vocab.reviewSession());
  else if (hash === '#/review-mistakes') view.appendChild(Vocab.reviewSession(true));
  else if ((m = hash.match(/^#\/theme\/([\w-]+)$/))) view.appendChild(Vocab.learnSession(m[1]));
  else if (hash === '#/grammar') view.appendChild(Grammar.listPage());
  else if (hash === '#/review-grammar') view.appendChild(Grammar.reviewPage());
  else if ((m = hash.match(/^#\/topic\/([\w-]+)$/))) view.appendChild(Grammar.topicPage(m[1]));
  else if (hash === '#/conjugate') view.appendChild(Conjugate.page());
  else if (hash === '#/mistakes') view.appendChild(Mistakes.page());
  else if (hash === '#/settings') view.appendChild(settingsPage());
  else view.appendChild(dashboard());
  view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in');
  window.scrollTo(0, 0);
}

export function navActive(hash) {
  if (hash === '#/review-grammar' || hash.indexOf('#/grammar') === 0 || hash.indexOf('#/topic') === 0) return '/grammar';
  if (hash.indexOf('#/vocab') === 0 || hash.indexOf('#/learn') === 0 || hash.indexOf('#/review') === 0 || hash.indexOf('#/theme') === 0) return '/vocab';
  if (hash.indexOf('#/conjugate') === 0) return '/conjugate';
  if (hash.indexOf('#/mistakes') === 0) return '/mistakes';
  if (hash.indexOf('#/settings') === 0) return '/settings';
  return '/';
}

function paintLevelSwitch() {
  const cur = currentLevel();
  document.querySelectorAll('#levelSwitch button').forEach(function (b) {
    const on = b.getAttribute('data-level') === cur;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setupLevelSwitch() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('#levelSwitch button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!ready) return;
      const level = b.getAttribute('data-level');
      const cur = currentLevel();
      if (level === cur) return;
      const buttons = document.querySelectorAll('#levelSwitch button');
      buttons.forEach(function (btn) { btn.disabled = true; });
      const loading = UI.el('div', 'card', '<p>正在加载 ' + level + ' 数据...</p>');
      const view = document.getElementById('view');
      if (view) { view.innerHTML = ''; view.appendChild(loading); }
      loadLevelData(level).then(function () {
        store.state.settings.level = level;
        store.save();
        paintLevelSwitch();
        render();
      }).catch(function (e) {
        console.error(e);
        if (view) view.innerHTML = '<div class="card"><p>加载 ' + level + ' 数据失败，请检查网络后重试。</p></div>';
      }).finally(function () {
        buttons.forEach(function (btn) { btn.disabled = false; });
      });
    });
  });
  paintLevelSwitch();
}

setupLevelSwitch();

export function setReady(value) {
  ready = value;
}
