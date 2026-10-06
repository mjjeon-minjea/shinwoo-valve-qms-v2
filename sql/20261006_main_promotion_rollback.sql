-- Non-destructive production recovery. No old password ACL / rank API restoration.
-- Modes: pause (also valid before forward), recover_user, rollback_data.
-- Executor supplies qms.target_ref/system_identifier/old_api_closed/writer_quiescent,
-- qms.recovery_mode and protected pg_temp receipt tables described in report.md.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.users,public.resources IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') OR coalesce(auth.role(),'')<>'' THEN RAISE EXCEPTION 'protected SQL only'; END IF;
 IF current_setting('qms.target_ref',true) IS DISTINCT FROM 'zuahpjdsypovxdplxryw'
 OR current_setting('qms.old_api_closed',true) IS DISTINCT FROM 'true'
 OR current_setting('qms.writer_quiescent',true) IS DISTINCT FROM 'true'
 OR current_setting('qms.expected_system_identifier',true) IS NULL
 OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM current_setting('qms.expected_system_identifier') THEN RAISE EXCEPTION 'recovery bindings required'; END IF;
 IF current_setting('qms.recovery_mode',true) NOT IN ('pause','recover_user','rollback_data') OR current_setting('qms.recovery_mode',true) IS NULL THEN RAISE EXCEPTION 'explicit recovery mode required'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.qms_transition_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_TABLE_SCHEMA='storage' THEN
  IF NOT (coalesce(NEW.bucket_id,OLD.bucket_id)='qms-files' AND split_part(coalesce(NEW.name,OLD.name),'/',1)='resources') THEN RETURN coalesce(NEW,OLD); END IF;
 END IF;
 IF coalesce(auth.role(),'')='' AND session_user IN ('postgres','supabase_admin') THEN RETURN coalesce(NEW,OLD); END IF;
 RAISE EXCEPTION 'QMS maintenance: writes paused';
END $$;
REVOKE ALL ON FUNCTION public.qms_transition_guard() FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF current_setting('qms.recovery_mode')='pause' THEN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='qms_users_transition') THEN
   CREATE TRIGGER qms_users_transition BEFORE INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.qms_transition_guard();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.resources'::regclass AND tgname='qms_resources_transition') THEN
   CREATE TRIGGER qms_resources_transition BEFORE INSERT OR UPDATE OR DELETE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.qms_transition_guard();
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgname='qms_storage_transition') THEN
   CREATE TRIGGER qms_storage_transition BEFORE INSERT OR UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.qms_transition_guard();
  END IF;
  IF to_regclass('public.inspection_measurements') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.inspection_measurements') AND tgname='qms_measurements_transition') THEN
   CREATE TRIGGER qms_measurements_transition BEFORE INSERT OR UPDATE OR DELETE ON public.inspection_measurements FOR EACH ROW EXECUTE FUNCTION public.qms_transition_guard();
  END IF;
 END IF;
END $$;
DO $$ DECLARE r record; n integer; canonical jsonb; BEGIN
 IF current_setting('qms.recovery_mode')='recover_user' THEN
  -- Required table: id text PK,email text,before_auth_id text,before_is_admin boolean,
  -- before_status text,canonical_auth_id text,restore_is_admin boolean,restore_status text.
  IF (SELECT count(*) FROM pg_temp.qms_user_recovery)<>1 THEN RAISE EXCEPTION 'one recovery receipt required'; END IF;
  SELECT * INTO STRICT r FROM pg_temp.qms_user_recovery;
  SELECT x INTO canonical FROM jsonb_array_elements(current_setting('qms.expected_existing_bindings')::jsonb) x WHERE x->>'id'=r.id AND x->>'email'=r.email AND x->>'auth_id'=r.canonical_auth_id;
  IF canonical IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id::text=r.canonical_auth_id AND a.email=r.email)
   OR r.restore_is_admin IS DISTINCT FROM (r.id=current_setting('qms.admin_pk')) OR r.restore_status<>'Active'
   OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='guard_users_admin' AND tgenabled='O') THEN RAISE EXCEPTION 'approved canonical recovery rejected'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=r.id AND u.email=r.email AND u.auth_id IS NOT DISTINCT FROM r.before_auth_id AND u.is_admin IS NOT DISTINCT FROM r.before_is_admin AND u.status IS NOT DISTINCT FROM r.before_status) THEN RAISE EXCEPTION 'recovery CAS drift'; END IF;
  -- ACCESS EXCLUSIVE lock prevents every concurrent writer while the exact exception exists.
  ALTER TABLE public.users DISABLE TRIGGER guard_users_admin;
  BEGIN
   UPDATE public.users SET auth_id=r.canonical_auth_id,is_admin=r.restore_is_admin,status=r.restore_status
    WHERE id=r.id AND email=r.email AND auth_id IS NOT DISTINCT FROM r.before_auth_id AND is_admin IS NOT DISTINCT FROM r.before_is_admin AND status IS NOT DISTINCT FROM r.before_status;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=r.id AND auth_id=r.canonical_auth_id AND is_admin=r.restore_is_admin AND status=r.restore_status) OR (SELECT count(*) FROM public.users WHERE is_admin)<>1 THEN RAISE EXCEPTION 'recovery readback failed'; END IF;
   ALTER TABLE public.users ENABLE TRIGGER guard_users_admin;
  EXCEPTION WHEN OTHERS THEN
   ALTER TABLE public.users ENABLE TRIGGER guard_users_admin;
   RAISE;
  END;
 END IF;
END $$;
DO $$ DECLARE r record; n integer; BEGIN
 IF current_setting('qms.recovery_mode')='rollback_data' THEN
  -- Required receipts (empty tables allowed, omitted tables are an error):
  -- qms_role_receipts(id,email,auth_id,before_role,applied_role), all text.
  -- qms_resource_receipts(id,storage_path,sha256 text; applied_is_current,
  -- applied_is_deleted boolean; applied_deleted_at timestamptz; applied_deleted_by_auth uuid).
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE auth_id=current_setting('qms.recovery_actor') AND status='Active') THEN RAISE EXCEPTION 'canonical recovery actor required'; END IF;
  FOR r IN SELECT * FROM pg_temp.qms_role_receipts LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(current_setting('qms.expected_existing_bindings')::jsonb) x WHERE x->>'id'=r.id AND x->>'email'=r.email AND x->>'auth_id'=r.auth_id AND x->>'role' IS NOT DISTINCT FROM r.before_role) THEN RAISE EXCEPTION 'role receipt not approved before'; END IF;
   UPDATE public.users SET role=r.before_role WHERE id=r.id AND email=r.email AND auth_id=r.auth_id AND role IS NOT DISTINCT FROM r.applied_role;
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=r.id AND role IS NOT DISTINCT FROM r.before_role) THEN RAISE EXCEPTION 'role CAS/readback failed'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM pg_temp.qms_resource_receipts LOOP
   UPDATE public.resources d SET is_current=false,is_deleted=true,deleted_at=now(),deleted_by_auth=current_setting('qms.recovery_actor')::uuid
    WHERE d.id=r.id AND d.storage_path=r.storage_path AND d.sha256=r.sha256
     AND d.is_current IS NOT DISTINCT FROM r.applied_is_current AND d.is_deleted IS NOT DISTINCT FROM r.applied_is_deleted
     AND d.deleted_at IS NOT DISTINCT FROM r.applied_deleted_at AND d.deleted_by_auth IS NOT DISTINCT FROM r.applied_deleted_by_auth
     AND NOT EXISTS(SELECT 1 FROM public.resources later WHERE later.module=d.module AND later.category=d.category AND later.doc_key=d.doc_key AND later.revision>d.revision);
   GET DIAGNOSTICS n=ROW_COUNT;
   IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.resources WHERE id=r.id AND NOT is_current AND is_deleted AND deleted_by_auth=current_setting('qms.recovery_actor')::uuid) THEN RAISE EXCEPTION 'resource CAS/readback failed'; END IF;
  END LOOP;
 END IF;
END $$;
-- Do not drop data, delete Auth/Storage, or disable security. Pauses survive this transaction.
NOTIFY pgrst,'reload schema';
COMMIT;
