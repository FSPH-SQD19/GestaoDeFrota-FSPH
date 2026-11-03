# Prompts — Regras de Negócio e Serviço de Verificação de Óbito (PRM-02)

Este documento registra os prompts utilizados para traduzir as particularidades sanitárias e operacionais do **Serviço de Verificação de Óbito (SVO)** da FSPH em regras de negócio no sistema **ROTA**.

---

## 1. Prompt de Triagem Telefônica e Critérios de Elegibilidade (SVO vs. IML)

### Versão: `v3.0`

#### Contexto Operacional:

O SVO atende exclusivamente **óbitos de causa natural** (sem assistência médica ou com causa mal definida). Casos com suspeita de causa externa (trauma, acidente, agressão, suicídio, afogamento, envenenamento) são de competência exclusiva do **Instituto Médico Legal (IML)** da Polícia Científica. Encaminhar um caso de causa externa ao SVO constitui infração legal e sanitária grave.

#### Prompt Utilizado:

```markdown
Atue como Especialista em Protocolos Sanitários do Sistema Único de Saúde (SUS) e Regulação de Óbitos do SVO Estadual de Sergipe (FSPH).

Você receberá um relato com as circunstâncias do óbito colhidas durante o acionamento telefônico por hospitais ou familiares.

REGRAS DE CLASSIFICAÇÃO:

1. ELEGÍVEL_SVO:
   - Óbito domiciliar ou hospitalar decorrente de causas naturais (parada cardiorrespiratória por patologia crônica, senilidade, AVC, IAM) sem assistência médica recente ou com médico solicitando verificação diagnóstica.
2. ENCAMINHAMENTO_IML (Recusa SVO):
   - Qualquer indício de violência, queda da própria altura com fratura prévia ao óbito, acidente de trânsito, lesão por arma de fogo/branca, intoxicação exógena aguda, asfixia, queimadura ou ossada.
3. INSUFICIENCIA_DADOS:
   - Quando não constar idade, circunstâncias do falecimento ou presença de Declaração de Óbito (DO).

FORMATO DE RESPOSTA (JSON Estruturado):
{
"classificacao": "ELEGIVEL_SVO" | "ENCAMINHAMENTO_IML" | "INSUFICIENCIA_DADOS",
"justificativaTecnica": "string concisa citando as portarias vigentes",
"prioridadeAtendimento": "BAIXA" | "MEDIA" | "ALTA" | "URGENTE",
"orientacoesAoAtendente": ["lista de perguntas adicionais ou orientação para acionar o 190/IML"],
"documentosExigidos": ["Documento com foto do falecido", "Declaração de óbito ou boletim médico"]
}
```

---

## 2. Prompt de Alocação de Viatura SVO e Capacidade Operacional

### Versão: `v2.2`

#### Contexto:

As viaturas de remoção do SVO (ex: Chevrolet S10 cabine dupla adaptada com baú isotérmico) possuem capacidade máxima de **4 urnas/corpos**. Após cada transporte de corpos, a viatura deve obrigatoriamente entrar em status `DESINFECCAO` por protocolo sanitário da ANVISA antes de ser liberada novamente como `DISPONIVEL`.

#### Prompt Utilizado:

```markdown
Implemente a função `alocarViaturaOrdemColeta` dentro de `svo_s.ts`.

REGRAS DE NEGÓCIO DA FSPH:

1. Uma viatura só pode ser designada para um chamado se:
   - status === 'DISPONIVEL' (viaturas em 'DESINFECCAO', 'MANUTENCAO' ou 'INATIVO' geram AppError 400).
   - documentos (CRLV e Vistoria) estejam vigentes.
2. Controle de Capacidade:
   - Se for um chamado múltiplo ou rota agrupada, a soma de 'quantidadeCorpos' na rota ativa da viatura NÃO pode ultrapassar 4.
3. Conclusão da Coleta:
   - Ao finalizar a entrega no prédio do SVO, o status da viatura transita automaticamente para 'DESINFECCAO'.
   - O sistema deve registrar dataHoraInicioDesinfeccao e bloquear despacho até que o operador registre 'concluirDesinfeccao'.
```
