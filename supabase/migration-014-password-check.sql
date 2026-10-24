-- Roman's Game rewrite. NOT APPLIED.
-- Project: romans-game (ref oelsglmfkpzbueqysvdm).
-- Do not run this from CI. Do not turn captcha off. Do not re-run migration 013;
-- those objects are already on this project.
--
-- Supabase Auth captcha blocks POST /auth/v1/token?grant_type=password
-- ("captcha protection: request disallowed (no captcha_token found)").
-- The public auth settings and the live game bundle do not publish a captcha
-- site key, so the preview cannot render a captcha widget.
-- This function lets the service role compare the bcrypt hash already stored
-- on auth.users (pgcrypto crypt). The password grant and public signup stay
-- captcha-protected. The live game's email OTP sign-in is unchanged.
--
-- Run once, after review:
-- 1. Open the SQL editor for oelsglmfkpzbueqysvdm.
-- 2. Paste this file and run it.
-- 3. Redeploy the preview. /api/health then reports "schema": true.
-- Password sign-in, checkout, change password, rename, export, delete, and
-- add-email keep failing with a schema error until this function exists.

create or replace function public.rg_password_matches(user_id uuid, plain text)
returns boolean
language plpgsql
security definer
set search_path = auth, extensions, public
as $$
declare
  hash text;
begin
  if plain is null or char_length(plain) < 1 or char_length(plain) > 200 then
    return false;
  end if;
  select encrypted_password into hash from auth.users where id = user_id;
  if hash is null or hash = '' then
    return false;
  end if;
  return hash = extensions.crypt(plain, hash);
end;
$$;

revoke all on function public.rg_password_matches(uuid, text) from public;
revoke all on function public.rg_password_matches(uuid, text) from anon, authenticated;
grant execute on function public.rg_password_matches(uuid, text) to service_role;
