-- Atualiza chave de duplicidade do PDV Crítico para incluir data_analise e tmr
DROP INDEX IF EXISTS public.pdv_critico_feedbacks_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS pdv_critico_feedbacks_uniq
  ON public.pdv_critico_feedbacks (
    COALESCE(cpf, ''),
    mes_num,
    ano,
    COALESCE(semana, 0),
    COALESCE(codigo_cliente, ''),
    md5(COALESCE(comentario, '')),
    COALESCE(data_analise, '1900-01-01'::date),
    COALESCE(tmr, -1)
  );