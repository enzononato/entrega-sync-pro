-- Clean up TX_DEVOLUCAO records incorrectly saved for ajudantes
DELETE FROM user_indicator_daily
WHERE indicator_id = 'c4fdd7a6-27f3-4d46-a378-1242bdb556aa'
AND user_id IN (
  SELECT id FROM users WHERE worker_type = 'ajudante'
);