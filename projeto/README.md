# KPI Compliance Tracker

Aplicação web para **acompanhamento de controles**, **KPIs**, **planos de ação**, **inventário de automações SOX** e **incidentes** correlacionados a **frameworks** e **controles** cadastrados na plataforma.

Stack principal: **Next.js 16**, **React 19**, **PostgreSQL** (via `DATABASE_URL`), **NextAuth** (Google), **Tailwind CSS**.

---

## Documentação para sustentação

O guia detalhado para manutenção (arquitetura, banco de dados, duas camadas de acesso SQL, rotas, seeds e troubleshooting) está em:

**[docs/SUSTENTACAO.md](./docs/SUSTENTACAO.md)**

Recomenda-se ler esse documento antes de alterar fluxos de **Automações**, **Incidentes** ou esquema de `controls` / `automation_*`.

---

## Requisitos e como rodar

- **Node.js** (LTS recomendado) e npm.  
- Arquivo **`.env`** na pasta `projeto/`, baseado em [`.env.example`](./.env.example).

```bash
cd projeto
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Bypass de autenticação no localhost (dev)

Em ambiente não produtivo, ao acessar por `localhost` ou `127.0.0.1`, o app pode liberar acesso sem Google SSO (ver `src/lib/auth-bypass.ts`).

Opcional:

```env
LOCALHOST_BYPASS_EMAIL=seu.email@empresa.com
```

### Autenticação Google (fora do localhost)

Configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, ou use arquivo `client_secret_*.json` na raiz de `projeto/`, conforme `src/auth.ts`. Defina também `AUTH_SECRET` ou `NEXTAUTH_SECRET` em produção.

---

## Variáveis de ambiente (resumo)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL (SSL) — obrigatória para dados reais |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | SSO Google |
| `LOCALHOST_BYPASS_EMAIL` | Opcional no dev local |

Detalhes e lista estendida: seção *Variáveis de ambiente* em [docs/SUSTENTACAO.md](./docs/SUSTENTACAO.md).

---

## Configuração de upload de evidências (Google Drive)

### 1) Variáveis de ambiente

Use [`.env.example`](./.env.example) como base.

Opção recomendada (JSON da service account em uma variável):

```env
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","token_uri":"https://oauth2.googleapis.com/token"}
```

Alternativa (campos separados):

```env
GOOGLE_DRIVE_CLIENT_EMAIL=service-account@seu-projeto.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2) Compartilhar pasta raiz no Google Drive

1. Crie (ou escolha) a pasta raiz de evidências no Drive.  
2. Compartilhe com o e-mail da service account (`client_email`), com permissão de edição.  
3. Copie o **ID** da pasta na URL do Drive.

### 3) Configurar no sistema (Admin)

1. Acesse **Admin → Configurações**.  
2. Aba **Upload de Evidências**.  
3. Habilite o upload e informe o **ID da pasta raiz**.  
4. Salve.

### 4) Comportamento no registro de execução

Ao **finalizar registro** com evidência anexada, o sistema cria/reutiliza pastas (`Mês de Referência / Controle / KPI`), envia o arquivo e grava o link em `kpi_runs.evidence_link`.

---

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`next build --webpack`) |
| `npm run start` | Servidor após build |
| `npm run lint` | ESLint |

---

## Deploy

O deploy segue o fluxo usual de aplicações Next.js (ex.: Vercel ou container com Node). Garanta `DATABASE_URL` e segredos de auth/Drive configurados no ambiente de produção.

Documentação oficial Next.js: [https://nextjs.org/docs](https://nextjs.org/docs).
