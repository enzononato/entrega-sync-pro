CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_unique_idx
  ON public.users (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

CREATE INDEX IF NOT EXISTS users_cpf_lookup_idx
  ON public.users (cpf);