# CONTEXTO.md — GoStudio
> Cole este arquivo no início de qualquer conversa nova com IA.
> Gerado em: 12/03/2026, 11:24:29 por fabriziofarmaceutico

---

## O que é

Sistema de gestão para studios de dança/pilates. SPA em Vanilla JS puro + Firebase. Sem framework, sem build tool.

**Hosting:** Cloudflare Pages → `gostudio.pages.dev`  
**Firebase:** projeto `atelie-9df54`

---

## Stack

| Tecnologia | Uso |
|---|---|
| Vanilla JS (ES Modules) | Frontend — sem React, sem Vue |
| Firebase Auth (compat 10.8.1) | Autenticação |
| Firestore (compat 10.8.1) | Banco de dados |
| Firebase Storage | Arquivos/fotos |
| Stripe | Pagamentos com cartão |
| Pix via Pipedream | Pagamentos Pix |
| jsPDF + autotable | Geração de PDF |

---

## Módulos ES (já migrados)

- `modules/alunos.js` — CRUD alunos, gerarMensalidadeMes
- `modules/mensalidades.js` — Pagamentos, geração mensal
- `modules/turmas.js` — CRUD turmas, wizard matrícula
- `modules/agenda.js` — Slots, agendamentos
- `modules/relatorios.js` — Stats, CSV, ticket médio
- `modules/contratos.js` — PDF, assinatura digital
- `modules/prontuario.js` — Fichas, evoluções, PDF
- `modules/estoque.js` — CRUD, movimentos, badges
- `modules/comandas.js` — Abertura, itens, fechamento
- `modules/dashboard.js` — Stats, aniversariantes, devedores
- `modules/usuarios.js` — CRUD usuários, perfis dinâmicos
- `core/auth.js` — Auth, permissões, auditLog
- `core/db.js` — DB state, dbLoad, dbSave
- `core/router.js` — navTo, hash routing
- `core/ui.js` — toast, modal, fieldError
- `core/utils.js` — fmtR, esc, calcIdade, máscaras

## Ainda no index.html (pendentes)



---

## Firebase — Coleções

| Coleção | Conteúdo |
|---|---|
| `studio_alunos` | 4 alunos |
| `studio_mensalidades` | 4 registros |
| `studio_contratos` | 4 contratos |
| `studio_turmas` | 2 turmas |
| `studio_tipos` | 2 modalidades |
| `catalogo` | Produtos/serviços à venda |
| `estoque` | Itens em estoque |
| `estoque_movimentos` | Histórico entradas/saídas |
| `comandas` | Comandas abertas/fechadas |
| `agendamentos` | Agendamentos confirmados |
| `agendamentos_experimentais` | Aulas experimentais públicas |
| `studiogest_users` | Usuários do sistema |
| `sistema_config` | Configurações técnicas |

---

## Bugs corrigidos (não regredir)

1. **[ti/estoque]** tiResetEstoque — snap is not defined → usa _estoque.length
2. **[agenda]** Slots — campos horaIni/slotIntervalMin (não horaInicio/intervaloMin)
3. **[pagamentos]** Spinner mpag-btn-spin — display:inline-block duplicado removido
4. **[rules]** pagamentos_portal — campo é alunoId (não alunoUid)
5. **[rules]** agendamentos_experimentais — status só alterável por isEditor()
6. **[alunos]** idadeCompleta — lógica +1 corrigida para aniversários no mês

---

## Otimizações aplicadas

- Cache de config da agenda — agendConfigRef.get() só 1x por sessão
- renderRelatorios — espMensal calculado uma vez fora do loop
- Ticket médio — alunosComMens calculado uma vez, reusado 3x

---

## Como relatar um problema

Cole só o trecho relevante + descreva o comportamento esperado vs o que acontece.

**Exemplos:**
- *"ao salvar aluno, toast aparece mas a tabela não atualiza"*
- *"erro: Cannot read properties of undefined em alunos.js linha 47"*
- *"agenda não carrega os slots do horário configurado"*
