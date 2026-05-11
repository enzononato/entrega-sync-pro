## Contexto

Hoje colaboradores logam por **matrícula + senha**. Confirmei no banco:
- **180 colaboradores ativos**, **162 com CPF**, **18 sem CPF**.
- Todos os 162 CPFs são **únicos** (zero duplicidade).
- Há matrículas duplicadas entre Motorista/Ajudante (ex.: "2", "19", "3005") — confirma o problema relatado.

A boa notícia: a edge function `auth-cpf` **já aceita CPF** como fallback. Ou seja, o backend praticamente já está pronto. A troca é viável e de baixa complexidade — o que precisa é (1) deixar o CPF obrigatório/único no banco, (2) preencher os 18 faltantes, (3) trocar a UI de login, (4) ajustar telas administrativas que pedem matrícula no cadastro.

## Plano

### 1. Banco (migração)
- Adicionar `UNIQUE` em `users.cpf` (parcial, ignorando NULL) para travar duplicidade futura.
- Adicionar índice `users(cpf)` para acelerar o lookup do login.
- **Não** tornar `NOT NULL` ainda — primeiro preencher os 18 faltantes para não quebrar.

### 2. Preencher os 18 colaboradores sem CPF
- Gerar lista (CSV) com nome, matrícula, unidade dos 18 sem CPF para você preencher.
- Você devolve preenchido → atualizo via `insert tool`.
- Depois disso, opcional: tornar `cpf` `NOT NULL` em `users` (apenas para `role='colaborador'` via trigger, já que admins podem não ter).

### 3. Tela de login do colaborador (`LoginColaborador.tsx`)
- Trocar campo "Matrícula" por **"CPF"** com máscara `000.000.000-00`.
- Validar 11 dígitos antes de enviar.
- Enviar `cpf` (não `matricula`) para `auth-cpf` — a function já trata.
- Atualizar copy/placeholder/labels.

### 4. Edge function `auth-cpf`
- Já funciona com CPF. Pequenos ajustes:
  - Normalizar CPF removendo máscara (`replace(/\D/g, '')`) — já faz.
  - Mensagens de erro coerentes ("CPF ou senha inválidos").
  - Continuar registrando em `login_attempts` com `identifier_type='cpf'`.

### 5. Telas administrativas
- `Colaboradores` / cadastro de usuário: tornar **CPF obrigatório** no formulário (hoje é opcional). Matrícula continua existindo (é usada em importações de mapa/PDV/etc.), mas deixa de ser credencial.
- Importador de colaboradores (CSV): validar CPF obrigatório e único.
- `LogsLogin`: garantir que mostra o `identifier_type` corretamente.

### 6. Comunicação aos colaboradores
- Sugerir um aviso/banner no primeiro login pós-mudança ou um comunicado fora do app.
- Senha **não muda** — só o identificador.

### 7. O que NÃO muda
- Login do **administrador** (continua e-mail + senha).
- Importações por **matrícula** continuam funcionando (matrícula segue sendo a chave operacional dos mapas).
- RLS, Supabase Auth, sessões, refresh — tudo igual.

## Riscos & mitigação
- **18 colaboradores sem CPF** → bloqueio de login. Mitigação: preencher antes de publicar a mudança.
- **Colaborador digita CPF errado** → mensagem genérica + log em `login_attempts` (já existe).
- **CPF é dado sensível (LGPD)** → não exibir CPF em listas públicas; só usar como credencial. Já é o padrão hoje.

## Esforço estimado
Pequeno: ~1 migração + ~2 arquivos de front (login + cadastro) + ajuste leve no importador. Se quiser, faço tudo numa só rodada após você confirmar e me devolver os 18 CPFs faltantes (ou autorizar deixar `cpf` opcional por enquanto e bloquear login só de quem não tem).