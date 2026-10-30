# Desenvolvimento front-end

[Índice da documentação](README.md)

Guia de desenvolvimento front-end do ROTA para o **Squad 19** no programa **Takeoff (Residência Tecnológica)**.
Este documento estabelece os padrões obrigatórios de design, arquitetura de componentes, convenções de código e boas práticas para manter a qualidade e a consistência visual da aplicação.

Os caminhos `src/...` citados neste guia são relativos à pasta `FrontEnd` do projeto. Consulte também a [visão geral](PROJETO.md) e a [identidade visual](IDENTIDADE_VISUAL.md). Os trechos de componentes são exemplos de uso; ajuste imports, dados e callbacks ao módulo em que forem inseridos.

## Responsabilidade do front-end

O front-end organiza as telas, a navegação, os formulários, a apresentação dos dados e os componentes compartilhados. O estado da sessão fica nos contextos, e a comunicação com a API deve respeitar os contratos descritos em [Back-end](BACKEND.md).

## Tecnologias

- **Framework:** React 19 (com hooks modernos e contextos)
- **Linguagem:** TypeScript (modo estrito com `noUnusedLocals: true`)
- **Build Tool:** Vite 8
- **Estilização:** Tailwind CSS v4 (`@tailwindcss/vite` + `@theme`)
- **Tipografia:** `Space Grotesk` (Google Fonts)
- **Ícones:** `lucide-react` (traço padrão `stroke-[1.8]` a `stroke-[2]`)
- **Validação de Formulários:** `react-hook-form` + `zod`

## Organização

```text
FrontEnd/src/
├── App.tsx              Seleção das telas e estrutura autenticada
├── main.tsx             Montagem da aplicação
├── components/common/   Componentes reutilizáveis
├── components/layout/   Cabeçalho e menu lateral
├── contexts/            Estado da sessão e hook de autenticação
├── services/            Cliente HTTP (Axios) com JWT e tratamento de 401
├── pages/               Login, recuperação, dashboard e veículos
├── types/               Tipos de autenticação e navegação
├── lib/                 Utilitários compartilhados
├── assets/              Imagens e identidade da marca
└── index.css            Tailwind, fontes e tokens de interface
```

A seleção das telas fica em `App.tsx`. Os componentes de layout organizam a navegação, e os contextos compartilham informações da sessão. As chamadas à API usam `src/services/api.ts`, que anexa `Authorization: Bearer <token>` e, em `401` fora do login, limpa a sessão. A instalação dos dois workspaces é centralizada na raiz. A URL base da API é `VITE_API_URL` (modelo em `FrontEnd/.env.example`; padrão local `http://localhost:3000`).

## Identidade visual e componentes

### Vocabulário

**Use sempre o termo "Viagem" / "Viagens".** Exemplos: _"Viagens em trânsito"_, _"Nova Solicitação de Viagem"_, _"Histórico de Viagens"_.

### Cores semânticas

Para evitar poluição visual e orientar o atendimento à WCAG AA, os status usam **quatro cores semânticas**. A escolha da paleta não substitui a verificação de contraste e acessibilidade de cada aplicação.

| Status Operacional  |   Cor / Token   | Classes Tailwind Recomendadas                       | Significado na FSPH                                                                                                                      |
| :------------------ | :-------------: | :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Disponível**      |    Esmeralda    | `text-emerald-700 bg-emerald-50 border-emerald-200` | Veículo no pátio pronto para saída.                                                                                                      |
| **Em Trânsito**     |  Azul Cobalto   | `text-blue-700 bg-blue-50 border-blue-200`          | Veículo em trânsito / viagem assistencial.                                                                                               |
| **Pendente**        |      Âmbar      | `text-amber-700 bg-amber-50 border-amber-200`       | Solicitação aguardando despacho do gestor.                                                                                               |
| **Desinfecção SVO** | Carmesim / Rose | `text-rose-700 bg-rose-50 border-rose-200`          | Quarentena sanitária pós-remoção; referência sanitária do briefing na [identidade visual](IDENTIDADE_VISUAL.md#contexto-das-diretrizes). |

### Aplicação da logo ROTA

- Em fundos escuros (como a Sidebar `#090D16`), a logo deve **obrigatoriamente** ficar dentro de um contêiner branco arredondado:
  ```tsx
  <div className="w-11 h-11 rounded-2xl bg-white shadow-md p-2 border border-white/90">
    <img src={rotaSymbol} alt="ROTA" className="w-full h-full object-contain" />
  </div>
  ```
- Os arquivos vetoriais oficiais estão centralizados em:
  `src/assets/branding/rota/` (`rota-symbol-color.svg`, `rota-symbol-dark.svg`, `rota-symbol-white.svg`, `rota-lockup-horizontal.svg`).

## Biblioteca de componentes reutilizáveis

Todos os novos módulos e telas **devem** utilizar os componentes padronizados exportados de `src/components/common`:

```tsx
import { Button, Input, Select, Textarea, Card, Badge, Table, Modal } from "../components/common";
```

### Botões (`<Button />`)

```tsx
// Ação Primária
<Button variant="primary" size="md">Salvar Registro</Button>

// Ação com Ícone e Estado de Carregamento
<Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} isLoading={isSubmitting}>
  Adicionar
</Button>

// Secundário / Cancelar
<Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
```

### Campos de entrada (`<Input />`, `<Select />`, `<Textarea />`)

Sempre possuem gerenciamento visual de rótulo, indicador obrigatório `*`, mensagens de erro integradas e foco padronizado:

```tsx
<Input
  label="Placa do Veículo"
  placeholder="Ex: BRA2E19"
  required
  error={errors.placa?.message}
  {...register('placa')}
/>

<Select
  label="Tipo de Frota"
  required
  options={[
    { value: 'Administrativa', label: 'Frota Geral (LACEN / Hemose)' },
    { value: 'SVO', label: 'Frota Especializada SVO' },
  ]}
/>

<Textarea
  label="Justificativa da Viagem"
  placeholder="Descreva o motivo do deslocamento..."
  rows={3}
/>
```

### Badges de status (`<Badge />`)

```tsx
<Badge variant="success" dot>Disponível</Badge>
<Badge variant="info">Em viagem</Badge>
<Badge variant="warning">Aguardando aprovação</Badge>
<Badge variant="danger">Desinfecção Terminal</Badge>
```

### Tabelas genéricas (`<Table />`)

```tsx
<Table
  columns={[
    { header: "Placa", accessor: "placa" },
    { header: "Modelo", render: (row) => <span className="font-bold">{row.modelo}</span> },
    { header: "Status", render: (row) => <Badge variant="info">{row.status}</Badge> },
  ]}
  data={listaDeVeiculos}
  keyExtractor={(row) => row.id}
  emptyMessage="Nenhum veículo encontrado."
/>
```

## Perfis e permissões

Os cinco perfis estão definidos em `src/types/auth.ts` e representam as seguintes responsabilidades no projeto:

1. `ADMIN` — Acesso irrestrito a configurações, auditoria e usuários.
2. `GESTOR` — Gestor de Frota da FSPH (aprova viagens, escala motoristas e gerencia viaturas).
3. `MOTORISTA` — Condutor oficial (diários de bordo, checklists e viagens atribuídas).
4. `SVO` — Triagem de óbitos e controle da quarentena sanitária de viaturas SVO (nome alinhado à API).
5. `SOLICITANTE` — Setores assistenciais (LACEN, Hemocentro, SES) que solicitam transporte.

### Exibir elementos por perfil

O hook `useAuth` está em `src/contexts/auth.ts` e o provider em `src/contexts/AuthContext.tsx`:

```tsx
import { useAuth } from "../../contexts/auth";

const { hasRole } = useAuth();

{
  hasRole(["ADMIN", "GESTOR"]) && <Button onClick={abrirModalCadastro}>Novo Veículo</Button>;
}
```

Use esse controle para selecionar elementos e menus conforme o perfil. A autorização das operações e a validação das permissões são responsabilidades da API.

## Responsividade e ergonomia

1. **Evite Poluição Visual:** Mantenha telas com espaçamento generoso (`space-y-6`, `p-6` a `p-8`). Não adicione tags ou badges decorativos sem finalidade funcional.
2. **Cards de Métricas:** Sempre estruture em grid responsivo:
   `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4.5`
3. **Sidebar Adaptável:** Em telas menores que `1024px`, a sidebar vira uma gaveta com backdrop. Em telas desktop, ela suporta o modo recolhido (_Rail Mode_) para maximizar o espaço das tabelas.

## Comandos e verificação

Execute os comandos a partir da raiz do projeto antes de enviar qualquer Pull Request ou subir alterações:

```bash
# 1. Iniciar o ambiente de desenvolvimento
npm run dev --workspace=frontend

# 2. Executar a checagem rigorosa de tipos e build de produção
npm run build --workspace=frontend

# 3. Verificar lint e testes do front-end
npm run lint --workspace=frontend
npm test --workspace=frontend

# 4. Verificar os dois projetos antes do PR
npm run check
```

O repositório utiliza verificação estrita de TypeScript (`tsc -b`). Não deixe variáveis ou importações não utilizadas no código (`noUnusedLocals`). Não comite arquivos `.env` ou credenciais.

Veja [Testes](TESTES.md) para os exemplos de componentes e [GitHub](GITHUB.md) para o fluxo de PR da equipe.

## Relatórios

A aba Relatórios consulta `/api/v1/relatorios` para administradores e gestores. O período inicial vai do primeiro dia do mês atual até hoje. Aplicar um período refaz a consulta e invalida os dados anteriores; respostas antigas não substituem o resultado do novo período. A tela apresenta carregamento, falha com nova tentativa e ausência de registros.

A exportação CSV utiliza exclusivamente o resultado do período consultado, com BOM UTF-8, escape de delimitadores/aspas e proteção contra fórmulas de planilha. Ela fica desabilitada quando não existem veículos no relatório. Indicadores ainda não disponíveis aparecem como `—`; os limites de dados estão descritos na tela e no contrato em [Backend](BACKEND.md).

## Usuários

A aba Usuários é restrita a administradores. A consulta de acesso utiliza somente o endpoint existente `GET /api/v1/auth/perfil`, que retorna o identificador e os perfis da sessão autenticada. A tela trata carregamento, falha e nova tentativa, e não apresenta essa resposta como uma lista de usuários.

Não existem endpoints de listagem ou cadastro de usuários no backend atual. Por isso, a tela informa que a gestão está indisponível e desabilita o botão Novo usuário. Não há usuários fictícios, códigos gerados no navegador, cadastro em memória ou chamadas a endpoints inexistentes. Busca, filtro por setor e ações sem implementação foram removidos.

## Veículos: validação e paginação

A tela consulta `GET /api/v1/veiculos` com `page`, `pageSize=10`, `busca` e `tipoFrota`. A busca por placa ou modelo aguarda 300 ms após digitar; mudanças de busca ou frota retornam à primeira página. Respostas antigas são descartadas. Os indicadores de cada frota consultam os totais da API com `pageSize=1` e não contam apenas a página carregada. Falhas de listagem e de contagem são apresentadas separadamente, com nova tentativa.

O cadastro utiliza `POST /api/v1/veiculos` pelo cliente HTTP compartilhado, respeitando `VITE_API_URL` e o tratamento de sessão expirada. O Zod valida placa brasileira (antiga ou Mercosul), modelo entre 2 e 100 caracteres, capacidade inteira de 1 a 50, ano opcional entre 1950 e o ano atual mais um e combustível opcional de até 30 caracteres. Placa e espaços são normalizados antes do envio. Durante o envio, o modal permanece aberto e bloqueia alterações e submissões repetidas. Uma rejeição preserva os dados preenchidos; o sucesso recarrega a listagem e as contagens.

## Solicitações para gestores

Administradores e gestores consultam a mesma tela de solicitações, com visão dos setores. A listagem usa `GET /api/v1/solicitacoes` com paginação de 20 itens e filtros de status, urgência, setor e busca no servidor. O suporte a `setorOrigem` já está presente nesta branch. Os indicadores utilizam `meta.porStatus`, que acompanha os filtros de busca/setor/urgência e não se limita à página atual. O filtro de status só restringe a tabela.

A fila prioritária faz uma consulta independente por pendentes urgentes: mostra até seis registros e o total informado pela API. Os filtros da tabela permitem consultar os demais pedidos. Uma falha dessa consulta é exibida separadamente, sem esconder o resultado da tabela. Alterar filtros invalida o resultado anterior, e respostas de consultas antigas são descartadas.

Listagem e criação utilizam o cliente HTTP compartilhado com `VITE_API_URL` e encerramento de sessão em respostas 401. Erros de validação exibem as mensagens dos campos retornadas pela API. O cadastro preserva o formulário em caso de falha e bloqueia fechamento, alterações e envios repetidos enquanto aguarda a resposta. O setor deve ser escolhido, sem assumir um setor para o usuário.

Nesta branch, as rotas de aprovação e recusa já estão disponíveis e foram conectadas aos botões dos detalhes para administradores e gestores. Aprovar abre a seleção de veículo e motorista; recusar exige justificativa. O sucesso recarrega a tabela e a fila urgente. Respostas de conflito mantêm as seleções para nova tentativa, sem simular uma decisão local.

O modal de aprovação consulta todas as páginas de veículos administrativos disponíveis e os motoristas ativos e disponíveis, com CNH válida até a data local do retorno. Capacidade insuficiente é bloqueada antes do envio e novamente conferida no servidor. Solicitações sem intervalo completo de saída/retorno mostram a limitação e não podem ser aprovadas. A recusa aceita o motivo não vazio, limitado a 2000 caracteres conforme a API, e não depende do carregamento de recursos. Durante uma decisão, edição, fechamento e submissões repetidas ficam bloqueados.

## Motoristas: integração e conta de acesso

A tela usa o cliente HTTP compartilhado em `GET` e `POST /api/v1/motoristas`, respeitando `VITE_API_URL` e a limpeza de sessão em respostas 401. A listagem diferencia falha, carregamento e ausência de resultados; uma nova consulta invalida respostas antigas. A tela aceita status operacionais EM_VIAGEM e EM_ROTA e os apresenta separadamente do campo `ativo` do cadastro.

O cadastro envia os dados da conta que já eram exigidos por esta branch (nome, e-mail, senha e telefone), além de CPF e CNH. A validação segue o contrato existente, normalizando os dados e verificando o limite de 72 bytes da senha. Enquanto aguarda o POST, bloqueia fechamento, edição e novo envio. Falhas preservam o formulário. O sucesso limpa as credenciais preenchidas, fecha o modal e recarrega a lista; uma falha posterior nessa consulta é apresentada como erro de listagem, sem repetir o cadastro.

CNHs válidas até hoje não são consideradas vencidas. Os indicadores excluem cadastros inativos das contagens de vencimento, e o filtro de CNHs vencendo inclui somente as que vencem de hoje até 30 dias, sem misturar CNHs já vencidas. Os dados da API são conferidos antes de formatar as datas.
