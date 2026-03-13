/**
 * core/db.js — Estado em memória + carregamento do Firestore
 *
 * Exporta o objeto DB (estado global) e funções dbLoad / dbSave.
 *
 * Uso:
 *   import { DB, dbLoad, dbSave } from '../core/db.js';
 */

import {
  db, _colAlunos, _colMensalidades, _colContratos,
  _colTurmas, _colTipos, docPrincipalRef, migracaoFlagRef,
  serverTs, increment
} from '../firebase.js';
import { toast } from './ui.js';

// ─── Estado central em memória ────────────────────────────────────────────────
export const DB = {
  alunos:       [],
  tipos:        [],
  turmas:       [],
  mensalidades: [],
  contratos:    [],
  precadastros: [],
  configStudio: {},
  // Contadores atômicos (lidos do doc principal — não recalculados)
  _totalAlunos:   null,
  _totalAtivos:   null,
  _totalInativos: null,
};

// ─── Cache TTL ────────────────────────────────────────────────────────────────
let _dbCarregado = false;
let _dbCacheTs   = 0;
const DB_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

export function isDbCarregado() { return _dbCarregado; }

// ─── Tipos padrão (seed inicial) ─────────────────────────────────────────────
const TIPOS_DEFAULT = [
  { id: 't0', nome: 'Balé Clássico',   emoji: '🩰', cor: 'var(--accent2)', desc: 'Técnica clássica de ballet.', valor: 180 },
  { id: 't1', nome: 'Jazz',            emoji: '🎷', cor: '#fbbf24',        desc: 'Dança jazz contemporâneo.',  valor: 160 },
  { id: 't2', nome: 'Pilates',         emoji: '🧘', cor: '#34d399',        desc: 'Pilates solo e equipamentos.', valor: 200 },
  { id: 't3', nome: 'Contemporâneo',   emoji: '💃', cor: 'var(--accent)',  desc: 'Dança contemporânea.',       valor: 160 },
  { id: 't4', nome: 'Fit Dance',       emoji: '🕺', cor: '#22d3ee',        desc: 'Dança fitness.',             valor: 140 },
];

// ─── dbLoad ───────────────────────────────────────────────────────────────────

/**
 * Carrega todas as coleções principais em paralelo.
 * Usa cache de 3 min — só faz leitura se cache expirou ou force=true.
 * @param {boolean} force - Ignora cache e força leitura
 */
export async function dbLoad(force = false) {
  const agora = Date.now();
  if (!force && _dbCarregado && (agora - _dbCacheTs) < DB_CACHE_TTL_MS) {
    // Cache válido — só atualiza UI
    _dispatchDbReady();
    return;
  }

  try {
    // Migração automática (roda só uma vez na vida do projeto)
    await _migrarDadosPrincipaisSeNecessario();

    // Leitura paralela das 5 coleções + documento principal
    const [
      snapAlunos, snapMens, snapContr,
      snapTurmas, snapTipos, docPrinc
    ] = await Promise.all([
      _colAlunos.get(),
      _colMensalidades.get(),
      _colContratos.get(),
      _colTurmas.get(),
      _colTipos.get(),
      docPrincipalRef.get(),
    ]);

    DB.alunos       = snapAlunos.docs.map(d => ({ ...d.data(), id: d.id }));
    DB.mensalidades = snapMens.docs.map(d => ({ ...d.data(), id: d.id }));
    DB.contratos    = snapContr.docs.map(d => ({ ...d.data(), id: d.id }));
    DB.turmas       = snapTurmas.docs.map(d => ({ ...d.data(), id: d.id }));
    DB.tipos        = snapTipos.docs.map(d => ({ ...d.data(), id: d.id }));

    const principal      = docPrinc.exists ? docPrinc.data() : {};
    DB.configStudio      = principal.configStudio  || {};
    DB.precadastros      = principal.precadastros  || [];
    if (principal.totalAlunos   !== undefined) DB._totalAlunos   = principal.totalAlunos;
    if (principal.totalAtivos   !== undefined) DB._totalAtivos   = principal.totalAtivos;
    if (principal.totalInativos !== undefined) DB._totalInativos = principal.totalInativos;

    // Seed de tipos se coleção vazia
    if (!DB.tipos.length) {
      const batch = db.batch();
      TIPOS_DEFAULT.forEach(t => batch.set(_colTipos.doc(t.id), t));
      await batch.commit();
      DB.tipos = [...TIPOS_DEFAULT];
    }

    _dbCarregado = true;
    _dbCacheTs   = Date.now();
    _dispatchDbReady();

  } catch (e) {
    console.error('[dbLoad]', e);
    throw e;
  }
}

// ─── dbSave ───────────────────────────────────────────────────────────────────

/**
 * Persiste um item no Firestore.
 * @param {{ entidade: string, item: object }} opcoes
 *
 * Entidades suportadas: alunos, tipos, turmas, mensalidades, contratos
 */
export async function dbSave({ entidade, item }) {
  const colMap = {
    alunos:       _colAlunos,
    tipos:        _colTipos,
    turmas:       _colTurmas,
    mensalidades: _colMensalidades,
    contratos:    _colContratos,
  };

  const col = colMap[entidade];
  if (!col) {
    console.warn(`[dbSave] entidade desconhecida: ${entidade}`);
    return;
  }

  const ts = serverTs();
  if (item.id) {
    await col.doc(item.id).set({ ...item, atualizadoEm: ts }, { merge: true });
  } else {
    const ref = await col.add({ ...item, criadoEm: ts });
    item.id = ref.id;
  }
}

/**
 * Remove um item do Firestore.
 * @param {string} entidade
 * @param {string} id
 */
export async function _dbDeleteItem(entidade, id) {
  const colMap = {
    alunos:       _colAlunos,
    tipos:        _colTipos,
    turmas:       _colTurmas,
    mensalidades: _colMensalidades,
    contratos:    _colContratos,
  };
  const col = colMap[entidade];
  if (!col) return;
  await col.doc(id).delete();
}

// ─── Contadores atômicos ──────────────────────────────────────────────────────

export function onAlunoAtivado()   {
  docPrincipalRef.set({ totalAtivos: increment(1), totalInativos: increment(-1) }, { merge: true }).catch(() => {});
}
export function onAlunoInativado() {
  docPrincipalRef.set({ totalAtivos: increment(-1), totalInativos: increment(1) }, { merge: true }).catch(() => {});
}
export function onAlunoCriado()    {
  docPrincipalRef.set({ totalAlunos: increment(1), totalAtivos: increment(1) }, { merge: true }).catch(() => {});
}
export function onAlunoRemovido(eraAtivo) {
  const delta = { totalAlunos: increment(-1) };
  if (eraAtivo) delta.totalAtivos   = increment(-1);
  else          delta.totalInativos = increment(-1);
  docPrincipalRef.set(delta, { merge: true }).catch(() => {});
}

// ─── Evento interno ───────────────────────────────────────────────────────────

function _dispatchDbReady() {
  window.dispatchEvent(new CustomEvent('gostudio:dbready', { detail: DB }));
}

// ─── Migração automática (roda só uma vez) ────────────────────────────────────

async function _migrarDadosPrincipaisSeNecessario() {
  try {
    const flag = await migracaoFlagRef.get();
    if (flag.exists) return; // já migrou

    const docPrinc = await docPrincipalRef.get();
    if (!docPrinc.exists) {
      // Projeto novo — apenas marca flag
      await migracaoFlagRef.set({ migradoEm: new Date().toISOString(), versao: 2 });
      return;
    }

    const dados = docPrinc.data();
    const batch = db.batch();
    let migrados = 0;

    // Migra alunos[]
    (dados.alunos || []).forEach(a => {
      if (!a.id) return;
      batch.set(_colAlunos.doc(a.id), a, { merge: true });
      migrados++;
    });
    // Migra mensalidades[]
    (dados.mensalidades || []).forEach(m => {
      if (!m.id) return;
      batch.set(_colMensalidades.doc(m.id), m, { merge: true });
    });
    // Migra contratos[]
    (dados.contratos || []).forEach(c => {
      if (!c.id) return;
      batch.set(_colContratos.doc(c.id), c, { merge: true });
    });
    // Migra turmas[]
    (dados.turmas || []).forEach(t => {
      if (!t.id) return;
      batch.set(_colTurmas.doc(t.id), t, { merge: true });
    });
    // Migra tipos[]
    (dados.tipos || []).forEach(t => {
      if (!t.id) return;
      batch.set(_colTipos.doc(t.id), t, { merge: true });
    });

    await batch.commit();
    await migracaoFlagRef.set({
      migradoEm: new Date().toISOString(),
      versao: 2,
      totalMigrados: migrados,
    });

    console.log(`[migração v2] ${migrados} registros migrados para coleções separadas.`);
  } catch (e) {
    console.warn('[migração v2] falhou, continuando com leitura normal:', e.message);
  }
}
