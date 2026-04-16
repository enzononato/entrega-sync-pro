ALTER TABLE public.reposicao_031805
  ADD CONSTRAINT reposicao_031805_solicitacao_produto_unique
  UNIQUE (solicitacao_reposicao, produto);