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
4. `ATENDENTE_SVO` — Triagem de óbitos e controle da quarentena sanitária de viaturas SVO.
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
