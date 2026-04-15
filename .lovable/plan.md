

## Diagnóstico

A investigação revelou a causa raiz da duplicação visual:

1. A importação 031805 (TX_REPOSICAO) associa um `mapa_numero` a cada registro, mas em muitos casos esse número de mapa **não corresponde a nenhum mapa com indicadores regulares** para o mesmo colaborador.

2. Isso cria grupos de mapa "fantasma" na UI — mapas que aparecem com apenas TX_REPOSICAO, enquanto os indicadores regulares do mesmo dia estão em outro mapa.

3. Exemplos encontrados no banco: IRONILDO (mapa 247563), WASHINGTON (mapa 247622), FABIO (mapa 247927), RONALDO (mapa 247926) — todos com TX_REPOSICAO-only e zero indicadores regulares.

4. A lógica de placeholder na linha 103 já pula esses grupos para injeção de placeholders, mas **eles ainda são renderizados** como seções visuais separadas.

## Plano de Correção

### Arquivo: `src/pages/admin/Desempenho.tsx`

**Mudança única**: Após o loop de preenchimento de placeholders (linhas 96-129), adicionar um passo de limpeza que **remove** grupos de mapa que contenham apenas TX_REPOSICAO (sem indicadores regulares). Os dados de TX_REPOSICAO desses grupos órfãos serão realocados para o mapa mais próximo (por data) do mesmo colaborador, ou simplesmente ocultados se não houver mapa próximo.

```text
Lógica proposta:
1. Para cada user, iterar sobre os mapas
2. Identificar mapas cujas rows são ALL TX_REPOSICAO
3. Tentar mover essas rows para outro mapa do mesmo user 
   que tenha o mapa_numero mais próximo numericamente
4. Se não houver outro mapa, remover o grupo (TX_REPOSICAO 
   sem mapa correspondente não será exibido)
```

Isso resolve tanto a duplicação visual quanto a inconsistência de mapas com indicadores diferentes.

