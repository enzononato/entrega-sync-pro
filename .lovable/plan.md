
## Objetivo

Adicionar uma terceira aba **"Rating"** em `/admin/importacoes` para importar os arquivos `Planificador_Motorista.xlsx` e `Planificador_Ajudante.xlsx`, que trazem as avaliações de PDVs (NPS: Promotor / Neutro / Detrator) por colaborador, com nota final (Rating).

## Estrutura dos arquivos analisados

Ambos os XLSX têm o mesmo formato (13 colunas):

| Coluna | Descrição |
|---|---|
| Código | Matrícula do colaborador |
| Nome Motorista/Ajudante | Nome |
| Avaliações | Total de avaliações recebidas |
| PDV | Quantidade de pontos de venda atendidos |
| Promotor / Neutro / Detrator | Contagem de cada tipo |
| % Promotor / % Neutro / % Detrator | Percentuais |
| Rating | Nota final (0 a 5) |
| Meta | Meta da empresa |
| GAP | Diferença para a meta |

Há também filtros de data (período da avaliação) e revenda (UNB) no rodapé do arquivo, que precisarão ser informados manualmente pelo usuário no momento da importação.

## Mudanças

### 1. Banco de dados — nova tabela `rating_avaliacoes`

```sql
create table public.rating_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  data_referencia_inicio date not null,
  data_referencia_fim date not null,
  worker_type text not null,           -- 'motorista' ou 'ajudante'
  matricula text not null,
  nome text,
  avaliacoes int default 0,
  pdv int default 0,
  promotor int default 0,
  neutro int default 0,
  detrator int default 0,
  pct_promotor numeric default 0,
  pct_neutro numeric default 0,
  pct_detrator numeric default 0,
  rating numeric default 0,
  meta numeric default 0,
  gap numeric default 0,
  unidade text,                         -- ex: "Revalle Juazeiro"
  user_id uuid,                         -- FK lookup por matrícula
  imported_by uuid,
  created_at timestamptz not null default now(),
  unique (data_referencia_inicio, data_referencia_fim, worker_type, matricula)
);
```

RLS: admins acesso total; usuários leem apenas suas próprias linhas (`user_id = get_user_id(auth.uid())`).

### 2. Novo componente `src/components/admin/ImportRating.tsx`

- Card com listagem dos dados já importados (DataTable + filtros: busca, intervalo de datas, worker_type, unidade).
- Botão "Importar Planilha" que abre dialog com:
  - Seletor de **tipo** (Motorista / Ajudante)
  - Campos de **período** (data início / data fim)
  - Campo opcional de **unidade/revenda** (default "Revalle Juazeiro")
  - Upload de arquivo `.xlsx` (parse com `xlsx` lib — já presente no projeto, ou adicionar `bun add xlsx`)
- Pula linhas "Total" e linhas sem código.
- Faz lookup de `users` por `matricula` para preencher `user_id`.
- Upsert em lote com `onConflict: 'data_referencia_inicio,data_referencia_fim,worker_type,matricula'`.
- Toast com quantidade de matrículas vinculadas vs total.

### 3. Atualizar `src/pages/admin/Importacoes.tsx`

- Adicionar terceiro `<TabsTrigger value="rating">Rating</TabsTrigger>` e `<TabsContent>` correspondente.

## Pontos a confirmar

1. **Rating como indicador**: por enquanto, os dados ficam apenas armazenados/visualizados na tela de importação. Não vou criar automaticamente um indicador "Rating" no `indicators` nem integrar ao cálculo de bônus/metas — isso pode ser feito em uma etapa seguinte se desejar.
2. **Período**: os arquivos não têm a data por linha, apenas o período aplicado no filtro do relatório. Por isso o usuário informa o intervalo (início/fim) no momento do upload.
