---
name: Security Access
description: RLS roles, admin user_units restrictions, per-unit isolation
type: feature
---
RLS-based per-unit isolation for administrators.

- Functions: `admin_can_access_unit(unit_id)` and `admin_can_access_user(user_id)` (SECURITY DEFINER).
- Super-admin = administrador with NO rows in `user_units`. Sees and edits everything.
- Restricted admin = administrador with rows in `user_units`. Only sees/edits data of those units.
- Tables enforced per-unit: users, user_units, user_roles, routes, units, goals, feedbacks, relatos_seguranca, pdv_critico_feedbacks, rating_avaliacoes, mapa_historico, refugo_031134, reposicao_031805, user_indicator_daily, user_incentives_daily, incentive_deductions, root_cause_records, action_plans, audit_logs (by changed_by user's unit), login_attempts (by user_id's unit; null user_id visible to all admins), import_batches (own + admins sharing units), incentive_rules (by unidade_id; null = global visible to all).
- Indicators (catalog): read open to all authenticated; write restricted to super-admins only (`is_super_admin()`).
- Helpers: `admin_can_access_unit`, `admin_can_access_user`, `admin_can_access_auth_user`, `is_super_admin`.
- Assign admin to units in `/admin/usuarios` via "Revendas" checkboxes (writes to `user_units`).

**Why:** Frontend filtering alone is not security. RLS at DB level enforces isolation even on direct API calls or edge functions.
**How to apply:** Just use normal supabase queries — RLS handles filtering automatically. No client-side filter needed for isolation, but UI selects should still use `useAllowedUnits` for UX.