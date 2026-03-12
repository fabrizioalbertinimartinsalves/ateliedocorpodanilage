/**
 * core/utils.js — Funções utilitárias puras
 *
 * SEM dependências externas. Todas são testáveis isoladamente.
 * Importar onde necessário:
 *   import { fmtR, esc, hoje, calcIdade } from '../core/utils.js';
 */

// ─── Formatação ──────────────────────────────────────────────────────────────

/** Formata valor monetário: 1500 → "R$ 1.500,00" */
export function fmtR(v) {
  return 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

/** Formata data ISO para BR: "2025-03-15" → "15/03/2025" */
export function fmtD(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const p = iso.split('-');
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

/** Formata forma de pagamento com cor e ícone */
export function fmtFormaPgto(f) {
  const map = {
    pix:          '<span style="color:#00b08c;font-weight:600;">📲 Pix</span>',
    dinheiro:     '<span style="color:var(--green);">💵 Dinheiro</span>',
    cartao:       '<span style="color:var(--accent);">💳 Cartão</span>',
    cartao_cred:  '<span style="color:var(--accent);">💳 Crédito</span>',
    cartao_deb:   '<span style="color:var(--cyan);">💳 Débito</span>',
    transferencia:'<span style="color:var(--cyan);">🏦 Transf.</span>',
    stripe:       '<span style="color:var(--accent);">💳 Stripe</span>',
  };
  return map[f] || '<span style="color:var(--muted);">—</span>';
}

/** Capitaliza primeira letra */
export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ─── Data e Tempo ─────────────────────────────────────────────────────────────

/** Data de hoje no formato ISO: "2025-03-15" */
export function hoje() {
  return new Date().toISOString().slice(0, 10);
}

/** Converte string ISO para Date */
export function toDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Calcula idade em anos completos a partir de data ISO */
export function calcIdade(dataNasc) {
  if (!dataNasc) return null;
  const hj = new Date();
  const nasc = new Date(dataNasc + 'T00:00:00');
  let idade = hj.getFullYear() - nasc.getFullYear();
  const m = hj.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hj.getDate() < nasc.getDate())) idade--;
  return idade;
}

/** Verifica se a data ISO é aniversário hoje */
export function ehAniversarioHoje(dataNasc) {
  if (!dataNasc) return false;
  const hj = new Date();
  const nasc = new Date(dataNasc + 'T00:00:00');
  return nasc.getDate() === hj.getDate() && nasc.getMonth() === hj.getMonth();
}

/** Dias que faltam para o próximo aniversário (0 = hoje) */
export function diasParaAniversario(dataNasc) {
  if (!dataNasc) return 999;
  const hj = new Date();
  const nasc = new Date(dataNasc + 'T00:00:00');
  const proxAniv = new Date(hj.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (proxAniv < hj) proxAniv.setFullYear(hj.getFullYear() + 1);
  return Math.round((proxAniv - hj) / (1000 * 60 * 60 * 24));
}

/** Calcula data de vencimento ISO para um aluno em determinado mês */
export function vencISO(aluno, refDate) {
  const dia = parseInt(aluno.vencimento) || 10;
  const ref = refDate || new Date();
  const maxDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const d = new Date(ref.getFullYear(), ref.getMonth(), Math.min(dia, maxDia));
  return d.toISOString().slice(0, 10);
}

/** Dias de atraso dado um vencimento ISO (0 se não venceu) */
export function diasAtraso(vencIso) {
  if (!vencIso) return 0;
  return Math.max(0, Math.floor((new Date() - toDate(vencIso)) / 86400000));
}

/** Label de vencimento com cor */
export function vencLabel(vencIso) {
  if (!vencIso) return { txt: 'Não definido', sty: 'color:var(--muted)' };
  const d = diasAtraso(vencIso);
  if (d > 0)  return { txt: `Dia ${vencIso.slice(8, 10)} (${d}d atraso)`,    sty: 'color:var(--red);font-weight:700' };
  if (d > -6) return { txt: `Dia ${vencIso.slice(8, 10)} (vence em ${-d}d)`, sty: 'color:var(--amber)' };
  return { txt: `Dia ${vencIso.slice(8, 10)}`, sty: 'color:var(--muted)' };
}

// ─── Segurança / DOM ──────────────────────────────────────────────────────────

/** Escapa HTML para prevenção de XSS */
export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ─── localStorage seguro (iOS Safari modo privado lança exceção) ─────────────

export function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : fallback;
  } catch { return fallback; }
}

export function lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); return true; }
  catch { return false; }
}

// ─── Máscaras de input ────────────────────────────────────────────────────────

export function maskTelefone(v) {
  v = v.replace(/\D/g, '');
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

export function maskCPF(v) {
  return v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
}

export function maskCNPJ(v) {
  return v.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
}

// ─── Validadores ──────────────────────────────────────────────────────────────

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let r = 11 - (s % 11); if (r >= 10) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  r = 11 - (s % 11); if (r >= 10) r = 0;
  return r === parseInt(cpf[10]);
}

export function validarTelefone(tel) {
  return tel.replace(/\D/g, '').length >= 10;
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

/**
 * Calcula juros e multa para uma mensalidade vencida.
 * @param {number} valor - Valor original da mensalidade
 * @param {string} vencimento - Data de vencimento no formato ISO (YYYY-MM-DD)
 * @param {object} configStudio - Config com jurosMensalPct e multaPct
 */
export function calcJurosMulta(valor, vencimento, configStudio = {}) {
  if (!vencimento) return { atualizado: valor, juros: 0, multa: 0, diasAtraso: 0 };
  const hj   = new Date();
  const venc = new Date(vencimento + 'T00:00:00');
  const dias = Math.max(0, Math.floor((hj - venc) / 86400000));
  if (dias <= 0) return { atualizado: valor, juros: 0, multa: 0, diasAtraso: 0 };
  const jurosMensal = parseFloat(configStudio.jurosMensalPct || 0);
  const multaPct    = parseFloat(configStudio.multaPct    || 0);
  const multa  = valor * (multaPct / 100);
  const juros  = valor * ((jurosMensal / 30) / 100) * dias;
  return {
    atualizado: Math.round((valor + multa + juros) * 100) / 100,
    juros:  Math.round(juros * 100) / 100,
    multa:  Math.round(multa * 100) / 100,
    diasAtraso: dias
  };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** Dispara download de string CSV */
export function baixarCSV(csv, nome) {
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = nome + '_' + hoje() + '.csv';
  a.click();
}

// ─── Cor por nível de dor ─────────────────────────────────────────────────────

export function corNivel(n) {
  if (!n && n !== 0) return 'var(--muted)';
  if (n <= 2) return '#fbbf24';
  if (n <= 4) return '#fb923c';
  if (n <= 6) return '#f97316';
  if (n <= 8) return '#ef4444';
  return '#dc2626';
}

// ─── ID gerador simples ───────────────────────────────────────────────────────

/** Gera um ID aleatório curto (para uso offline / antes de persistir) */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
