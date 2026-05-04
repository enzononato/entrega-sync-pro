
## Objetivo

Criar um novo indicador mensal **Relatos de Segurança** (código `RELATOS`), exclusivo para **ajudantes** (`applies_to_worker_type='ajudante'`), com lógica idêntica à do PDV Crítico:

- **Maior é melhor** • Meta: **5** relatos/mês • Desafio: **15** relatos/mês
- Bônus: **R$ 52,50** ao bater meta + **R$ 10,00** extra ao bater desafio (total R$ 62,50)
- Vínculo do colaborador: **CPF** (com fallback para matrícula), só ajudantes
- Linhas com CPF e matrícula iguais a `0` são **ignoradas** (já é coberto pela validação de "sem CPF nem matrícula", mas também filtramos explicitamente o literal `"0"`)
- Mês de referência vem da coluna **"Data Cadastrado"** (formato `dd-mm-aaaa`)

## 1. Banco de dados (migration)

### Tabela `relatos_seguranca` (similar a `pdv_critico_feedbacks`)

```sql
create table public.relatos_seguranca (
  id uuid primary key default gen_random_uuid(),
  -- referência temporal
  data_cadastrado date not null,        -- coluna "Data Cadastrado"
  mes_num int not null,                 -- 1..12
  ano int not null,
  data_referencia date not null,        -- primeiro dia do mês (yyyy-mm-01)
  -- relato
  relato_id text,                       -- coluna "ID" da planilha
  cargo_relatante text,
  revenda text,
  tipo text,
  local text,
  infracao text,
  relato text,
  status text,
  classificacao text,
  prioridade text,
  data_ocorrido date,
  -- pessoa
  cpf text,
  matricula text,
  user_id uuid,                         -- resolvido por CPF/matrícula (só ajudantes)
  unidade_id uuid,
  -- importação
  import_batch_id uuid,
  imported_by uuid,
  created_at timestamptz not null default now()
);

create index on public.relatos_seguranca (user_id, ano, mes_num);
create index on public.relatos_seguranca (cpf);
create index on public.relatos_seguranca (matricula);
create index on public.relatos_seguranca (import_batch_id);

alter table public.relatos_seguranca enable row level security;

-- Admins: acesso total
create policy "Admins full access relatos_seguranca"
on public.relatos_seguranca for all to authenticated
using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

-- Ajudante vê os próprios
create policy "Users read own relatos_seguranca"
on public.relatos_seguranca for select to authenticated
using (user_id = get_user_id(auth.uid()));
```

### Indicator + Goal

```sql
insert into public.indicators (codigo, nome, categoria, descricao, applies_to_worker_type, periodicidade, unidade_medida)
values ('RELATOS', 'Relatos de Segurança', 'Segurança',
        'Quantidade de relatos de segurança cadastrados no mês (maior é melhor).',
        'ajudante', 'mensal', 'relatos')
on conflict do nothing;

insert into public.goals (indicator_id, worker_type, valor_meta, valor_desafio,
                          valor_bonificacao, valor_bonificacao_desafio, periodo_tipo, ativo)
select id, 'ajudante', 5, 15, 52.50, 10.00, 'mensal', true
from public.indicators where codigo = 'RELATOS'
and not exists (select 1 from public.goals g where g.indicator_id = indicators.id and g.worker_type='ajudante' and g.ativo);
```

## 2. Edge function `calculate-monthly-bonus`

Adicionar o id do indicator `RELATOS` ao set `HIGHER_IS_BETTER` (mesmo tratamento do PDV_CRITICO/RATING). Após criar o indicator, leio o id e atualizo o array em `supabase/functions/calculate-monthly-bonus/index.ts` (logo após o id do PDV_CRITICO).

## 3. Componente `src/components/admin/ImportRelatos.tsx` (novo)

Espelhado em `ImportPDVCritico.tsx`, com estas diferenças:

- Aceita `.xlsx`, lê a aba **"Riscos"** (com fallback: primeira aba que tenha as colunas esperadas).
- Mapeia colunas (do upload): `CPF`, `MATRÍCULA`, `ID`, `Data Cadastrado`, `Cargo Relatante`, `Revenda`, `Tipo`, `Local`, `Infração`, `Relato`, `Status`, `Classificação`, `Prioridade`, `Data Ocorrido`.
- Parse de datas em `dd-mm-aaaa` (e Date/serial Excel como fallback).
- Filtros de validade da linha:
  - Ignora se CPF normalizado vazio **ou** `"0"` **e** matrícula vazia **ou** `"0"`.
  - Ignora se `Data Cadastrado` inválida.
- Mês/ano vêm de `Data Cadastrado` (não há campo "Ano" manual — removo o input de ano que existia no PDV).
- Chave de duplicidade: `relato_id` (ID da planilha) quando presente; senão `cpf|data_cadastrado|hash(relato[:60])|local|infracao`.
- Vínculo: busca em `users` por CPF e por matrícula filtrando `worker_type = 'ajudante'`.
- Após o insert, chama `recalcRelatos` (análoga a `recalcPdvCritico`):
  - Conta por `(user_id, ano, mes_num)` os relatos importados.
  - Upsert em `user_indicator_daily` com `mapa_numero='MENSAL'`, `data_referencia` no dia 1 do mês, `meta=5`, `desafio=15`, `status='dentro_meta'` se `valor>=5` e `status_desafio='atingiu'` se `valor>=15`.
- Em seguida invoca `calculate-monthly-bonus` para cada mês afetado.
- UI: card "Relatos Importados" com filtros: busca (nome/CPF/matrícula), filtro de mês (`type=month`), filtro por `Cargo Relatante`. Painel `ImportHistoryPanel tipo="relatos"`.

## 4. `src/pages/admin/Importacoes.tsx`

Adicionar nova aba **"Relatos"** entre "PDV Crítico" e "Histórico", renderizando `<ImportRelatos />`.

## 5. Memória

Criar `mem://logic/relatos-seguranca` com a regra (maior é melhor, ajudante, meta 5/desafio 15, R$52,50 + R$10,00, fonte = aba Riscos coluna "Data Cadastrado", chave de duplicidade) e adicionar referência em `mem://index.md`.

## Pontos que NÃO mudam

- Lógica binária de bônus, fluxo do `calculate-monthly-bonus`, layout das demais abas e RLS de outras tabelas.
- UI de desempenho do colaborador renderiza automaticamente o novo indicador a partir do `status` em `user_indicator_daily` (igual ao PDV).

## Arquivos

- **migration nova**: cria `relatos_seguranca`, RLS, `indicators` e `goals` para `RELATOS`.
- **novo**: `src/components/admin/ImportRelatos.tsx`.
- **editado**: `src/pages/admin/Importacoes.tsx` (nova aba).
- **editado**: `supabase/functions/calculate-monthly-bonus/index.ts` (incluir id do `RELATOS` em `HIGHER_IS_BETTER`).
- **memória**: `mem://logic/relatos-seguranca` + `mem://index.md`.
