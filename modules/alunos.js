/**
 * modules/alunos.js
 *
 * Funções: renderAlunos, abrirModalAluno, salvarAluno, deletarAluno,
 *           exportarAlunos, populateAlunoFilters, toggleAlunoExpand,
 *           gerarMensalidadeMes
 *
 * Dependências: DB (core/db), toast/toastUndo/fieldError (core/ui),
 *               fmtR/esc/hoje/calcIdade/... (core/utils), dbSave/_dbDeleteItem (core/db)
 */

import { DB, dbSave, _dbDeleteItem, onAlunoCriado, onAlunoRemovido } from '../core/db.js';
import { toast, toastUndo, abrirModal, fecharModal, fieldError, clearFieldErrors } from '../core/ui.js';
import { fmtR, esc, hoje, fmtD, cap, uid, calcIdade, ehAniversarioHoje,
         diasParaAniversario, vencISO, vencLabel, diasAtraso,
         validarEmail, validarCPF, validarTelefone, baixarCSV } from '../core/utils.js';
import { auditLog } from '../core/auth.js';

// Estado local do módulo
let _turmasBuf = [];
let _sortState  = {};

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function renderAlunos() {
  const busca = document.getElementById('search-alunos').value.toLowerCase();
  const fS    = document.getElementById('filter-aluno-status').value;
  const fT    = document.getElementById('filter-aluno-turma').value;
  const fTipo = (document.getElementById('filter-aluno-tipo') || {}).value || '';

  let lista = DB.alunos.filter(a => {
    const bOk   = a.nome.toLowerCase().includes(busca)
                || (a.cpf   || '').includes(busca)
                || (a.email || '').toLowerCase().includes(busca)
                || (a.tel   || '').includes(busca);
    const tids  = a.turmaIds || (a.turmaId ? [a.turmaId] : []);
    const tipoOk = !fTipo || tids.some(tid => {
      const t = DB.turmas.find(x => x.id === tid);
      return t && t.tipoId === fTipo;
    });
    return bOk && (!fS || a.status === fS) && (!fT || tids.includes(fT)) && tipoOk;
  });

  document.getElementById('alunos-count-badge').textContent = lista.length;

  const tbody = document.getElementById('tbody-alunos');
  if (!lista.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">📭 Nenhum aluno.</td></tr>';
    return;
  }

  const sCls = { ativo: 'badge-green', inativo: 'badge-red', pendente: 'badge-amber' };

  tbody.innerHTML = lista.map(a => {
    const tids = a.turmaIds || (a.turmaId ? [a.turmaId] : []);
    const ini  = a.nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const vl   = a.vencimento ? vencLabel(vencISO(a)) : { txt: 'Não definido', sty: 'color:var(--muted)' };
    const mensAtrasadas = DB.mensalidades.filter(m => m.alunoId === a.id && m.status === 'atrasado').length;
    const aniv = a.data && ehAniversarioHoje(a.data) ? '🎂'
               : (a.data && diasParaAniversario(a.data) <= 3 ? '🎈' : '');

    const turmaCards = tids.length
      ? tids.map(tid => {
          const t    = DB.turmas.find(x => x.id === tid); if (!t) return '';
          const tipo = DB.tipos.find(x => x.id === t.tipoId);
          const ocu  = DB.alunos.filter(x => (x.turmaIds || [x.turmaId]).includes(tid)).length;
          const pct  = Math.round((ocu / Math.max(t.vagas, 1)) * 100);
          const barCls = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)';
          const dias    = (t.dias || []).join(', ') || '—';
          const horario = t.horaIni && t.horaFim ? `${t.horaIni}–${t.horaFim}` : (t.horario || '—');
          return `<div style="display:flex;flex-direction:column;gap:6px;background:var(--card2);
            border:1px solid var(--border);border-radius:10px;padding:12px 14px;min-width:190px;flex:1;max-width:280px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.1rem;">${tipo ? tipo.emoji : '📚'}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.84rem;font-weight:700;color:var(--text);">${esc(t.nome)}</div>
                <div style="font-size:.68rem;color:var(--muted);">${tipo ? esc(tipo.nome) : ''}</div>
              </div>
              <span style="font-size:.8rem;font-weight:700;color:var(--green);">${fmtR(t.valor)}</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:.7rem;color:var(--subtle);">
              ${dias !== '—'    ? `<span>📅 ${esc(dias)}</span>`     : ''}
              ${horario !== '—' ? `<span>🕐 ${horario}</span>`       : ''}
              ${t.sala          ? `<span>📍 ${esc(t.sala)}</span>`   : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:${barCls};border-radius:2px;"></div>
              </div>
              <span style="font-size:.65rem;color:var(--muted);">${ocu}/${t.vagas} vagas</span>
            </div>
            ${t.professor ? `<div style="font-size:.68rem;color:var(--muted);">👤 ${esc(t.professor)}</div>` : ''}
          </div>`;
        }).join('')
      : `<div style="color:var(--muted);font-size:.8rem;padding:4px 2px;">
           Sem turmas — <a href="#" onclick="event.preventDefault();abrirWizardMatricula('${a.id}')"
           style="color:var(--accent);">matricular</a>
         </div>`;

    return `<tr class="aluno-row" style="cursor:pointer;" onclick="toggleAlunoExpand('${a.id}')">
      <td><div class="name-cell"><div class="av">${ini}</div><div>
        <div class="nm">${esc(a.nome)}${aniv ? ` <span style="font-size:.8rem;">${aniv}</span>` : ''}</div>
        <div class="sub">${a.criadoEm || ''}</div>
      </div></div></td>
      <td style="font-family:var(--mono);font-size:.78rem;">${a.cpf || '—'}</td>
      <td>${a.tel || '—'}</td>
      <td>${tids.length
        ? '<div style="display:flex;flex-wrap:wrap;gap:2px;">'
          + tids.map(tid => {
              const tt = DB.turmas.find(x => x.id === tid);
              return tt ? `<span class="badge badge-violet" style="font-size:.62rem;padding:2px 6px;">${esc(tt.nome)}</span>` : '';
            }).join('') + '</div>'
        : '<span style="color:var(--muted);font-size:.78rem;">—</span>'}
      </td>
      <td><span style="font-family:var(--mono);color:var(--green);font-weight:700;">${fmtR(a.mensalidade)}</span></td>
      <td><span style="font-size:.78rem;${vl.sty || ''}">${vl.txt}</span></td>
      <td>
        <span class="badge ${sCls[a.status] || ''}">● ${cap(a.status || '')}</span>
        ${mensAtrasadas > 0
          ? `<div style="font-size:.63rem;color:var(--red);margin-top:2px;">⚠️ ${mensAtrasadas} atraso${mensAtrasadas > 1 ? 's' : ''}</div>`
          : ''}
      </td>
      <td style="white-space:nowrap;" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-primary" onclick="abrirWizardMatricula('${a.id}')" title="Matrículas">🎓</button>
        <button class="btn btn-sm btn-secondary" onclick="abrirModalAluno('${a.id}')" title="Editar" style="margin:0 3px;">✏️</button>
        ${aniv ? `<button class="btn btn-sm" style="background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;border:none;margin:0 3px;"
                    onclick="abrirParabens('${a.id}')">${aniv}</button>` : ''}
        ${a.tel ? `<button class="btn btn-sm" style="background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;"
                    onclick="abrirWhatsAppCob('${a.id}')" title="WhatsApp">📱</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deletarAluno('${a.id}')" style="margin-left:3px;" title="Excluir">🗑️</button>
      </td>
    </tr>
    <tr class="aluno-expand-row" id="expand-${a.id}" style="display:none;">
      <td colspan="8" style="padding:0;background:var(--bg);">
        <div style="padding:12px 18px 16px;border-bottom:2px solid var(--border);">
          <div style="font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:10px;">🎓 Turmas Matriculadas</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">${turmaCards}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary" onclick="abrirWizardMatricula('${a.id}')">➕ Gerenciar Matrículas</button>
            <button class="btn btn-sm btn-secondary" onclick="abrirDetalheAluno('${a.id}')">👁️ Ficha Completa</button>
            ${a.tel ? `<button class="btn btn-sm" style="background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;border:none;"
                         onclick="abrirWhatsAppCob('${a.id}')">💬 WhatsApp</button>` : ''}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS
// ─────────────────────────────────────────────────────────────────────────────

export function populateAlunoFilters() {
  document.getElementById('filter-aluno-turma').innerHTML =
    '<option value="">Todas as turmas</option>'
    + DB.turmas.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');

  document.getElementById('filter-aluno-tipo').innerHTML =
    '<option value="">Todas modalidades</option>'
    + DB.tipos.map(t => `<option value="${t.id}">${esc(t.emoji || '')} ${esc(t.nome)}</option>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL ALUNO
// ─────────────────────────────────────────────────────────────────────────────

export function abrirModalAluno(id = null) {
  document.getElementById('modal-aluno-title').textContent = id ? '✏️ Editar Aluno' : '➕ Novo Aluno';
  document.getElementById('a-id').value = id || '';

  if (id) {
    const a = DB.alunos.find(x => x.id === id); if (!a) return;
    document.getElementById('a-nome').value      = a.nome        || '';
    document.getElementById('a-cpf').value       = a.cpf         || '';
    document.getElementById('a-data').value      = a.data        || '';
    document.getElementById('a-tel').value       = a.tel         || '';
    document.getElementById('a-email').value     = a.email       || '';
    document.getElementById('a-mensalidade').value = a.mensalidadeBruta || a.mensalidade || '';
    document.getElementById('a-vencimento').value  = a.vencimento || '';
    document.getElementById('a-status').value      = a.status    || 'ativo';
    document.getElementById('a-obs').value         = a.obs        || '';
    document.getElementById('a-desconto-pct').value   = a.descontoPct   || '';
    document.getElementById('a-desconto-reais').value = a.descontoReais || '';
    document.getElementById('a-mensalidade-final').value = a.mensalidade || '';
    // turmas — suporta legado (turmaId) e novo (turmaIds)
    const ids = a.turmaIds || (a.turmaId ? [a.turmaId] : []);
    _turmasBuf = ids.map(x => ({ id: x }));
  } else {
    ['a-nome','a-cpf','a-data','a-tel','a-email','a-obs','a-vencimento','a-desconto-pct','a-desconto-reais']
      .forEach(i => document.getElementById(i).value = '');
    document.getElementById('a-status').value = 'ativo';
    document.getElementById('a-mensalidade-final').value = '';
    _turmasBuf = [];
  }

  if (typeof renderTurmasBuf === 'function') renderTurmasBuf(id);
  abrirModal('modal-aluno');
}

// ─────────────────────────────────────────────────────────────────────────────
// SALVAR
// ─────────────────────────────────────────────────────────────────────────────

export function salvarAluno() {
  clearFieldErrors('modal-aluno');

  const nome = document.getElementById('a-nome').value.trim();
  if (!nome) { fieldError('a-nome', 'Nome é obrigatório'); return; }

  const emailVal = document.getElementById('a-email').value.trim();
  if (emailVal && !validarEmail(emailVal)) { fieldError('a-email', 'Email inválido'); return; }

  const telVal = document.getElementById('a-tel').value.trim();
  if (telVal && !validarTelefone(telVal)) { fieldError('a-tel', 'Telefone incompleto (mín. 10 dígitos)'); return; }

  const cpfVal = document.getElementById('a-cpf').value.trim();
  if (cpfVal && cpfVal.replace(/\D/g, '').length === 11 && !validarCPF(cpfVal)) { fieldError('a-cpf', 'CPF inválido'); return; }

  const editId   = document.getElementById('a-id').value;
  const turmaIds = _turmasBuf.map(x => x.id);
  const turmaId  = turmaIds[0] || ''; // legado

  // Verificar vagas
  for (const tid of turmaIds) {
    const t = DB.turmas.find(x => x.id === tid);
    if (t) {
      const ocu = DB.alunos.filter(a => (a.turmaIds || [a.turmaId]).includes(tid) && (editId ? a.id !== editId : true)).length;
      if (ocu >= t.vagas) { toast(`Turma "${t.nome}" está lotada!`, 'err'); return; }
    }
  }

  const obj = {
    nome,
    cpf:               document.getElementById('a-cpf').value.trim(),
    data:              document.getElementById('a-data').value,
    tel:               document.getElementById('a-tel').value.trim(),
    email:             document.getElementById('a-email').value.trim(),
    turmaId, turmaIds,
    mensalidadeBruta:  parseFloat(document.getElementById('a-mensalidade').value)        || 0,
    descontoPct:       parseFloat(document.getElementById('a-desconto-pct').value)       || 0,
    descontoReais:     parseFloat(document.getElementById('a-desconto-reais').value)     || 0,
    mensalidade:       parseFloat(document.getElementById('a-mensalidade-final').value
                                  || document.getElementById('a-mensalidade').value)     || 0,
    vencimento:        parseInt(document.getElementById('a-vencimento').value)           || 0,
    status:            document.getElementById('a-status').value,
    obs:               document.getElementById('a-obs').value.trim(),
  };

  if (editId) {
    const idx      = DB.alunos.findIndex(x => x.id === editId);
    const anterior = idx !== -1 ? { ...DB.alunos[idx] } : null;
    if (idx !== -1) DB.alunos[idx] = { ...DB.alunos[idx], ...obj };
    toast('Aluno atualizado!');
    dbSave({ entidade: 'alunos', item: DB.alunos.find(x => x.id === editId) });
    // Auditoria diferencial
    const campos = ['nome', 'email', 'tel', 'status', 'mensalidade', 'turmaId'];
    const diff   = {};
    if (anterior) campos.forEach(c => { if (String(anterior[c] || '') !== String(obj[c] || '')) diff[c] = { de: anterior[c], para: obj[c] }; });
    if (Object.keys(diff).length) auditLog('alunos', 'editar', { id: editId, nome: obj.nome, diff }, anterior);

  } else {
    const novo = { id: uid(), ...obj, criadoEm: hoje() };
    DB.alunos.push(novo);
    if (novo.mensalidade > 0) gerarMensalidadeMes(novo);
    onAlunoCriado();
    // Gera contrato automático ao matricular
    if (novo.turmaId && novo.mensalidade > 0) {
      const t = DB.turmas.find(x => x.id === novo.turmaId);
      const novoCt = {
        id: uid(), alunoId: novo.id, turmaId: novo.turmaId, turmaNome: t ? t.nome : '',
        inicio: hoje(), valor: novo.mensalidade, venc: novo.vencimento || 10,
        duracao: 'indeterminado', obs: 'Gerado automaticamente na matrícula.',
        status: 'ativo', emitidoEm: new Date().toLocaleDateString('pt-BR'), tipo: 'novo',
      };
      DB.contratos.push(novoCt);
      dbSave({ entidade: 'contratos', item: novoCt });
    }
    toast(`"${nome}" cadastrado!`);
    dbSave({ entidade: 'alunos', item: novo });
    auditLog('alunos', 'criar', { id: novo.id, nome: novo.nome, turmaId: novo.turmaId });
  }

  fecharModal('modal-aluno');
  renderAlunos();
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETAR
// ─────────────────────────────────────────────────────────────────────────────

export function deletarAluno(id) {
  const a = DB.alunos.find(x => x.id === id); if (!a) return;
  if (!confirm(`Excluir "${a.nome}"?`)) return;

  const backup    = { ...a };
  const eraAtivo  = a.status === 'ativo';
  const mensIds   = DB.mensalidades.filter(m => m.alunoId === id).map(m => m.id);

  auditLog('alunos', 'excluir', { id, nome: a.nome, status: a.status });

  DB.alunos       = DB.alunos.filter(x => x.id !== id);
  DB.mensalidades = DB.mensalidades.filter(m => m.alunoId !== id);
  _dbDeleteItem('alunos', id);
  mensIds.forEach(mid => _dbDeleteItem('mensalidades', mid));
  onAlunoRemovido(eraAtivo);
  renderAlunos();

  toastUndo(`"${backup.nome}" excluído.`, () => {
    DB.alunos.push(backup);
    dbSave({ entidade: 'alunos', item: backup });
    if (eraAtivo) onAlunoCriado();
    renderAlunos();
    toast(`"${backup.nome}" restaurado!`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPAND ROW
// ─────────────────────────────────────────────────────────────────────────────

export function toggleAlunoExpand(id) {
  const row     = document.getElementById('expand-' + id); if (!row) return;
  const visible = row.style.display !== 'none';
  document.querySelectorAll('.aluno-expand-row').forEach(r => r.style.display = 'none');
  document.querySelectorAll('.aluno-row').forEach(r => r.classList.remove('row-expanded'));
  if (!visible) {
    row.style.display = '';
    row.previousElementSibling?.classList.add('row-expanded');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR CSV
// ─────────────────────────────────────────────────────────────────────────────

export function exportarAlunos() {
  if (!DB.alunos.length) { toast('Nenhum aluno.', 'err'); return; }
  const hdr  = ['Nome','CPF','Telefone','E-mail','Nascimento','Turma','Mensalidade','Dia Vencimento','Status'];
  const rows = DB.alunos.map(a => {
    const t = DB.turmas.find(x => x.id === a.turmaId) || { nome: '' };
    return [
      a.nome, a.cpf || '', a.tel || '', a.email || '',
      a.data ? fmtD(a.data) : '', t.nome,
      fmtR(a.mensalidade), a.vencimento ? `Dia ${a.vencimento}` : '', a.status,
    ].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',');
  });
  baixarCSV([hdr.join(','), ...rows].join('\n'), 'alunos');
  toast('CSV exportado!');
}

// ─────────────────────────────────────────────────────────────────────────────
// MENSALIDADES - helpers
// ─────────────────────────────────────────────────────────────────────────────

export function gerarMensalidadeMes(aluno, refDateOverride) {
  const agora  = refDateOverride || new Date();
  const mesAno = `${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`;

  // Não duplicar
  if (DB.mensalidades.some(m => m.alunoId === aluno.id && m.mesAno === mesAno)) return;
  if (!aluno.mensalidade || aluno.mensalidade <= 0) return;

  let valor   = aluno.mensalidade;
  let proRata = false, proRataInicio = null;

  // Pro-rata se iniciou depois do dia 1
  if (aluno.criadoEm) {
    const dtInicio = _toDateFlex(aluno.criadoEm);
    if (dtInicio && dtInicio.getMonth() === agora.getMonth() && dtInicio.getFullYear() === agora.getFullYear() && dtInicio.getDate() > 1) {
      const diasNoMes    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
      const diasRestantes = diasNoMes - dtInicio.getDate() + 1;
      const valorCheio   = valor;
      valor              = Math.round((valorCheio / diasNoMes) * diasRestantes * 100) / 100;
      proRata            = true;
      proRataInicio      = dtInicio.toISOString().slice(0, 10);
      const nova = {
        id: uid(), alunoId: aluno.id, turmaId: aluno.turmaId,
        valor, valorCheio, mesAno, status: 'pendente',
        dataPgto: '', vencimento: vencISO(aluno, agora), obsPgto: '',
        proRata, proRataInicio,
      };
      DB.mensalidades.push(nova);
      dbSave({ entidade: 'mensalidades', item: nova });
      return;
    }
  }

  const nova = {
    id: uid(), alunoId: aluno.id, turmaId: aluno.turmaId,
    valor, mesAno, status: 'pendente', dataPgto: '',
    vencimento: vencISO(aluno, agora), obsPgto: '',
  };
  DB.mensalidades.push(nova);
  dbSave({ entidade: 'mensalidades', item: nova });
}

export function gerarMensalidadesProxMeses(aluno, qtdMeses) {
  const agora = new Date();
  for (let i = 0; i < qtdMeses; i++) {
    const ref = new Date(agora.getFullYear(), agora.getMonth() + i, 1);
    gerarMensalidadeMes(aluno, ref);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function _toDateFlex(str) {
  if (!str) return null;
  // Suporta "DD/MM/YYYY" e "YYYY-MM-DD"
  if (str.includes('/')) {
    const [d, m, y] = str.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPOR PARA WINDOW (compatibilidade durante migração)
// Remova estas linhas conforme o HTML for atualizado para usar import
// ─────────────────────────────────────────────────────────────────────────────
window.renderAlunos        = renderAlunos;
window.populateAlunoFilters = populateAlunoFilters;
window.abrirModalAluno     = abrirModalAluno;
window.salvarAluno         = salvarAluno;
window.deletarAluno        = deletarAluno;
window.toggleAlunoExpand   = toggleAlunoExpand;
window.exportarAlunos      = exportarAlunos;
window.gerarMensalidadeMes = gerarMensalidadeMes;
