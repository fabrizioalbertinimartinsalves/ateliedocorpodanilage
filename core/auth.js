/**
 * core/auth.js — Autenticação, perfis e permissões
 *
 * Uso:
 *   import { initAuth, _usuarioAtual, temPermissao, logout } from '../core/auth.js';
 */

import { auth, usersRef, db } from '../firebase.js';
import { dbLoad } from './db.js';
import { toast } from './ui.js';

// ─── Estado ───────────────────────────────────────────────────────────────────
export let _usuarioAtual = null;

// ─── Perfis built-in (fallback — sobrescritos pelo Firestore em runtime) ──────
export const PERFIS = {
  admin:       { label: '🛡️ Administrador', perms: ['dashboard','alunos','tipos','turmas','mensalidades','devedores','relatorios','contratos','calendario','portal','prontuario','usuarios','config','versoes','catalogo','estoque','comandas','agenda'] },
  editor:      { label: '✏️ Editor',         perms: ['dashboard','alunos','tipos','turmas','mensalidades','devedores','relatorios','contratos','calendario','portal','prontuario','catalogo','estoque','comandas','agenda'] },
  viewer:      { label: '👁️ Visualizador',   perms: ['dashboard','alunos','turmas','mensalidades','devedores','calendario'] },
  ti:          { label: '🛠️ T.I. / Sistema', perms: ['dashboard','alunos','tipos','turmas','mensalidades','devedores','relatorios','contratos','calendario','portal','prontuario','usuarios','config','versoes','catalogo','estoque','comandas','agenda','ti'] },
  instrutor:   { label: '🎯 Instrutor',      perms: ['dashboard','alunos','turmas','calendario','agenda','prontuario'] },
  financeiro:  { label: '💰 Financeiro',     perms: ['dashboard','mensalidades','devedores','relatorios','contratos'] },
  atendimento: { label: '🎟️ Atendimento',   perms: ['dashboard','alunos','calendario','agenda','catalogo','comandas','portal'] },
  aluno:       { label: '🎓 Aluno',          perms: [] },
  visitante:   { label: '👤 Visitante',      perms: [] },
};

export const TODAS_PERMS = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'alunos',       label: 'Alunos' },
  { id: 'tipos',        label: 'Modalidades' },
  { id: 'turmas',       label: 'Turmas' },
  { id: 'mensalidades', label: 'Mensalidades' },
  { id: 'devedores',    label: 'Devedores' },
  { id: 'relatorios',   label: 'Relatórios' },
  { id: 'contratos',    label: 'Contratos' },
  { id: 'calendario',   label: 'Calendário' },
  { id: 'portal',       label: 'Portal Aluno' },
  { id: 'prontuario',   label: 'Prontuários' },
  { id: 'usuarios',     label: 'Usuários' },
  { id: 'config',       label: 'Configurações' },
  { id: 'catalogo',     label: 'Catálogo' },
  { id: 'estoque',      label: 'Estoque' },
  { id: 'comandas',     label: 'Comandas' },
  { id: 'agenda',       label: 'Agenda' },
  { id: 'ti',           label: 'T.I. / Sistema' },
];

// ─── Perfis dinâmicos (Firestore) ────────────────────────────────────────────
let _perfisConfig = null;

export function getPerfisConfig() { return _perfisConfig || PERFIS; }

export async function carregarPerfisConfig() {
  try {
    const snap = await db.collection('sistema_perfis').get();
    if (!snap.empty) {
      _perfisConfig = {};
      snap.docs.forEach(d => { _perfisConfig[d.id] = d.data(); });
    }
  } catch (e) {
    console.warn('sistema_perfis indisponível — usando built-in:', e.message);
  }
}

// ─── Permissões ───────────────────────────────────────────────────────────────

export function calcularPermissoesEfetivas(usuario) {
  if (!usuario) return [];
  const cfg  = getPerfisConfig();
  const lista = Array.isArray(usuario.perfis) ? usuario.perfis : [usuario.perfil].filter(Boolean);
  if (lista.includes('admin') || lista.includes('ti')) return TODAS_PERMS.map(p => p.id);
  const set = new Set();
  lista.forEach(p => { (cfg[p]?.perms || []).forEach(x => set.add(x)); });
  (usuario.permissoes_extras || usuario.permissoes || []).forEach(x => set.add(x));
  return [...set];
}

export function temPermissao(secao) {
  if (!_usuarioAtual) return false;
  const lista = Array.isArray(_usuarioAtual.perfis) ? _usuarioAtual.perfis : [_usuarioAtual.perfil].filter(Boolean);
  if (lista.includes('admin') || lista.includes('ti')) return true;
  return calcularPermissoesEfetivas(_usuarioAtual).includes(secao);
}

export function getLabelPerfis(usuario) {
  const cfg  = getPerfisConfig();
  const lista = Array.isArray(usuario.perfis) ? usuario.perfis : [usuario.perfil].filter(Boolean);
  return lista.map(p => (cfg[p] || { label: p }).label.replace(/^[^\s]+\s/, '')).join(' + ') || '—';
}

// ─── Login / Logout ──────────────────────────────────────────────────────────

export async function loginEmail(email, senha) {
  return auth.signInWithEmailAndPassword(email, senha);
}

export async function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  return auth.signInWithPopup(provider);
}

export async function logout() {
  await auth.signOut();
  _usuarioAtual = null;
  window.location.reload();
}

// ─── Recuperação de senha ────────────────────────────────────────────────────
export async function enviarResetSenha(email) {
  return auth.sendPasswordResetEmail(email);
}

// ─── onAuthStateChanged principal ────────────────────────────────────────────

/**
 * Inicializa o listener de autenticação.
 * Chame uma única vez no app.js.
 *
 * @param {object} callbacks
 * @param {Function} callbacks.onAdmin    - Usuário admin/editor autenticado
 * @param {Function} callbacks.onAluno    - Usuário com perfil de aluno
 * @param {Function} callbacks.onLogout   - Usuário deslogado
 * @param {Function} callbacks.onBlocked  - Usuário bloqueado
 */
export function initAuth({ onAdmin, onAluno, onLogout, onBlocked }) {
  const PERFIS_ADMIN = ['admin','editor','professor','financeiro','recepcao','ti','gerente','secretaria','instrutor','atendimento','viewer'];

  let _authResolved = false;

  // Timeout de segurança: se Firebase não responder em 8s, mostra login
  const _splashTimeout = setTimeout(() => {
    if (_authResolved) return;
    _authResolved = true;
    _ocultarSplash();
    _mostrarLogin();
    document.getElementById('login-error')?.classList.add('show');
    const el = document.getElementById('login-error');
    if (el) el.textContent = 'Tempo de conexão esgotado. Verifique sua internet.';
  }, 8000);

  // Após 3s sem resposta, mensagem de status
  setTimeout(() => {
    if (_authResolved) return;
    const msg = document.getElementById('splash-msg');
    if (msg) { msg.textContent = 'Verificando conexão...'; msg.style.opacity = '1'; }
  }, 3000);

  auth.onAuthStateChanged(async (user) => {
    clearTimeout(_splashTimeout);
    if (!_authResolved) { _authResolved = true; _ocultarSplash(); }

    if (!user) {
      _mostrarLogin();
      onLogout?.();
      return;
    }

    try {
      const [doc] = await Promise.all([
        usersRef.doc(user.uid).get(),
        carregarPerfisConfig(),
      ]);

      // ── Primeiro usuário do sistema: vira admin ──
      if (!doc.exists) {
        const snap = await usersRef.limit(1).get();
        if (snap.empty) {
          const novo = {
            nome: user.displayName || user.email.split('@')[0],
            email: user.email,
            perfil: 'admin', perfis: ['admin'],
            permissoes: PERFIS.admin.perms,
            ativo: true, bloqueado: false,
            criadoEm: new Date().toISOString(),
          };
          await usersRef.doc(user.uid).set(novo);
          _usuarioAtual = { uid: user.uid, ...novo };
          toast('Bem-vindo! Você é o primeiro administrador.', 'info');
          await _sessaoAdminPronta(onAdmin);
          return;
        }
        // Usuário não cadastrado
        await auth.signOut();
        _mostrarErroLogin('Usuário não cadastrado no sistema.');
        return;
      }

      const dados = doc.data();

      // ── Verificação de bloqueio ──
      const bloqExp   = dados.bloqueioExpiraEm ? new Date(dados.bloqueioExpiraEm) : null;
      const bloqAtivo = dados.bloqueado && (!bloqExp || bloqExp > new Date());
      if (bloqAtivo || dados.ativo === false) {
        await auth.signOut();
        const msg = bloqExp
          ? `Sua conta está suspensa até ${bloqExp.toLocaleDateString('pt-BR')}.`
          : 'Sua conta está bloqueada. Contate o administrador.';
        _mostrarErroLogin(msg);
        onBlocked?.(msg);
        return;
      }

      // Desbloqueio automático por expiração
      if (dados.bloqueado && bloqExp && bloqExp <= new Date()) {
        usersRef.doc(user.uid).update({ bloqueado: false, bloqueioExpiraEm: null }).catch(() => {});
      }

      // Normaliza perfis[] (retrocompatível com perfil:string)
      if (!dados.perfis) dados.perfis = dados.perfil ? [dados.perfil] : ['visitante'];
      dados.permissoes = calcularPermissoesEfetivas({ ...dados, uid: user.uid });
      _usuarioAtual = { uid: user.uid, email: user.email, ...dados };

      // ── Decide destino: portal ou sistema ──
      const temPerfilAdmin = dados.perfis.some(p => PERFIS_ADMIN.includes(p));
      const ehAlunoOuVisitante = !temPerfilAdmin && dados.perfis.every(p => ['aluno', 'visitante'].includes(p));

      if (ehAlunoOuVisitante) {
        let alunoId = dados.alunoId || null;

        // Resolve alunoId pelo hash pendente ou email
        try {
          const pendente = sessionStorage.getItem('_portalPendente') || location.hash;
          if (pendente?.startsWith('#portal=')) {
            const t = JSON.parse(atob(pendente.slice(8)));
            if (t?.id) alunoId = t.id;
          }
        } catch (_) {}
        sessionStorage.removeItem('_portalPendente');

        if (!alunoId && user.email) {
          try {
            const snap = await db.collection('studio_alunos')
              .where('email', '==', user.email).limit(1).get();
            if (!snap.empty) alunoId = snap.docs[0].id;
          } catch (_) {}
        }

        if (alunoId && !dados.alunoId) {
          usersRef.doc(user.uid).update({ alunoId }).catch(() => {});
        }

        onAluno?.({ usuario: _usuarioAtual, alunoId });
        return;
      }

      await _sessaoAdminPronta(onAdmin);

    } catch (e) {
      console.error('[auth] erro ao carregar perfil:', e);
      const isNetwork = e.code === 'unavailable' || e.code === 'failed-precondition' || e.message?.includes('network');
      _mostrarErroLogin(isNetwork
        ? 'Erro de conexão. Verifique sua internet.'
        : 'Erro ao carregar seu perfil. Tente novamente.');
    }
  });
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function _sessaoAdminPronta(callback) {
  await dbLoad(true);
  document.getElementById('tela-login')?.setAttribute('style', 'display:none');
  // Remove style inline — deixa CSS decidir (flex desktop, block mobile)
  const wrapper = document.querySelector('.wrapper');
  if (wrapper) wrapper.removeAttribute('style');
  // Atualiza timestamp do último acesso
  if (_usuarioAtual?.uid) {
    usersRef.doc(_usuarioAtual.uid)
      .update({ ultimoAcesso: new Date().toISOString() })
      .catch(() => {});
  }
  callback?.(_usuarioAtual);
}

function _ocultarSplash() {
  document.getElementById('tela-splash')?.setAttribute('style', 'display:none');
}

function _mostrarLogin() {
  document.getElementById('tela-login')?.setAttribute('style', 'display:flex');
  document.querySelector('.wrapper')?.setAttribute('style', 'display:none');
}

function _mostrarErroLogin(msg) {
  _mostrarLogin();
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export async function auditLog(modulo, acao, dados = {}, valorAnterior = null) {
  try {
    if (!_usuarioAtual) return;
    await db.collection('sistema_config_log').add({
      modulo, acao,
      dados:          JSON.stringify(dados).slice(0, 500),
      valorAnterior:  valorAnterior ? JSON.stringify(valorAnterior).slice(0, 500) : null,
      uid:            _usuarioAtual.uid || '',
      nomeUsuario:    _usuarioAtual.nome || _usuarioAtual.email || 'Desconhecido',
      timestamp:      firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.warn('auditLog:', e.message); }
}
