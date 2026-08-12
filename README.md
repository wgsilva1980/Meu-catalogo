# Gerador de Catálogo — multi-empresa

Plataforma multi-tenant para cadastrar produtos e gerar catálogos em PDF: cada empresa cliente tem seu próprio login, produtos, categorias e catálogo, isolados das demais. Existe um papel de **super-admin** (`/master`) que cadastra as empresas e pode "entrar como" qualquer uma delas para dar suporte. A BN Suplementos foi a primeira empresa migrada para essa base. Stack: Next.js (App Router) + Supabase (banco, autenticação e armazenamento) + Puppeteer (geração do PDF). Opção A do plano — custo zero para validar.

> Este projeto foi escrito à mão neste ambiente porque o sandbox não tem um shell disponível para rodar `npm install`/`create-next-app`. Todo o código já está pronto; os passos abaixo rodam na sua máquina.

## 1. Pré-requisitos

- Node.js 18+ instalado
- Uma conta gratuita em [supabase.com](https://supabase.com)
- Uma conta gratuita em [vercel.com](https://vercel.com) (para o deploy)

## 2. Criar o projeto no Supabase

1. Crie um novo projeto no Supabase (plano Free).
2. Vá em **SQL Editor** e cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql). Rode o script — ele cria as tabelas, políticas de segurança (RLS), os buckets de imagens/PDFs e já semeia as 7 categorias fixas (Whey, Creatina, Pré-treino, Vitaminas, Barras, Acessórios, Outras). *(Se o projeto já existia antes da versão multi-empresa, esse script já foi rodado — pule para o próximo passo.)*
3. Ainda no **SQL Editor**, rode primeiro o bloco de "DIAGNÓSTICO" no topo de [`supabase/migration_multitenant.sql`](supabase/migration_multitenant.sql) (só leitura) para confirmar o e-mail da sua conta em `auth.users`. Edite o placeholder `TROQUE_PELO_SEU_EMAIL@exemplo.com` no script com esse e-mail — essa conta vira dona da empresa "BN Suplementos" **e** super-admin da plataforma. Cole o restante do script e rode uma única vez. Ele cria as tabelas `companies`/`profiles`, migra os dados atuais (produtos, categorias, configurações) para a empresa "BN Suplementos", e atualiza a RLS para isolar cada empresa. *(Só rode isso uma vez — não é idempotente.)*
4. Depois, rode [`supabase/migration_customers.sql`](supabase/migration_customers.sql) — cria a tabela `customers` (cadastro de clientes), escopada por empresa da mesma forma que produtos/categorias.
5. Em **Authentication → Providers**, deixe apenas E-mail/Senha habilitado. **Desative "Enable email confirmations"** para simplificar (não há cadastro público — cada login é criado manualmente pelo super-admin em `/master`).
6. Em **Authentication → Users**, confirme que a conta usada no passo 3 já existe (crie-a com "Add user" antes, se ainda não existir). É essa conta que vai logar em `/login`.
7. Em **Project Settings → API**, copie:
   - `Project URL`
   - `anon public key`
   - `service_role key` (mantenha em segredo — nunca no frontend)

## 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

`ANTHROPIC_API_KEY` é opcional: sem ela, o upload de imagem (remoção de fundo + recorte quadrado) continua funcionando normalmente, mas o preenchimento automático de nome/marca/categoria/descrição a partir da foto fica desabilitado e os campos precisam ser preenchidos manualmente. Gere a chave em [console.anthropic.com](https://console.anthropic.com).

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. A página inicial leva ao login. Depois de autenticar: se a conta for super-admin, cai em `/master` (gestão de empresas); senão, cai direto em `/admin` (painel da própria empresa).

> A geração de PDF em desenvolvimento usa o pacote `puppeteer` completo (baixa um Chromium local no `npm install`). Em produção na Vercel, usa `puppeteer-core` + `@sparticuz/chromium`, mais leve para rodar em função serverless.

## 5. Cadastrar uma nova empresa (como super-admin)

Logado como super-admin em `/master`:

1. Clique em **Nova empresa**, preencha o nome da empresa e o e-mail/senha do primeiro login (dono) dela, e crie. A empresa já nasce com as 7 categorias padrão, editáveis livremente depois.
2. Na lista de empresas, use **Entrar como** para acessar o painel `/admin` daquela empresa (aparece uma faixa "Modo suporte" no topo — clique em "Voltar ao painel master" para sair). Use **Editar** para ajustar os dados de contato, e **Ativar/Desativar** para suspender o acesso de uma empresa sem apagar os dados dela.

## 6. Cadastrar os primeiros produtos (dentro do painel de uma empresa)

Logado em `/admin` (como dono de uma empresa, ou impersonando via `/master`):

1. Vá em **Categorias** para conferir/ajustar a lista (as 7 padrão já vêm prontas, específicas dessa empresa).
2. Vá em **Produtos → Novo produto** e arraste a foto da embalagem para o quadro de imagem. O fundo é removido, a foto é recortada em formato quadrado com fundo branco, e — se `ANTHROPIC_API_KEY` estiver configurada — os campos de nome, marca, categoria e descrição curta são preenchidos automaticamente a partir da foto (revise antes de salvar). Complete os demais campos (preço, promoção, disponibilidade) e cadastre alguns itens reais da loja.
3. Vá em **Gerar catálogo**, escolha "Catálogo completo" ou categorias específicas, e clique em **Gerar PDF**. O link de download aparece na hora (válido por 7 dias, arquivo fica salvo no bucket `catalogos`, isolado por empresa).
4. Vá em **Clientes** para cadastrar a base de clientes da loja. Ao digitar um CEP de 8 dígitos, o endereço (rua, bairro, cidade, UF) é preenchido automaticamente via [ViaCEP](https://viacep.com.br) (API pública, sem custo e sem chave) — complemento e número seguem editáveis manualmente.

## 7. Deploy (Vercel, plano Hobby — gratuito)

1. Suba este projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), importe o repositório.
3. Em **Environment Variables**, adicione as mesmas variáveis do `.env.local`.
4. Deploy. O domínio será algo como `bn-suplementos.vercel.app` (dá para apontar um domínio próprio depois, em **Settings → Domains**).

### Limitações da Opção A (custo zero) a ter em mente

- O projeto Supabase Free pausa após ~7 dias sem uso; a primeira requisição depois disso demora alguns segundos a mais para "acordar".
- Limite de 500MB de banco e 1GB de armazenamento no plano Free — folgado para o catálogo inicial, mas vale monitorar conforme o número de fotos crescer.
- Funções serverless da Vercel Hobby têm tempo de execução limitado; catálogos muito grandes (centenas de produtos com fotos pesadas) podem se aproximar do limite de 60s configurado em `maxDuration`.
- O plano Hobby da Vercel é voltado, pelos termos de uso, a projetos não comerciais — adequado para validar com a loja; para operação comercial definitiva, migrar para a Opção B (Vercel Pro ou Render) é o próximo passo natural, sem precisar reescrever o sistema.

## Estrutura do projeto

```
app/
  page.tsx                    → página inicial
  login/page.tsx              → login (único, para empresas e super-admin)
  admin/                      → painel de uma empresa (dono/staff, ou super-admin impersonando)
    layout.tsx                → resolve a empresa ativa (resolveActiveCompany) e protege a rota
    page.tsx                  → painel
    produtos/                 → listagem, busca/filtro, criar, editar
    categorias/                → gestão de categorias
    clientes/                 → cadastro de clientes (com autocomplete de CEP via ViaCEP)
    catalogo/page.tsx         → geração de PDF
    configuracoes/            → dados/contato da própria empresa
  master/                     → painel do super-admin
    layout.tsx                → exige is_super_admin
    page.tsx                  → lista de empresas (entrar como / editar / ativar-desativar)
    nova/page.tsx             → criar empresa + primeiro login (dono)
    [id]/page.tsx             → editar dados de contato de uma empresa
    actions.ts                → createCompany, updateCompany, toggleCompanyActive, impersonateCompany, stopImpersonating
  api/catalogo/gerar/route.ts → gera o PDF (Puppeteer) e salva no Storage, escopado por empresa
  api/produtos/reconhecer/route.ts → identifica nome/marca/categoria/descrição via IA (Claude, visão)
  api/upload/{produto,logo}/route.ts → upload de imagens, escopado por empresa
components/                   → ProductForm (drag-and-drop, remoção de fundo, reconhecimento), CustomerForm (autocomplete de CEP), CatalogGenerator, AdminSidebar, MasterSidebar, ImpersonationBanner
lib/
  supabase/                   → clientes browser/server/admin
  company.ts                  → resolveActiveCompany() — resolve a empresa ativa (própria ou impersonada)
  defaultCategories.ts        → categorias padrão semeadas para toda empresa nova
  slugify.ts
  pdf/template.ts             → template HTML do catálogo (capa, sumário, categorias)
  types.ts
proxy.ts                      → protege /admin, /master e as rotas de API
supabase/schema.sql               → schema original (single-tenant, histórico)
supabase/migration_multitenant.sql → migração para multi-empresa (companies, profiles, RLS por empresa)
supabase/migration_customers.sql   → tabela customers (cadastro de clientes por empresa)
```
