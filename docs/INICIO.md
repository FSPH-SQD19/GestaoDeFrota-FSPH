# Como iniciar o projeto

Execute os comandos na raiz do projeto.

## Comandos npm

```bash
# Instalar as dependências do front-end e do back-end
npm ci

# Rodar os dois juntos
npm run dev

# Rodar somente o front-end
npm run dev:frontend

# Rodar somente o back-end
npm run dev:backend

# Rodar os testes dos dois
npm test

# Verificar o lint dos dois
npm run lint

# Gerar o build dos dois
npm run build

# Executar lint, testes e build
npm run check
```

## Como o sistema é separado

```text
GestaoDeFrota-FSPH/
├── FrontEnd/          Interface: telas e componentes em React
├── BackEnd/           API: rotas, regras e acesso ao banco com Prisma
├── docs/              Documentação
├── node_modules/      Dependências compartilhadas
├── package.json       Comandos para os dois projetos
└── package-lock.json  Versões das dependências
```

A raiz usa **npm workspaces** para instalar e executar os dois projetos. Cada pasta tem seu próprio `package.json`, e as instalações são feitas pela raiz.

- **Front-end:** abre normalmente em `http://localhost:5173`.
- **Back-end:** responde normalmente em `http://localhost:3000`; a rota `/health` indica se a API está funcionando.

Para encerrar os processos iniciados por `npm run dev`, pressione `Ctrl+C` no terminal.

