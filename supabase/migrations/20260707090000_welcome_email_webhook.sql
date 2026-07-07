-- Send a welcome email via Edge Function whenever a new user signs up.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_new_user_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _username TEXT;
  _secret TEXT;
BEGIN
  _username := COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text,1,8));

  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = 'edge_function_webhook_secret';

  IF _secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://imfeuaperqnvbxenyaan.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', _secret
    ),
    body := jsonb_build_object('email', NEW.email, 'username', _username)
  );

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_new_user_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_send_welcome_email ON auth.users;
CREATE TRIGGER on_auth_user_created_send_welcome_email
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.notify_new_user_signup();
