# Casa Royale — Poker House Manager · PRD

## Original Problem Statement
Sistema completo de gestão de Casa de Poker em web app (responsivo desktop/tablet) com banco de dados, gerenciamento de jogadores, torneios (buy-in/rake/rebuy/add-ons/bônus), inscrições rápidas, ranking dinâmico com filtros, calculadora de prize pool, módulo de caixa com controle de fiados, cash games, dashboard, perfil/CRM do jogador, níveis de permissão (Admin/Operador), tema escuro Tailwind, pt-BR / BRL.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB async). Auth com JWT em cookie httpOnly (samesite=none, secure). Role-based access control (admin vs operator). Brute-force lockout por e-mail. CORS configurado para FRONTEND_URL.
- **Frontend**: React 19 + React Router 7, TailwindCSS, shadcn/ui (Radix), Recharts, Sonner, axios com `withCredentials`. Tema dark "Jewel & Luxury" (Outfit/Manrope, gold/charcoal).
- **DB**: MongoDB. Collections: `users`, `players`, `tournaments`, `entries`, `charges`, `transactions`, `cash_tables`, `waitlist`, `point_structures`, `login_attempts`. UUID em `id`, `_id` excluído nas respostas.

## User Personas
- **Administrador**: configura torneios, estruturas de pontos, mesas, usuários; vê tudo financeiro.
- **Operador / Caixa**: inscreve jogadores, aciona rebuys/add-ons/bônus, recebe pagamentos, gerencia waitlist e ocupação.

## Core Requirements (static)
1. Cadastro de jogadores com saldo devedor.
2. Torneios com financeiros (buy-in, rake, rebuy, add-on, super, bônus) e estrutura de pontuação vinculada.
3. Inscrições com botões rápidos de Rebuy / Add-on / Super / Bônus por jogador.
4. Ranking filtrável (todos, por tipo, seleção múltipla, individual, por período).
5. Resumo financeiro automático (bruto, rake, prize pool) e calculadora de premiação por percentual.
6. Caixa: cobranças pendentes, dívidas, métodos (cash/PIX/cartão/fiado), histórico, venda de fichas.
7. Cash games: criação, abertura/fechamento, ocupação, fila de espera com ações (chamar/sentar/cancelar).
8. Dashboard: receita do dia, jogadores ativos, mesas abertas, torneios em andamento, gráfico 7 dias, dívidas totais.
9. Perfil do jogador (CRM): histórico de torneios, ROI, transações, pontos, dívida.
10. Permissões: admin vs operator; operator não vê admin nav nem cria torneios/mesas/usuários.

## What's been implemented (v1.0 — Apr 28, 2026)
- Auth JWT custom (login/logout/me) com brute-force throttle por e-mail (5/15min)
- CRUD completo: jogadores, torneios, estruturas de pontuação, mesas cash, usuários
- Inscrições com cobranças pendentes auto-geradas (buy-in + rake / rebuy / add-on / super / bônus)
- Set posição final → cálculo automático de pontos pela estrutura vinculada
- Sumário financeiro do torneio (bruto, rake, prize pool)
- Calculadora de premiação (% → R$) salva no torneio
- Caixa: pendentes (pagar cash/pix/card/debt), dívidas (recebimento parcial/total), venda de fichas, histórico
- Cash games: abrir/fechar, ocupação ±, waitlist com chamar/sentar/cancelar
- Ranking com filtros (todos / tipo / seleção múltipla / período)
- Dashboard com gráfico de receita 7 dias e métricas-chave
- Perfil/CRM do jogador com ROI e histórico
- Tema dark Outfit/Manrope com paleta gold; layout sidebar + topbar mobile
- Idempotent seed de admin e operador

## Backlog (P1 / P2)
- P1: Substituir inputs de data nativos no Ranking pelo shadcn Calendar (dd/mm/yyyy)
- P1: Refatorar `set_prize_distribution` extraindo helper privado
- P1: Adicionar TTL index em `login_attempts.created_at`
- P2: Paginação em listagens grandes
- P2: Decimal para precisão monetária
- P2: Modular `server.py` em routers/
- P2: Exportação CSV/PDF do prize pool e ranking
- P2: Fluxo de pagamento de prêmio (registrar prêmio recebido pelo finalista)
- P2: Notificação WhatsApp ao chamar jogador da waitlist (Twilio)

## Test Credentials
- Admin: `admin@poker.com` / `admin123`
- Operador: `caixa@poker.com` / `caixa123`
