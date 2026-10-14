# 🚑 ROTA · Sistema de Gestão de Frota e SVO (FSPH)

Guia oficial de desenvolvimento front-end para o **Squad 19** no programa **Takeoff (Residência Tecnológica)**.  
Este documento estabelece os padrões obrigatórios de design, arquitetura de componentes, convenções de código e boas práticas para manter a qualidade e a consistência visual da aplicação.

---

## 📌 1. Stack Tecnológica

* **Framework:** React 19 (com hooks modernos e contextos)
* **Linguagem:** TypeScript (modo estrito com `noUnusedLocals: true`)
* **Build Tool:** Vite 8
* **Estilização:** Tailwind CSS v4 (`@tailwindcss/vite` + `@theme`)
* **Tipografia:** `Space Grotesk` (Google Fonts)
* **Ícones:** `lucide-react` (traço padrão `stroke-[1.8]` a `stroke-[2]`)
* **Validação de Formulários:** `react-hook-form` + `zod`

---

## 🎨 2. Identidade Visual & Design System

### 2.1 Regra de Vocabulário Oficial
> [!IMPORTANT]
> **Use sempre o termo "Viagem" / "Viagens".**  
> Exemplos corretos: *"Viagens em trânsito"*, *"Nova Solicitação de Viagem"*, *"Histórico de Viagens"*.

### 2.2 Paleta das 4 Cores Semânticas Estritas
Para evitar poluição visual e garantir acessibilidade (WCAG AA), toda a interface obedece a **4 cores semânticas**:

| Status Operacional | Cor / Token | Classes Tailwind Recomendadas | Significado na FSPH |
| :--- | :---: | :--- | :--- |
| **Disponível** | Esmeralda | `text-emerald-700 bg-emerald-50 border-emerald-200` | Veículo no pátio pronto para saída. |
| **Em Trânsito** | Azul Cobalto | `text-blue-700 bg-blue-50 border-blue-200` | Veículo em trânsito / viagem assistencial. |
| **Pendente** | Âmbar | `text-amber-700 bg-amber-50 border-amber-200` | Solicitação aguardando despacho do gestor. |
| **Desinfecção SVO**| Carmesim / Rose | `text-rose-700 bg-rose-50 border-rose-200` | Quarentena sanitária pós-remoção (Portaria 1.405). |

### 2.3 Regra de Aplicação da Logo ROTA
* Em fundos escuros (como a Sidebar `#090D16`), a logo deve **obrigatoriamente** ficar dentro de um contêiner branco arredondado:
  ```tsx
  <div className="w-11 h-11 rounded-2xl bg-white shadow-md p-2 border border-white/90">
    <img src={rotaSymbol} alt="ROTA" className="w-full h-full object-contain" />
  </div>
  ```
* Os arquivos vetoriais oficiais estão centralizados em:  
  `src/assets/branding/rota/` (`rota-symbol-color.svg`, `rota-symbol-dark.svg`, `rota-symbol-white.svg`, `rota-lockup-horizontal.svg`).

---

## 🧩 3. Biblioteca de Componentes Reutilizáveis

Todos os novos módulos e telas **devem** utilizar os componentes padronizados exportados de `src/components/common`:

```tsx
import { 
  Button, 
  Input, 
  Select, 
  Textarea, 
  Card, 
  Badge, 
  Table, 
  Modal 
} from '../components/common'
```

### 3.1 Botões (`<Button />`)
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

### 3.2 Campos de Entrada (`<Input />`, `<Select />`, `<Textarea />`)
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

### 3.3 Badges de Status (`<Badge />`)
```tsx
<Badge variant="success" dot>Disponível</Badge>
<Badge variant="info">Em viagem</Badge>
<Badge variant="warning">Aguardando aprovação</Badge>
<Badge variant="danger">Desinfecção Terminal</Badge>
```

### 3.4 Tabelas Genéricas (`<Table />`)
```tsx
<Table
  columns={[
    { header: 'Placa', accessor: 'placa' },
    { header: 'Modelo', render: (row) => <span className="font-bold">{row.modelo}</span> },
    { header: 'Status', render: (row) => <Badge variant="info">{row.status}</Badge> },
  ]}
  data={listaDeVeiculos}
  keyExtractor={(row) => row.id}
  emptyMessage="Nenhum veículo encontrado."
/>
```

---

## 🔐 4. Perfis de Usuário & RBAC (Permissões)

O sistema possui 5 perfis de acesso definidos em `src/types/auth.ts`:
1. `ADMIN` — Acesso irrestrito a configurações, auditoria e usuários.
2. `GESTOR` — Gestor de Frota da FSPH (aprova viagens, escala motoristas e gerencia viaturas).
3. `MOTORISTA` — Condutor oficial (diários de bordo, checklists e viagens atribuídas).
4. `ATENDENTE_SVO` — Triagem de óbitos e controle da quarentena sanitária de viaturas SVO.
5. `SOLICITANTE` — Setores assistenciais (LACEN, Hemocentro, SES) que solicitam transporte.

### Como proteger elementos por perfil:
```tsx
const { hasRole } = useAuth()

{hasRole(['ADMIN', 'GESTOR']) && (
  <Button onClick={abrirModalCadastro}>Novo Veículo</Button>
)}
```

---

## 📱 5. Responsividade & Ergonomia

1. **Evite Poluição Visual:** Mantenha telas com espaçamento generoso (`space-y-6`, `p-6` a `p-8`). Não adicione tags ou badges decorativos sem finalidade funcional.
2. **Cards de Métricas:** Sempre estruture em grid responsivo:
   `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4.5`
3. **Sidebar Adaptável:** Em telas menores que `1024px`, a sidebar vira uma gaveta com backdrop. Em telas desktop, ela suporta o modo recolhido (*Rail Mode*) para maximizar o espaço das tabelas.

---

## ⚙️ 6. Comandos e Validação de Código

Antes de enviar qualquer Pull Request ou subir alterações:

```bash
# 1. Iniciar o ambiente de desenvolvimento
npm run dev

# 2. Executar a checagem rigorosa de tipos e build de produção
npm run build
```

> [!WARNING]
> O repositório utiliza verificação estrita de TypeScript (`tsc -b`). Não deixe variáveis ou importações não utilizadas no código (`noUnusedLocals`).
> **Nunca comite arquivos `.env` ou credenciais.**
