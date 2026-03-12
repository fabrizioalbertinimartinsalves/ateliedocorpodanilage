/**
 * app.js — Ponto de entrada do GoStudio
 *
 * Este arquivo é carregado como <script type="module"> no index.html.
 * Ele conecta todos os módulos sem criar dependências entre eles.
 *
 * Ordem de boot:
 *  1. Checa hashes públicos (assinatura, pré-cadastro)
 *  2. Inicia auth listener
 *  3. Após login: inicializa router + módulos
 *  4. Restaura rota do hash
 */

import { initAuth, _usuarioAtual, logout }     from './core/auth.js';
import { initRouter, navTo, restoreRouteFromHash } from './core/router.js';
import { initModalOverlays, toast }              from './core/ui.js';
import { DB, dbLoad }                            from './core/db.js';

// ─── Hashes públicos (não precisam de login) ──────────────────────────────────
const _hash = location.hash;
const _isPublico = _hash.startsWith('#assinar=') || _hash.startsWith('#precadastro=');
const _isPortal  = _hash.startsWith('#portal=');

if (_isPortal) {
  // Salva hash para restaurar após login
  sessionStorage.setItem('_portalPendente', _hash);
}

// ─── Inicializa overlays de modais ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initModalOverlays();
  _preencherDataHoje();

  if (_isPublico) {
    // Links públicos: carrega dados sem login
    document.getElementById('tela-splash')?.setAttribute('style', 'display:none');
    dbLoad().then(() => {
      if (typeof checkAssinaturaHash   === 'function') checkAssinaturaHash();
      if (typeof checkPrecadastroHash  === 'function') checkPrecadastroHash();
    });
    return;
  }

  // ── Inicia auth ──────────────────────────────────────────────────────────
  initAuth({
    onAdmin: async (usuario) => {
      // Mostra a interface imediatamente — não bloqueia no carregamento de configs
      _atualizarSidebarUsuario(usuario);
      _inicializarRouter();
      restoreRouteFromHash();
      _inicializarPWA();

      // Configs secundárias carregam em paralelo sem travar o boot
      Promise.allSettled([
        _inicializarConfigsTI(),
        _carregarPrecadastros(),
      ]);
    },

    onAluno: ({ usuario, alunoId }) => {
      // Redireciona para portal do aluno
      if (typeof mostrarPortalAluno === 'function') {
        mostrarPortalAluno(alunoId);
      }
    },

    onLogout: () => {
      document.querySelector('.wrapper')?.setAttribute('style', 'display:none');
    },

    onBlocked: (msg) => {
      console.warn('[auth] usuário bloqueado:', msg);
    },
  });
});

// ─── Router: mapeia páginas → funções de render ───────────────────────────────
function _inicializarRouter() {
  // As funções de render ficam no escopo global (definidas nos módulos)
  // enquanto a migração está em andamento. Após migrar um módulo, pode
  // substituir a referência global por um import dinâmico.
  const handlers = {
    dashboard:    () => { if (typeof renderDash          === 'function') renderDash(); },
    alunos:       () => { if (typeof populateAlunoFilters=== 'function') populateAlunoFilters();
                          if (typeof renderAlunos        === 'function') renderAlunos(); },
    tipos:        () => { if (typeof renderTipos         === 'function') renderTipos(); },
    turmas:       () => { if (typeof renderTurmas        === 'function') renderTurmas(); },
    mensalidades: () => { if (typeof populateMesFilter   === 'function') populateMesFilter();
                          if (typeof renderMensalidades  === 'function') renderMensalidades(); },
    devedores:    () => { if (typeof populateDevFiltros  === 'function') populateDevFiltros();
                          if (typeof renderDevedores     === 'function') renderDevedores(); },
    relatorios:   () => { if (typeof populateRelAno      === 'function') populateRelAno();
                          if (typeof renderRelatorios    === 'function') renderRelatorios(); },
    contratos:    () => { if (typeof carregarConfigStudio=== 'function') carregarConfigStudio();
                          if (typeof renderContratos     === 'function') renderContratos(); },
    calendario:   () => { if (typeof populateCalFiltros  === 'function') populateCalFiltros();
                          if (typeof renderCalendario    === 'function') renderCalendario(); },
    portal:       () => { if (typeof populatePortalAlunos=== 'function') populatePortalAlunos(); },
    usuarios:     () => { if (typeof renderUsuarios      === 'function') renderUsuarios(); },
    versoes:      () => { if (typeof renderVersoes       === 'function') renderVersoes(); },
    prontuario:   () => { if (typeof initProntuarios     === 'function') initProntuarios();
                          if (typeof renderProntuarios   === 'function') renderProntuarios(); },
    catalogo:     async () => {
      if (typeof _carregarCatalogo === 'function') await _carregarCatalogo();
      if (typeof _carregarEstoque  === 'function') await _carregarEstoque();
      if (typeof renderCatalogo    === 'function') renderCatalogo();
    },
    estoque:      async () => {
      if (typeof _carregarEstoque  === 'function') await _carregarEstoque();
      if (typeof _carregarCatalogo === 'function') await _carregarCatalogo();
      if (typeof renderEstoque     === 'function') renderEstoque();
    },
    comandas:     async () => {
      if (typeof _carregarComandas === 'function') await _carregarComandas();
      if (typeof _carregarCatalogo === 'function') await _carregarCatalogo();
      if (typeof renderComandas    === 'function') renderComandas();
    },
    agenda:       () => { if (typeof irAgendaHoje === 'function') irAgendaHoje();
                          if (typeof renderAgenda  === 'function') renderAgenda(); },
    ti:           () => { if (typeof carregarConfigSistema==='function') carregarConfigSistema();
                          if (typeof tiCarregarLabels     ==='function') tiCarregarLabels(); },
    mensagens:    () => { if (typeof carregarTemplates === 'function') {
                            carregarTemplates().then(() => {
                              const sel = document.getElementById('msg-aniv-mes');
                              if (sel) sel.value = new Date().getMonth();
                              if (typeof renderMsgAniversariantes === 'function') renderMsgAniversariantes();
                            });
                          }},
    planos:       () => { if (typeof planosCarregar     === 'function') planosCarregar(); },
    pagamentos:   () => { if (typeof pagCarregarHistorico==='function') pagCarregarHistorico(); },
  };

  initRouter(handlers);

  // Expõe navTo globalmente (usada nos onclick do HTML enquanto migração ocorre)
  window.navTo = navTo;
}

// ─── Sidebar: exibe nome e avatar do usuário ─────────────────────────────────
function _atualizarSidebarUsuario(usuario) {
  if (!usuario) return;
  const nome  = usuario.nome || usuario.email || '—';
  const inits = nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  document.querySelectorAll('.sp-name').forEach(el => el.textContent = nome);
  document.querySelectorAll('.sp-email').forEach(el => el.textContent = usuario.email || '');
  document.querySelectorAll('.sp-avatar').forEach(el => {
    if (usuario.fotoUrl) {
      el.innerHTML = `<img src="${usuario.fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      el.textContent = inits;
    }
  });
}

// ─── Data de hoje no header ───────────────────────────────────────────────────
function _preencherDataHoje() {
  const el = document.getElementById('today-date');
  if (el) {
    el.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

// ─── Configs TI ──────────────────────────────────────────────────────────────
async function _inicializarConfigsTI() {
  if (typeof inicializarConfigsTI === 'function') {
    await inicializarConfigsTI();
  }
}

// ─── Pré-cadastros ────────────────────────────────────────────────────────────
async function _carregarPrecadastros() {
  if (typeof carregarPrecadastros === 'function') {
    await carregarPrecadastros();
  }
}

// ─── PWA ─────────────────────────────────────────────────────────────────────
function _inicializarPWA() {
  if (typeof initPWA === 'function') initPWA();
}

// ─── Logout global ───────────────────────────────────────────────────────────
window.fazerLogout = logout;
