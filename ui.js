/**
 * core/ui.js — Toast, Modais e helpers de UI
 *
 * Uso:
 *   import { toast, abrirModal, fecharModal, fieldError, clearFieldErrors } from '../core/ui.js';
 */

// ─── Toast ────────────────────────────────────────────────────────────────────

let _toastTimer;

/**
 * Exibe notificação temporária.
 * @param {string} msg  - Mensagem a exibir
 * @param {'ok'|'err'|'info'} type - Tipo visual
 */
export function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  if (!t) return;
  const icon = type === 'ok' ? '✅ ' : type === 'err' ? '❌ ' : 'ℹ️ ';
  t.textContent = icon + msg;
  t.className = `toast show toast-${type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'info'}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

/**
 * Toast com botão "Desfazer".
 * @param {string} msg
 * @param {Function} onUndo - Callback ao clicar em Desfazer
 * @param {number} duration - Duração em ms (padrão 5000)
 */
export function toastUndo(msg, onUndo, duration = 5000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = `<span>${msg}</span>
    <button onclick="(${onUndo.toString()})()" style="
      margin-left:12px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);
      color:#fff;border-radius:6px;padding:3px 10px;font-size:.78rem;cursor:pointer;font-family:inherit;">
      ↩ Desfazer
    </button>`;
  t.className = 'toast show toast-ok';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.classList.remove('show');
    t.innerHTML = '';
  }, duration);
}

// ─── Modais ───────────────────────────────────────────────────────────────────

/** Abre um modal pelo id */
export function abrirModal(id) {
  document.getElementById(id)?.classList.add('open');
}

/** Fecha um modal pelo id */
export function fecharModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/** Inicializa fechamento de modais ao clicar no overlay */
export function initModalOverlays() {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });
}

// ─── Field errors inline ──────────────────────────────────────────────────────

/**
 * Exibe erro em um campo do formulário.
 * @param {string} fieldId - ID do input
 * @param {string} msg     - Mensagem de erro
 */
export function fieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('input-err');
  let errEl = el.parentNode.querySelector('.field-error');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'field-error';
    el.parentNode.appendChild(errEl);
  }
  errEl.textContent = msg;
  errEl.classList.add('show');
}

/** Limpa todos os erros de campo dentro de um modal/form */
export function clearFieldErrors(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.field-error').forEach(e => {
    e.classList.remove('show');
    e.textContent = '';
  });
  container.querySelectorAll('.input-err').forEach(e => {
    e.classList.remove('input-err');
  });
}

// ─── Botão com estado de loading ─────────────────────────────────────────────

/**
 * Coloca um botão em estado de carregamento.
 * @param {string|HTMLElement} btn - ID ou elemento
 * @param {string} [loadingText]   - Texto opcional durante carregamento
 * @returns {Function} Chame o retorno para restaurar o botão.
 */
export function btnLoading(btn, loadingText) {
  const el = typeof btn === 'string' ? document.getElementById(btn) : btn;
  if (!el) return () => {};
  const original = el.textContent;
  el.disabled = true;
  el.setAttribute('data-loading', '1');
  if (loadingText) el.textContent = loadingText;
  return () => {
    el.disabled = false;
    el.removeAttribute('data-loading');
    el.textContent = original;
  };
}

// ─── Máscaras de input no modal ───────────────────────────────────────────────

/**
 * Aplica máscaras em inputs com [data-mask] dentro de um modal.
 * Chame após abrir o modal.
 */
import { maskTelefone, maskCPF, maskCNPJ } from './utils.js';

export function initModalMasks(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.querySelectorAll('input[data-mask]').forEach(input => {
    input.addEventListener('input', function() {
      const mask = this.getAttribute('data-mask');
      if (mask === 'tel')  this.value = maskTelefone(this.value);
      if (mask === 'cpf')  this.value = maskCPF(this.value);
      if (mask === 'cnpj') this.value = maskCNPJ(this.value);
    });
  });
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

/**
 * Gera HTML de linhas skeleton para tabelas/listas durante carregamento.
 * @param {number} rows    - Quantidade de linhas
 * @param {number} cols    - Quantidade de colunas
 */
export function skeletonTable(rows = 5, cols = 4) {
  const sizes = ['30%', '45%', '20%', '15%', '25%', '35%'];
  let html = '';
  for (let r = 0; r < rows; r++) {
    html += '<div class="skeleton-row">';
    for (let c = 0; c < cols; c++) {
      html += `<div class="skeleton skeleton-cell" style="flex:1;max-width:${sizes[(r + c) % sizes.length]};"></div>`;
    }
    html += '</div>';
  }
  return html;
}
