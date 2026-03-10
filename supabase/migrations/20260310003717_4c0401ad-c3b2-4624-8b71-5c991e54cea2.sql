
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'geral',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users read own notifications
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = get_user_id(auth.uid()));

-- Users mark own notifications as read
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id(auth.uid()))
  WITH CHECK (user_id = get_user_id(auth.uid()));

-- Admins read all
CREATE POLICY "Admins read all notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Admins insert for anyone
CREATE POLICY "Admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- System insert (security definer functions)
-- Trigger: notify on below-target indicator
CREATE OR REPLACE FUNCTION public.notify_below_target()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'abaixo_meta' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Indicador abaixo da meta',
      'Seu desempenho ficou abaixo da meta em ' || NEW.data_referencia::text,
      'meta_nao_atingida'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_below_target
  AFTER INSERT ON public.user_indicator_daily
  FOR EACH ROW EXECUTE FUNCTION public.notify_below_target();

-- Trigger: notify when feedback is responded
CREATE OR REPLACE FUNCTION public.notify_feedback_responded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'respondido' AND (OLD.status IS DISTINCT FROM 'respondido') THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Feedback respondido',
      'Seu feedback "' || LEFT(NEW.titulo, 50) || '" foi respondido pela liderança.',
      'feedback_respondido'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_feedback_responded
  AFTER UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_responded();
