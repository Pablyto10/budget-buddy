REVOKE EXECUTE ON FUNCTION public.get_email_for_username(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon;