This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Configuração de Upload de Evidências (Google Drive)

### 1) Variáveis de ambiente

Use o arquivo `.env.example` como base e crie/atualize seu `.env`.

Opção recomendada (JSON completo da service account em 1 variável):

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
2. Compartilhe essa pasta com o e-mail da service account (`client_email`) com permissão de edição.
3. Copie o ID da pasta na URL do Google Drive.

### 3) Configurar no sistema (Admin)

1. Acesse `Admin > Configurações`.
2. Aba `Upload de Evidências`.
3. Habilite o upload.
4. Informe o `ID da Pasta Raiz no Google Drive`.
5. Salve.

### 4) Comportamento automático no registro de execução

Ao clicar em `Finalizar Registro` com evidência anexada, o sistema:

1. Cria/reutiliza pastas em `Mês de Referência / Controle / KPI`.
2. Faz upload do arquivo para a pasta do KPI.
3. Salva o link do arquivo no campo `evidence_link` em `kpi_runs`.

Observação: o sistema evita duplicar pastas, reaproveitando as já existentes.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
