/**
 * core/router.js — Navegação, hash routing e atalhos de teclado
 *
 * Uso:
 *   import { initRouter, navTo } from '../core/router.js';
 *
 *   // No app.js, após login:
 *   initRouter(pageHandlers);
 *   restoreRouteFromHash();
 */

import { temPermissao, _usuarioAtual } from './auth.js';
import { toast } from './ui.js';

// ─── Títulos de página ────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:    'Dashboard',
  alunos:       'Alunos',
  tipos:        'Modalidades',
  turmas:       'Turmas',
  mensalidades: 'Mensalidades',
  devedores:    'Devedores',
  relatorios:   'Relatórios',
  contratos:    'Contratos',
  calendario:   'Calendário',
  prontuario:   'Prontuários',
  catalogo:     'Catálogo',
  estoque:      'Estoque',
  comandas:     'Comandas',
  agenda:       'Agenda',
  usuarios:     'Usuários',
  versoes:      'Versões',
  ti:           'Painel T.I.',
  portal:       'Portal do Aluno',
  mensagens:    'Mensagens',
  planos:       'Planos',
  pagamentos:   'Pagamentos',
};

// ─── Handlers por página ─────────────────────────────────────────────────────
// Preenchidos pelo initRouter com as funções de cada módulo
let _pageHandlers = {};

/**
 * Inicializa o router com os handlers de cada página.
 * @param {Object} handlers - { dashboard: fn, alunos: fn, ... }
 */
export function initRouter(handlers) {
  _pageHandlers = handlers;

  // ── Botão Voltar / Avançar do browser ──
  window.addEventListener('popstate', (e) => {
    const page = e.state?.page || location.hash.slice(1) || 'dashboard';
    if (page) navTo(page, null, true);
  });

  // ── Atalhos de teclado: Alt+1..6 ──
  document.addEventListener('keydown', (e) => {
    if (!_usuarioAtual || !e.altKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const shortcuts = {
      '1': 'dashboard',
      '2': 'alunos',
      '3': 'mensalidades',
      '4': 'agenda',
      '5': 'turmas',
      '6': 'relatorios',
    };
    const page = shortcuts[e.key];
    if (page && temPermissao(page)) {
      e.preventDefault();
      navTo(page, null);
    }
  });

  // ── Ctrl+K / Cmd+K → busca global ──
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (typeof abrirBuscaGlobal === 'function') abrirBuscaGlobal();
    }
  });
}

/**
 * Navega para uma página.
 * @param {string}  page           - ID da página (ex: 'alunos')
 * @param {Element} [el]           - Elemento nav clicado (opcional)
 * @param {boolean} [fromPopstate] - true se veio do botão voltar
 */
export function navTo(page, el, fromPopstate = false) {
  if (_usuarioAtual && !temPermissao(page)) {
    toast('Sem permissão para acessar esta área.', 'err');
    return;
  }

  // Atualiza nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });

  // Atualiza páginas
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.setAttribute('aria-hidden', 'true');
  });

  // Marca nav item ativo
  const navEl = el || document.querySelector(`.nav-item[onclick*="navTo('${page}'"]`);
  if (navEl) {
    navEl.classList.add('active');
    navEl.setAttribute('aria-current', 'page');
  }

  // Mostra página
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) {
    pageEl.classList.add('active');
    pageEl.setAttribute('aria-hidden', 'false');
  }

  // Reset scroll
  const mainEl = document.getElementById('main-content');
  if (mainEl) mainEl.scrollTop = 0;

  // Título do documento
  const title = PAGE_TITLES[page];
  if (title) document.title = title + ' — GoStudio';

  // Sincroniza hash na URL
  if (!fromPopstate) {
    const hash = '#' + page;
    if (location.hash !== hash) {
      history.pushState({ page }, (title || page) + ' — GoStudio', hash);
    }
  }

  // Chama handler da página
  _pageHandlers[page]?.();
}

/**
 * Restaura a rota do hash na URL ao carregar (deep link).
 * Chame após o login estar confirmado.
 */
export function restoreRouteFromHash() {
  const hash = location.hash.slice(1);
  // Ignora hashes especiais (portal, assinar, precadastro)
  const SPECIAL = ['assinar', 'precadastro', 'portal', 'planos-publico'];
  if (hash && !SPECIAL.some(s => hash.startsWith(s))) {
    navTo(hash, null, true);
  } else {
    navTo('dashboard', null, true);
  }
}
