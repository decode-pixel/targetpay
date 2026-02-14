-- Fix 1: Remove anonymous access from storage policies (restrict to authenticated only)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

-- Recreate avatar view policy for authenticated users only
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Fix 3: Scope cleanup_expired_imports to admin/scheduled use only
-- Replace with user-scoped version
CREATE OR REPLACE FUNCTION public.cleanup_expired_imports()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete expired imports for all users (designed for scheduled cleanup jobs)
  -- No auth check needed since this should be called by pg_cron, not directly by users
  DELETE FROM public.statement_imports
  WHERE expires_at < now() AND status != 'completed';
END;
$function$;

-- Revoke direct execution from authenticated users
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_imports() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_imports() FROM anon;