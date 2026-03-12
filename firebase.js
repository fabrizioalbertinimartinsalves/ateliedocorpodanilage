/**
 * firebase.js — Inicialização e referências do Firestore
 *
 * IMPORTANTE: este arquivo usa Firebase Compat (v10) porque o HTML
 * já carrega os scripts compat via <script src="...firebase-app-compat.js">.
 * Não usar import do módulo SDK aqui — não precisa de build tool.
 *
 * Uso nos outros módulos:
 *   import { db, auth, usersRef, _colAlunos } from '../firebase.js';
 */

// ─── Configuração ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBs526-tIp5GuY-F70zLPjCXz_kSTpc_uc",
  authDomain:        "atelie-9df54.firebaseapp.com",
  projectId:         "atelie-9df54",
  storageBucket:     "atelie-9df54.appspot.com",
  messagingSenderId: "892080455166",
  appId:             "1:892080455166:web:6cd4c3bb1a61c712da54af"
};

// Garante inicialização única
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ─── Instâncias principais ───────────────────────────────────────────────────
export const db      = firebase.firestore();
export const auth    = firebase.auth();
export const storage = firebase.storage();

// Persistência de sessão local (sobrevive a fechar o browser)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// ─── Timestamp / Increment helpers ──────────────────────────────────────────
export const serverTs  = () => firebase.firestore.FieldValue.serverTimestamp();
export const increment = (n) => firebase.firestore.FieldValue.increment(n);

// ─── Coleções: novo modelo (uma por entidade) ────────────────────────────────
export const _colAlunos       = db.collection('studio_alunos');
export const _colMensalidades = db.collection('studio_mensalidades');
export const _colContratos    = db.collection('studio_contratos');
export const _colTurmas       = db.collection('studio_turmas');
export const _colTipos        = db.collection('studio_tipos');

// ─── Coleções: módulos operacionais ─────────────────────────────────────────
export const catalogoRef    = db.collection('catalogo');
export const estoqueRef     = db.collection('estoque');
export const estMovRef      = db.collection('estoque_movimentos');
export const comandasRef    = db.collection('comandas');
export const agendRef       = db.collection('agendamentos');
export const agendConfigRef = db.collection('agenda_config').doc('studio_config');
export const expBookRef     = () => db.collection('agendamentos_experimentais');

// ─── Coleções: sistema ────────────────────────────────────────────────────────
export const usersRef          = db.collection('studiogest_users');
export const sistemaConfigRef  = db.collection('sistema_config').doc('config_tecnica');
export const labelsRef         = db.collection('sistema_config').doc('labels');
export const iconesRef         = db.collection('sistema_config').doc('icones');
export const configGeralRef    = db.collection('sistema_config').doc('config_geral');
export const configLogRef      = db.collection('sistema_config_log');
export const logManutRef       = db.collection('log_manutencao');
export const perfisRef         = db.collection('sistema_perfis');
export const pagamentosRef     = db.collection('pagamentos_portal');
export const precadRef         = db.collection('studiogest_precadastros');
export const versoesRef        = db.collection('studiogest_versoes');
export const prontuariosColRef = db.collection('prontuarios');

// ─── Documento legado (mantido só para configStudio e contadores) ─────────────
export const docPrincipalRef   = db.collection('studiogest').doc('dados_principais');
export const migracaoFlagRef   = db.collection('studiogest').doc('migracao_v2_flag');

// ─── Camada de acesso genérica (_db) ─────────────────────────────────────────
// Uso: await _db.get('studio_alunos', id)
//      await _db.save('studio_alunos', { nome: 'Ana', ... })
//      await _db.query('estoque', q => q.orderBy('nome'))
export const _db = {
  _ref: (col) => db.collection(col),

  async get(col, id) {
    const doc = await this._ref(col).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async save(col, obj, merge = true) {
    const ts = serverTs();
    if (obj.id) {
      await this._ref(col).doc(obj.id).set({ ...obj, atualizadoEm: ts }, { merge });
      return obj.id;
    } else {
      const ref = await this._ref(col).add({ ...obj, criadoEm: ts });
      return ref.id;
    }
  },

  async update(col, id, data) {
    await this._ref(col).doc(id).update({ ...data, atualizadoEm: serverTs() });
  },

  async delete(col, id) {
    await this._ref(col).doc(id).delete();
  },

  async query(col, buildQuery) {
    const snap = await buildQuery(this._ref(col)).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async list(col, limit = 500) {
    const snap = await this._ref(col).limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async runTransaction(fn) {
    return db.runTransaction(fn);
  }
};
