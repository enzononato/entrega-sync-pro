-- Drop existing triggers to avoid conflicts, then recreate
DROP TRIGGER IF EXISTS audit_action_plans ON public.action_plans;
DROP TRIGGER IF EXISTS audit_feedbacks ON public.feedbacks;
DROP TRIGGER IF EXISTS audit_goals ON public.goals;
DROP TRIGGER IF EXISTS audit_incentive_deductions ON public.incentive_deductions;
DROP TRIGGER IF EXISTS audit_incentive_rules ON public.incentive_rules;
DROP TRIGGER IF EXISTS audit_indicators ON public.indicators;
DROP TRIGGER IF EXISTS audit_root_cause_records ON public.root_cause_records;
DROP TRIGGER IF EXISTS audit_routes ON public.routes;
DROP TRIGGER IF EXISTS audit_units ON public.units;
DROP TRIGGER IF EXISTS audit_user_indicator_daily ON public.user_indicator_daily;
DROP TRIGGER IF EXISTS audit_users ON public.users;
DROP TRIGGER IF EXISTS notify_below_target_trigger ON public.user_indicator_daily;
DROP TRIGGER IF EXISTS notify_feedback_responded_trigger ON public.feedbacks;

CREATE TRIGGER audit_action_plans AFTER INSERT OR UPDATE OR DELETE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_feedbacks AFTER INSERT OR UPDATE OR DELETE ON public.feedbacks FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_goals AFTER INSERT OR UPDATE OR DELETE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_incentive_deductions AFTER INSERT OR UPDATE OR DELETE ON public.incentive_deductions FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_incentive_rules AFTER INSERT OR UPDATE OR DELETE ON public.incentive_rules FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_indicators AFTER INSERT OR UPDATE OR DELETE ON public.indicators FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_root_cause_records AFTER INSERT OR UPDATE OR DELETE ON public.root_cause_records FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_routes AFTER INSERT OR UPDATE OR DELETE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_units AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_user_indicator_daily AFTER INSERT OR UPDATE OR DELETE ON public.user_indicator_daily FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER notify_below_target_trigger AFTER INSERT OR UPDATE ON public.user_indicator_daily FOR EACH ROW EXECUTE FUNCTION public.notify_below_target();
CREATE TRIGGER notify_feedback_responded_trigger AFTER UPDATE ON public.feedbacks FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_responded();