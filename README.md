# Mercadinho Alameda das Arvores - PDV

Sistema PDV criado do zero para deploy na Vercel, com frontend em Next.js e persistencia em Postgres via API serverless.

## Requisitos

- Node.js 20+
- Projeto na Vercel
- Banco Postgres vinculado ao projeto com `POSTGRES_URL` ou `DATABASE_URL`

## Rodar localmente

```bash
npm install
npm run dev
```

Sem uma URL de Postgres configurada, o login exibira aviso de banco nao configurado. O sistema nao usa `localStorage` para persistir vendas, produtos, usuarios, fiados ou auditoria.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Vincule um banco Postgres/Neon ao projeto.
3. Garanta que a variavel `POSTGRES_URL` ou `DATABASE_URL` esteja disponivel.
4. Faça o deploy.

Na primeira chamada de login, a rota `/api/bootstrap` cria as tabelas e insere dados iniciais.

## Acessos iniciais

- Gerente: `gerente@alameda.com`
- Vendedor: `vendedor@alameda.com`
- Senha: `123456`

## Funcionalidades implementadas

- Login por perfil de gerente e vendedor
- PDV com busca de produto, carrinho, desconto e pagamentos
- Venda fiado com responsavel obrigatorio
- Vendas minimizadas persistidas no banco
- Cadastro rapido e cadastro completo de produtos
- Produtos com ou sem codigo de barras
- Estoque com codigo interno automatico
- Historico de vendas com permissao por vendedor/gerente
- Quitacao de fiados respeitando permissao
- Auditoria de vendas, cancelamentos, fiados e alteracoes de preco
- Relatorios gerenciais com indicadores e insights
- Interface escura inspirada nas referencias e usando a logo enviada
