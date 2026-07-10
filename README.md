# MercadoFlow PDV com Supabase

Aplicação web de ponto de venda com estoque, vendas, fiados, relatórios, usuários, configurações e auditoria.

Esta versão usa:

- React + Vite no frontend;
- Supabase Auth para login e recuperação de senha;
- Supabase PostgreSQL para dados compartilhados;
- Row Level Security (RLS) para controle de acesso;
- Supabase Storage para fotos e imagens;
- Vercel Functions para criação segura de usuários;
- Vercel para hospedagem.

## 1. Criar e preparar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Execute todo o conteúdo do arquivo `SUPABASE_SETUP.sql`.
4. Em **Project Settings > API**, copie:
   - Project URL;
   - chave pública `anon` ou `publishable`;
   - chave secreta `service_role`.

A chave `service_role` nunca deve ser colocada em uma variável com prefixo `VITE_` e nunca deve aparecer no código do navegador.

## 2. Configurar autenticação

Em **Authentication > URL Configuration**:

- use o domínio final do Vercel como **Site URL**;
- adicione `http://localhost:5173/**` para testes locais;
- adicione o domínio de produção e, se necessário, os domínios de preview do Vercel em **Redirect URLs**.

O primeiro cadastro feito pela rota `/register` torna-se administrador. Depois disso, novos usuários devem ser criados pela tela **Usuários**.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` durante o desenvolvimento:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
```

No Vercel, cadastre as mesmas três variáveis em **Settings > Environment Variables**.

## 4. Executar localmente

O frontend pode ser iniciado com:

```bash
npm install
npm run dev
```

Para testar também a função `/api/invite-user` localmente, use a CLI do Vercel:

```bash
npx vercel dev
```

## 5. Publicar no Vercel

1. Envie o projeto para um repositório Git.
2. Importe o repositório no Vercel.
3. Cadastre as três variáveis de ambiente.
4. Faça o deploy.
5. Acesse `/register` e crie o primeiro administrador.

## Estrutura de dados

- `profiles`: usuários, funções e status;
- `app_records`: dados operacionais do PDV em JSONB, separados por coleção;
- `mercadoflow-assets`: bucket público para imagens;
- `api/invite-user.js`: função protegida para administradores e gerentes criarem acessos.

## Perfis

- `admin`: acesso completo;
- `gerente`: gestão, relatórios, auditoria e usuários;
- `vendedor`: PDV, estoque, vendas e fiados.

## Observações

- Produtos, vendas e demais registros agora são compartilhados entre dispositivos.
- O tema visual continua salvo localmente apenas como preferência de interface.
- Não publique nem compartilhe a chave `SUPABASE_SERVICE_ROLE_KEY`.
