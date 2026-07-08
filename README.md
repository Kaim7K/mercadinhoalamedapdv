# Mercadinho Alameda das Arvores - PDV

Sistema PDV criado do zero para deploy na Vercel, com frontend em Next.js e persistencia em Postgres via API serverless.

## Requisitos

- Node.js 20+
- Projeto na Vercel
- Banco Neon/Postgres vinculado ao projeto com `DATABASE_URL`

## Rodar localmente

```bash
npm install
npm run dev
```

Para testar sem banco, rode localmente sem `DATABASE_URL`. O sistema entra automaticamente em modo demo local. Nesse modo, os dados ficam em memoria no servidor de desenvolvimento e somem ao reiniciar o servidor. O sistema nao usa `localStorage` para persistir vendas, produtos, usuarios, fiados ou auditoria.

Na Vercel, o sistema detecta o ambiente e espera `DATABASE_URL`. Se a variavel existir, usa o banco real. Se nao existir, exibe o aviso de banco nao configurado.

Para forcar manualmente, use `DEMO_MODE=true` ou `DEMO_MODE=false`.

## Deploy na Vercel

1. Importe este repositorio na Vercel.
2. Vincule um banco Neon/Postgres ao projeto.
3. Garanta que a variavel `DATABASE_URL` esteja disponivel.
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
