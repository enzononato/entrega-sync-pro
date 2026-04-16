

# Auditoria Completa do Sistema - Problemas Encontrados

## Resumo dos Problemas

Encontrei **5 problemas** no fluxo de dados, sendo 2 críticos:

---

### PROBLEMA 1 (CRITICO) - Perda de dados TX_REPOSICAO ao recalcular

Na edge function `calculate-daily-indicators`, a exclusao de registros TX_REPOSICAO (linhas 388-394) **nao filtra por data**. Isso significa que ao recalcular apenas os ultimos 7 dias (comportamento padrao do botao "Recalcular Indicadores"):

1. O sistema busca registros de reposicao filtrados pelas datas solicitadas
2. Deleta **TODOS** os registros TX_REPOSICAO historicos do usuario (sem filtro de data)
3. Re-insere apenas os das datas filtradas

**Resultado**: dados de meses anteriores sao apagados permanentemente.

**Correcao**: Adicionar filtro de data no delete de TX_REPOSICAO, similar ao que ja e feito para os indicadores de mapa.

---

### PROBLEMA 2 (CRITICO) - TX_DEVOLUCAO calculado para Ajudantes

A regra de negocio diz: "Ajudantes sao avaliados apenas em metricas de tempo (TML, TR, TI, JL)". Porem:

- O edge function so exclui `DISP_TEMPO` para ajudantes (conjunto `MOTORISTA_ONLY`)
- TX_DEVOLUCAO esta sendo calculado e salvo para ajudantes (404 registros no banco)
- A tabela `indicators` confirma que TX_DEVOLUCAO deveria ser `motorista` only, mas esta como `motorista,ajudante`

**Correcao**: Adicionar `TX_DEVOLUCAO` ao conjunto `MOTORISTA_ONLY` no edge function.

---

### PROBLEMA 3 (MEDIO) - Upsert conflict key inconsistente

O `useCreateLancamento` usa `onConflict: 'user_id,indicator_id,data_referencia'`, mas a constraint unica real e `(user_id, indicator_id, data_referencia, mapa_numero)`. Lancamentos manuais sem mapa_numero podem falhar ou criar duplicatas inesperadas.

**Correcao**: Atualizar o onConflict para incluir `mapa_numero`.

---

### PROBLEMA 4 (MEDIO) - mapaDateLookup carrega TODA a tabela mapa_historico

Toda vez que a edge function roda, ela faz um full scan de `mapa_historico` (290 registros agora, mas cresce a cada importacao) so para montar o lookup de datas para TX_REPOSICAO. Com milhares de mapas, isso pode causar timeout novamente.

**Correcao**: Filtrar o lookup apenas pelos mapas presentes nos dados de reposicao sendo processados.

---

### PROBLEMA 5 (BAIXO) - Import 03.18.05 envia datas erradas para recalculo

O import da 03.18.05 envia `data_solicitacao` para o recalculo, mas o edge function processa mapas por `data_operacao`. Se as datas sao diferentes (como ja foi detectado antes), os indicadores de mapa nao sao reprocessados.

**Correcao**: Na importacao da 03.18.05, alem das datas de solicitacao, buscar as `data_operacao` dos mapas relacionados e incluir ambas.

---

## Plano de Implementacao

### Passo 1 - Corrigir edge function `calculate-daily-indicators`
- Adicionar `TX_DEVOLUCAO` ao `MOTORISTA_ONLY` (Problema 2)
- Adicionar filtro de data no delete de TX_REPOSICAO (Problema 1)
- Otimizar mapaDateLookup para buscar apenas mapas relevantes (Problema 4)

### Passo 2 - Corrigir Import031805 
- Ao recalcular, incluir tambem as `data_operacao` dos mapas referenciados (Problema 5)

### Passo 3 - Corrigir useDesempenho.ts
- Atualizar onConflict para incluir `mapa_numero` (Problema 3)

### Passo 4 - Limpeza de dados
- Rodar SQL para remover registros TX_DEVOLUCAO indevidos de ajudantes

### Passo 5 - Recalcular tudo
- Apos as correcoes, fazer um recalculo completo para corrigir dados historicos

---

## Detalhes Tecnicos

```text
Fluxo atual:
CSV 2art → mapa_historico → calculate-daily-indicators → user_indicator_daily
CSV 03.18.05 → reposicao_031805 → calculate-daily-indicators → user_indicator_daily

Problemas no fluxo:
[mapa_historico] ──→ TML, TR, TI, JL, TX_DEVOLUCAO, DISP_TEMPO ──→ OK (exceto TX_DEV para ajudantes)
[reposicao_031805] ──→ TX_REPOSICAO ──→ Delete sem filtro de data = PERDA DE DADOS
```

