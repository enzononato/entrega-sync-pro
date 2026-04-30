## Objetivo

Tornar a importação de Rating um fluxo claramente **mensal**, exigindo **tipo (Motorista/Ajudante)**, **unidade/revenda** e **mês de referência**. Reimportar o mesmo arquivo (mesmo mês + tipo + unidade) deve **atualizar** os valores, não duplicar.

---

## 1. Ajustes na tela de importação (`ImportRating.tsx`)

### Diálogo de importação
Substituir os campos atuais (data início / data fim) por:

- **Tipo de colaborador** (Motorista/Ajudante) — obrigatório, já existe
- **Unidade / Revenda** — obrigatório (Select com unidades cadastradas + opção livre)
- **Mês de referência** — campo `<input type="month">` (formato `AAAA-MM`), obrigatório

Ao importar, internamente convertemos o mês em:
- `data_referencia_inicio` = primeiro dia do mês
- `data_referencia_fim` = último dia do mês

Validações:
- Bloquear import se mês, tipo ou unidade não preenchidos
- Mostrar aviso claro: "Reimportar o mesmo mês/tipo/unidade vai **substituir** os valores existentes"

### Lógica de upsert
Mudar a chave de conflito do upsert para:
```
data_referencia_inicio, worker_type, unidade, matricula
```
Assim, se o admin reimportar a planilha do mesmo mês/tipo/revenda, cada matrícula tem seu valor atualizado em vez de duplicar.

### Tabela de dados importados (lista)
- Trocar a coluna "Período" por **"Mês de referência"** (ex: "Out/2026") para deixar claro que é mensal
- Filtro de data vira filtro de **mês único** (mais simples e coerente com o dado mensal)
- Manter filtros de Tipo, Unidade e busca por matrícula/nome

---

## 2. Banco de dados

A tabela `rating_avaliacoes` já tem todas as colunas necessárias. Precisamos apenas garantir a constraint de unicidade correta para o upsert funcionar.

**Migration:**
1. Remover (se existir) a constraint antiga `(data_referencia_inicio, data_referencia_fim, worker_type, matricula)`
2. Criar nova constraint única:
   ```
   UNIQUE (data_referencia_inicio, worker_type, unidade, matricula)
   ```
   Com `unidade` participando da chave, cada revenda mantém seus próprios valores no mesmo mês.

> Observação: linhas com `unidade IS NULL` não entram na constraint (Postgres trata NULLs como distintos). Por isso a unidade passa a ser **obrigatória** no formulário.

---

## 3. Integração com o indicador mensal Rating

O indicador `RATING` (id `853beb35-...`, aplica a Motorista e Ajudante) já existe. Após cada importação bem-sucedida, vamos popular `user_indicator_daily` com 1 registro por colaborador vinculado:

- `data_referencia` = primeiro dia do mês
- `indicator_id` = id do RATING
- `valor` = `rating` da planilha
- `meta` = `meta` da planilha
- `status` = "atingiu" se `rating >= meta`, senão "nao_atingiu" (binário, conforme regra do projeto)
- `origem_dado` = `'import_rating'`
- Upsert por (`user_id`, `indicator_id`, `data_referencia`) para também atualizar ao reimportar

Colaboradores não vinculados (sem match de matrícula) ficam apenas em `rating_avaliacoes` como histórico, sem gerar indicador (mantém regra atual de não calcular para quem não está cadastrado).

---

## 4. Feedback ao usuário

Após import, toast com:
- Quantos registros foram importados/atualizados
- Quantas matrículas foram vinculadas a usuários
- Quantos indicadores mensais foram gerados/atualizados
- Lista das matrículas não vinculadas (ou link para ver)

---

## Resumo do que muda

| Antes | Depois |
|---|---|
| Período livre (data início + fim) | Mês de referência único |
| Unidade opcional, texto livre | Unidade obrigatória |
| Reimport pode duplicar (chave sem unidade) | Reimport substitui (chave com unidade) |
| Importação só popula `rating_avaliacoes` | Também alimenta `user_indicator_daily` (Rating mensal binário) |

Não mexe em outros importadores nem na tabela `mapa_historico`.