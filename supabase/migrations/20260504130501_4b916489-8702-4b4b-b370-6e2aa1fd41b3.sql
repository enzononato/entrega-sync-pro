
-- Habilita pg_net para chamadas HTTP a partir de triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tabela de inscrições push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access push_subscriptions"
ON public.push_subscriptions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own push_subscriptions"
ON public.push_subscriptions
FOR SELECT TO authenticated
USING (user_id = get_user_id(auth.uid()));

CREATE POLICY "Users insert own push_subscriptions"
ON public.push_subscriptions
FOR INSERT TO authenticated
WITH CHECK (user_id = get_user_id(auth.uid()));

CREATE POLICY "Users update own push_subscriptions"
ON public.push_subscriptions
FOR UPDATE TO authenticated
USING (user_id = get_user_id(auth.uid()))
WITH CHECK (user_id = get_user_id(auth.uid()));

CREATE POLICY "Users delete own push_subscriptions"
ON public.push_subscriptions
FOR DELETE TO authenticated
USING (user_id = get_user_id(auth.uid()));

-- Trigger: ao inserir em notifications, chama a edge function
CREATE OR REPLACE FUNCTION public.trigger_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://hcyikjzgzhjjthyxrypd.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'notification_id', NEW.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não bloqueia o insert em caso de falha do push
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_send_push ON public.notifications;
CREATE TRIGGER notifications_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_push_notification();
