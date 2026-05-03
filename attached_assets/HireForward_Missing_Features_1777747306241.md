# HireForward — Telas e Funcionalidades Faltantes
**Para passar ao Replit Agent**

---

## BLOCO 1 — LADO DO CLIENTE (empresa de RH)

### 1.1 Company Settings (configuração da empresa)
Rota: `/settings`
- Logo da empresa (upload de imagem)
- Nome da empresa (corrige o bug do "unknown.com")
- Site da empresa
- Setor/indústria (dropdown)
- Tamanho da empresa (dropdown: 1-10, 11-50, 51-200, 200+)
- Timezone padrão
- Idioma padrão das entrevistas (PT / EN / ES)
- Dados de contato do RH (nome, email, telefone)
- Esses dados alimentam a tela do candidato (logo, nome da empresa, idioma)

---

### 1.2 Tela do Candidato (acesso por link único, sem login)
Rota: `/i/[token]`
- Validação do token (expirado / já usado / inválido → mensagem clara)
- Tela de boas-vindas:
  - Logo da empresa
  - Nome do cargo
  - Mensagem: "You may use any tools, AI, or resources during this interview"
  - Tempo estimado (configurável pelo RH)
  - Botão "Start Interview"
- Chat com o agente entrevistador (streaming, campo de texto expansível)
- Mobile-first (candidato muitas vezes acessa pelo celular)
- Encerramento automático quando o agente sinalizar fim
- Tela final: "Thank you. Your interview has been submitted." (sem score)
- Sem header, sem navegação — foco total na entrevista

---

### 1.3 Gestão de Candidatos (dentro de um processo)
Rota: `/processes/[id]/candidates`
- Tabela: Nome | Email | Status | Score | Recomendação | Data | Ações
- Status possíveis: Invited / In Progress / Completed / Expired
- Filtros: por status, score mínimo, recomendação
- Botão "Add Candidate" (nome + email → gera link e envia email)
- Botão "Copy Link" por candidato
- Botão "Send Reminder" para quem não iniciou
- Click na linha → abre relatório individual

---

### 1.4 Relatório Individual do Candidato
Rota: `/processes/[id]/candidates/[id]`
- Score geral (número grande + gauge visual)
- Recomendação: Advance / Hold / Reject (com cor)
- Resumo em texto gerado pelo agente avaliador
- Breakdown por critério (barra horizontal por critério com score e justificativa)
- Destaques positivos (lista)
- Red flags (lista)
- Transcrição completa da entrevista (expansível/colapsável)
- Botão "Export PDF"
- Botão "Share with Manager" → gera link de visualização somente leitura para o gestor

---

### 1.5 View do Gestor (somente leitura, sem login obrigatório)
Rota: `/manager/[token]`
- Acesso via link gerado pelo RH
- Mostra apenas os processos compartilhados com aquele gestor
- Lista de candidatos com score e recomendação
- Pode abrir relatório individual
- Não vê configurações do agente, system prompt, nem outros processos
- Sem ações — apenas visualização

---

### 1.6 Envio de Email para Candidatos
- Email de convite com link único (template customizável com nome da empresa e cargo)
- Email de lembrete para candidatos que não iniciaram (manual ou automático após X dias)
- Email de confirmação para o candidato após completar a entrevista
- Provider: Resend ou SendGrid (configurar variável de ambiente)

---

### 1.7 Onboarding da Empresa (primeiro acesso)
- Wizard de 3 passos após primeiro login:
  1. Complete seu perfil (nome da empresa, logo, setor)
  2. Crie seu primeiro processo seletivo
  3. Convide o primeiro candidato
- Sem esse wizard o usuário novo fica perdido

---

### 1.8 Gerenciamento de Usuários da Empresa
Rota: `/settings/team`
- Lista de usuários com papel (Admin / Manager)
- Convidar novo usuário por email
- Remover usuário
- Admin vê tudo e configura; Manager só visualiza relatórios

---

## BLOCO 2 — LADO DO ADMIN (owner — você)

### 2.1 Gestão de Empresas
Rota: `/admin/companies`
- Tabela: Nome | Plano | Status | Empresas criadas | Candidatos avaliados | Tokens mês | Custo mês | Data cadastro
- Filtros: plano, status (active/trial/suspended)
- Click → abre detalhe da empresa
- Ações: Ativar / Suspender / Alterar plano / Impersonar (logar como a empresa para suporte)

---

### 2.2 Detalhe da Empresa (admin)
Rota: `/admin/companies/[id]`
- Dados cadastrais completos
- Histórico de uso de tokens mês a mês (gráfico)
- Lista de processos seletivos criados
- Lista de usuários cadastrados
- Log de atividade (últimos acessos, ações)
- Botão "Send Message" (email direto para o admin da empresa)

---

### 2.3 Planos e Limites
Rota: `/admin/plans`
- CRUD de planos:
  - Nome (Trial / Starter / Growth / Enterprise)
  - Preço mensal (USD)
  - Limite de processos ativos
  - Limite de candidatos/mês
  - Limite de tokens/mês
  - Features habilitadas (ex: PDF export, Manager view, custom branding)
- Atribuir plano a uma empresa manualmente

---

### 2.4 Cobrança e Faturamento (admin)
Rota: `/admin/billing`
- Integração Stripe (ou placeholder para MVP):
  - Lista de assinaturas ativas por empresa
  - MRR total
  - Próximas renovações
  - Empresas inadimplentes
- Por empresa: histórico de pagamentos, invoices
- Para MVP sem Stripe: campo manual de "plano pago até" + status

---

### 2.5 Alertas de Uso
- Alerta quando empresa atingir 80% do limite de tokens do plano
- Alerta quando empresa ultrapassar limite (bloquear ou notificar?)
- Painel de alertas ativos no admin dashboard

---

### 2.6 Configuração Global da Plataforma
Rota: `/admin/settings`
- Chave da API Anthropic (editável sem redeploy)
- Modelo padrão (ex: claude-sonnet-4-20250514)
- Preço por token input e output (para recalcular custo estimado)
- Email padrão de suporte
- Tempo máximo de sessão de entrevista (minutos)
- Prazo padrão de expiração dos links de candidato (dias)
- Toggle: modo manutenção (bloqueia acesso de clientes com mensagem)

---

### 2.7 Logs e Auditoria
Rota: `/admin/logs`
- Log de todas as chamadas à API Anthropic:
  - Empresa | Processo | Candidato | Tokens input | Tokens output | Custo | Data | Duração
- Filtros: por empresa, data, custo mínimo
- Export CSV

---

## BLOCO 3 — INFRAESTRUTURA E AUTH

### 3.1 Autenticação Completa
- Login com email + senha
- Recuperação de senha (forgot password → email com link)
- Magic link como alternativa (mais simples para B2B)
- Proteção de rotas: cliente não acessa admin, manager não acessa config

---

### 3.2 Registro de Nova Empresa
Rota: `/register`
- Nome da empresa
- Nome do responsável
- Email corporativo
- Senha
- Plano selecionado (ou entrar como Trial automático)
- Confirmação de email antes de liberar acesso

---

### 3.3 Expiração e Invalidação de Links de Candidato
- Link expira após prazo configurado (default: 7 dias)
- Link invalida após uso (sessão completa)
- Link pode ser desativado manualmente pelo RH
- Página de erro amigável para link expirado/inválido

---

### 3.4 Webhook Pós-Entrevista
- Após avaliação concluída, disparar webhook para URL configurada pela empresa
- Payload: candidate_id, process_id, score, recommendation, timestamp
- Permite integração com ATS externos sem API formal
- Configurável em `/settings/integrations`

---

## ORDEM SUGERIDA PARA O REPLIT

**Sprint 1 — Fecha o loop do produto:**
1. Tela do candidato (`/i/[token]`) — sem isso nada funciona de ponta a ponta
2. Company Settings (corrige unknown.com e alimenta a tela do candidato)
3. Envio de email de convite para candidato

**Sprint 2 — Experiência completa do RH:**
4. Relatório individual do candidato com score e breakdown
5. Gestão de candidatos com filtros e status
6. View do gestor (link somente leitura)

**Sprint 3 — Admin funcional:**
7. Gestão de empresas com detalhe e impersonation
8. Planos e limites
9. Logs e auditoria com export CSV

**Sprint 4 — Produção:**
10. Recuperação de senha
11. Registro com confirmação de email
12. Alertas de uso por plano
13. Cobrança (Stripe ou manual)
14. Onboarding wizard

---

## VARIÁVEIS DE AMBIENTE ADICIONAIS NECESSÁRIAS

```
RESEND_API_KEY=        # ou SENDGRID_API_KEY para emails
FROM_EMAIL=            # email remetente (ex: noreply@hireforward.app)
STRIPE_SECRET_KEY=     # para billing (sprint 4)
STRIPE_WEBHOOK_SECRET= # para billing (sprint 4)
APP_URL=               # URL pública da plataforma (para links dos candidatos)
INVITE_EXPIRY_DAYS=7   # prazo padrão dos links de candidato
```
