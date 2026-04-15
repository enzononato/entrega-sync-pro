

## Plano: Recalcular indicadores para aplicar meta TX_DEVOLUCAO aos ajudantes

### O que já está correto
- A meta de TX_DEVOLUCAO para ajudante (5%, diário) já existe no banco
- O código da Edge Function já carrega metas por worker_type e calcula TX_DEVOLUCAO para ajudantes
- A fórmula é: `(1 - cx_entreg / cx_carreg) * 100` — valores ≤ 5% = dentro da meta

### Ação necessária
1. **Invocar a Edge Function `calculate-daily-indicators`** para recalcular todos os indicadores
   - Isso vai reprocessar todos os mapas e aplicar a meta de 5% ao status dos ajudantes
   - Os registros de `user_indicator_daily` serão recriados com o status correto

### Detalhes técnicos
- Chamar `calculate-daily-indicators` sem parâmetro `data_referencia` para processar todas as datas disponíveis
- A função já deleta registros antigos antes de inserir os novos, garantindo dados limpos

