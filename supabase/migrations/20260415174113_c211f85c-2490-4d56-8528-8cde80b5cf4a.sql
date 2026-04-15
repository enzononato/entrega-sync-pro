DELETE FROM user_indicator_daily
WHERE indicator_id = 'c4c40e3e-f23b-46ce-a576-885c610f2df7'
  AND origem_dado = 'reposicao_031805'
  AND user_id IN (
    SELECT id FROM users WHERE worker_type = 'ajudante'
  );