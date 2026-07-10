# MercadoFlow PDV

Aplicação web de ponto de venda, estoque, vendas, fiados, relatórios, usuários, configurações e auditoria.

## Executar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Acesse a URL mostrada pelo Vite.

## Acesso inicial

- Email: `admin@mercadoflow.local`
- Senha: `admin123`

Troque os dados do administrador após o primeiro acesso na tela de usuários.

## Publicar no Vercel

1. Envie a pasta para um repositório Git.
2. Importe o repositório no Vercel.
3. O projeto será detectado como Vite e usará o arquivo `vercel.json`.
4. Clique em **Deploy**.

Também é possível instalar a CLI e publicar diretamente:

```bash
npm install -g vercel
vercel
```

## Armazenamento

Esta versão é independente de serviços externos. Os dados ficam no armazenamento local do navegador de cada dispositivo. Isso significa que produtos, vendas e usuários não são compartilhados automaticamente entre computadores ou navegadores.

Para uso multiusuário com banco centralizado, substitua `src/api/client.js` por uma integração com banco de dados e autenticação, mantendo a mesma interface utilizada pelas telas.
