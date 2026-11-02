# ROTA — Gestão de Frota e SVO

Projeto do **Squad 19**, desenvolvido para a Fundação de Saúde Parreiras Horta (FSPH) no programa Takeoff — Residência em Software e IA.

A documentação está organizada em [docs/README.md](docs/README.md), com guias de execução, desenvolvimento, testes, CI e trabalho da equipe.

## Início rápido

Configure a conexão Neon de desenvolvimento em `BackEnd/.env` conforme o [guia de ambiente](docs/AMBIENTE.md). Depois, na raiz, com uma versão de Node.js compatível com o `package.json`:

```bash
npm ci
npm exec --workspace=backend -- prisma migrate deploy
npm run dev
```

- Interface: http://localhost:5173
- API: http://localhost:3000/health

Consulte [início](docs/INICIO.md) para os comandos e [ambiente](docs/AMBIENTE.md) para configurar banco, variáveis e Docker.

## Sobre o projeto

O ROTA reúne a gestão da frota administrativa e das operações do SVO, com interface web, API e banco de dados.

O contexto, o escopo, as regras de negócio, a equipe e a licença estão na [visão geral do projeto](docs/PROJETO.md).
