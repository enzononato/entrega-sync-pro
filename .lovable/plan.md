

## Plano: Página "Mapas" com importação de planilha de operação

### Contexto
A planilha tem 43 colunas (separador `;`) com dados de operação de entrega: data, veículo, placa, mapa, motorista (CdMot), ajudantes (CdAju1, CdAju2), caixas, km, tempos, etc. A tabela `mapa_historico` atual tem apenas 10 colunas e precisa ser expandida para acomodar todos esses dados.

### Colunas da planilha
Data, Transp, Entrega, CargaAtual, Frota, CustoSpot, Regiao, Veiculo, Placa, Mapa, Capac., Entregas, CxCarreg, CxEntreg, Ocup., CxRota, CxAS, VeicBM, RShow, EntrVol, HrSai, HrEntr, KmSai, KmEntr, KmPrev, TempoPrev, VlPtoMot, VlPtoAjd, VlEqMot, VlEqAjd, CdMot, CdAju1, CdAju2, KmDesloc, KmLaco, TmpoDesloc, TmpoLaco, TmpoInterno, MotNaoCarr, CxCarrCom, CapacidadeVeiculoKG, PesoCargaKG, ClassificacaoRoadshow, ClassificacaoRoads

### Mudancas

#### 1. Renomear pagina
- `Sidebar.tsx`: trocar "Histórico Mapas" por "Mapas"
- `HistoricoMapas.tsx`: trocar titulo do PageHeader para "Mapas"

#### 2. Migração do banco - recriar tabela `mapa_historico`
Dropar e recriar a tabela com todas as colunas da planilha (a tabela ja foi limpa previamente). Colunas mapeadas:

| Coluna CSV | Coluna DB | Tipo |
|---|---|---|
| Data | data_operacao | date |
| Transp | transp | int |
| Entrega | entrega | text |
| CargaAtual | carga_atual | text |
| Frota | frota | text |
| CustoSpot | custo_spot | numeric |
| Regiao | regiao | text |
| Veiculo | veiculo | text |
| Placa | placa | text |
| Mapa | mapa | text |
| Capac. | capacidade | numeric |
| Entregas | entregas | int |
| CxCarreg | cx_carreg | numeric |
| CxEntreg | cx_entreg | numeric |
| Ocup. | ocupacao | numeric |
| CxRota | cx_rota | numeric |
| CxAS | cx_as | numeric |
| VeicBM | veic_bm | numeric |
| RShow | rshow | numeric |
| EntrVol | entr_vol | text |
| HrSai | hr_sai | text |
| HrEntr | hr_entr | text |
| KmSai | km_sai | numeric |
| KmEntr | km_entr | numeric |
| KmPrev | km_prev | numeric |
| TempoPrev | tempo_prev | text |
| VlPtoMot | vl_pto_mot | numeric |
| VlPtoAjd | vl_pto_ajd | numeric |
| VlEqMot | vl_eq_mot | numeric |
| VlEqAjd | vl_eq_ajd | numeric |
| CdMot | cd_mot | text |
| CdAju1 | cd_aju1 | text |
| CdAju2 | cd_aju2 | text |
| KmDesloc | km_desloc | numeric |
| KmLaco | km_laco | numeric |
| TmpoDesloc | tmpo_desloc | text |
| TmpoLaco | tmpo_laco | text |
| TmpoInterno | tmpo_interno | text |
| MotNaoCarr | mot_nao_carr | numeric |
| CxCarrCom | cx_carr_com | numeric |
| CapacidadeVeiculoKG | capacidade_veiculo_kg | numeric |
| PesoCargaKG | peso_carga_kg | numeric |
| ClassificacaoRoadshow | classificacao_roadshow | text |
| ClassificacaoRoads | classificacao_roads | text |

Manter RLS policies existentes (admin full access, users read own).

#### 3. Criar componente `ImportMapasDialog.tsx`
- Upload de CSV (separador `;`)
- Parser client-side que mapeia as 43 colunas para a tabela
- Tratar decimais com `,` (padrão BR) convertendo para `.`
- Tratar datas no formato `DDMMYYYY` convertendo para `YYYY-MM-DD`
- Preview dos dados antes de importar
- Inserir via Supabase SDK em batches

#### 4. Atualizar pagina `HistoricoMapas.tsx`
- Botao "Importar" que abre o dialog
- Hook `useMapas` para buscar dados da tabela
- Exibir dados com `DataTable` (colunas principais: Data, Mapa, Veículo, Placa, CdMot, CdAju1, CdAju2, Entregas, CxEntreg, HrSai, HrEntr)
- Filtros por data e busca textual

### Arquivos modificados/criados
- `src/components/admin/Sidebar.tsx` (renomear)
- `src/pages/admin/HistoricoMapas.tsx` (reescrever)
- `src/components/admin/ImportMapasDialog.tsx` (novo)
- `src/hooks/useMapas.ts` (novo)
- Migration SQL (recriar tabela `mapa_historico`)

