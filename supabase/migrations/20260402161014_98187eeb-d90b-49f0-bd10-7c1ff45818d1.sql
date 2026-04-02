
DELETE FROM user_units WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM user_indicator_daily WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM user_incentives_daily WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM incentive_deductions WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM feedbacks WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM root_cause_records WHERE user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM action_plans WHERE responsavel_user_id IN (SELECT id FROM users WHERE role = 'colaborador');
DELETE FROM user_roles WHERE user_id IN (SELECT auth_user_id FROM users WHERE role = 'colaborador');
DELETE FROM users WHERE role = 'colaborador';
