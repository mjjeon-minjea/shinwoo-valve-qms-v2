-- QMS MAIN candidate. Protected bindings / old API closure required.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.users,public.resources,public.weekly_reports,public.inspections,public.sync_logs,public.notices,public.settings IN SHARE ROW EXCLUSIVE MODE;
DO $$ DECLARE actual text; expected jsonb; BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') OR coalesce(auth.role(),'')<>'' THEN RAISE EXCEPTION 'trusted maintenance SQL only'; END IF;
 IF current_setting('qms.target_ref',true) IS DISTINCT FROM 'zuahpjdsypovxdplxryw' OR current_setting('qms.old_api_closed',true) IS DISTINCT FROM 'true' OR current_setting('qms.writer_quiescent',true) IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'binding/closure/writer receipts required'; END IF;
 IF current_setting('qms.expected_system_identifier',true) IS NULL OR (SELECT system_identifier::text FROM pg_control_system()) IS DISTINCT FROM current_setting('qms.expected_system_identifier') THEN RAISE EXCEPTION 'database identity mismatch'; END IF;
 SELECT md5(string_agg(table_name||':'||column_name||':'||udt_name,'|' ORDER BY table_name COLLATE "C",column_name COLLATE "C")) INTO actual FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('users','resources','weekly_reports','inspections','sync_logs','notices','settings');
 IF actual IS DISTINCT FROM 'a3526954181f455d8c3aa1f222a94837' THEN RAISE EXCEPTION 'MAIN schema fingerprint drift'; END IF;
 expected := current_setting('qms.expected_existing_bindings')::jsonb;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(expected) x WHERE NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id::text=x->>'auth_id' AND a.email=x->>'email')) OR (SELECT count(*) FROM public.weekly_reports)<>73 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='process_inspections_inspector_id_fkey' AND confrelid='public.users'::regclass) THEN RAISE EXCEPTION 'canonical Auth/history/FK baseline drift'; END IF;
 IF jsonb_array_length(expected)<>6 OR (SELECT count(*) FROM public.users)<>6 OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(expected) x)<>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(expected) x WHERE NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=x->>'id' AND u.email=x->>'email' AND u.auth_id=x->>'auth_id' AND u.role IS NOT DISTINCT FROM x->>'role' AND u.status IS NOT DISTINCT FROM x->>'status')) THEN RAISE EXCEPTION 'existing six binding drift'; END IF;
 IF EXISTS(SELECT 1 FROM public.resources) OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='qms-files') OR EXISTS(SELECT 1 FROM storage.buckets WHERE id='qms-files') THEN RAISE EXCEPTION 'resource/bucket baseline drift'; END IF;
 IF (SELECT count(*) FROM public.users WHERE role='manager')<>1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=current_setting('qms.admin_pk') AND auth_id=current_setting('qms.admin_auth') AND role='manager' AND status='Active') OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=current_setting('qms.qa_pk') AND auth_id=current_setting('qms.qa_auth') AND status='Active' AND company='품질보증부') THEN RAISE EXCEPTION 'approved capability binding mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects') THEN RAISE EXCEPTION 'storage policy baseline drift'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('notices','settings'))<>2 OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('notices','settings') AND (policyname<>'Enable ALL for authenticated users' OR cmd<>'ALL' OR roles<>ARRAY['authenticated']::name[] OR qual IS DISTINCT FROM 'true' OR with_check IS NOT NULL)) THEN RAISE EXCEPTION 'notice/settings policy baseline drift'; END IF;
END $$;

LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
-- 임시 before projection: id,email,auth_id,name,company,rank,role,status,date만 보호 실행자가 보존.
ALTER TABLE public.users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN weekly_review_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN legacy_post_manager boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE(email);
CREATE UNIQUE INDEX users_auth_id_uniq ON public.users(auth_id) WHERE auth_id IS NOT NULL;
CREATE UNIQUE INDEX users_one_site_admin_uniq ON public.users((is_admin)) WHERE is_admin;
UPDATE public.users SET legacy_post_manager=true WHERE role='manager';
UPDATE public.users SET is_admin=true WHERE id=current_setting('qms.admin_pk') AND auth_id=current_setting('qms.admin_auth');
UPDATE public.users SET role='director', weekly_review_enabled=true
 WHERE id=current_setting('qms.qa_pk') AND auth_id=current_setting('qms.qa_auth');
-- 위 두 binding은 이름/rank 추정이 아니라 정본 대응표; 영향행/사이트관리자 1명/기존6 UUID 불변 확인.

-- Table-level privilege가 있으면 password만 REVOKE해도 충분하지 않다.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.users FROM PUBLIC, anon, authenticated;
REVOKE SELECT(password), INSERT(password), UPDATE(password) ON public.users FROM PUBLIC, anon, authenticated;
DO $$ DECLARE c text; BEGIN FOR c IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' LOOP EXECUTE format('REVOKE SELECT(%I),INSERT(%I),UPDATE(%I),REFERENCES(%I) ON public.users FROM PUBLIC,anon,authenticated',c,c,c,c); END LOOP; END $$;
GRANT SELECT(id,email,name,company,role,rank,date,status,created_at,auth_id,is_admin,weekly_review_enabled,legacy_post_manager)
 ON public.users TO authenticated;
GRANT INSERT(id,email,name,company,role,rank,date,status,auth_id) ON public.users TO authenticated;
GRANT UPDATE(name,rank,company,role,status) ON public.users TO authenticated;
-- password 열의 기존 값은 보존·불변. service_role을 브라우저에 전달하지 않는다.
REVOKE ALL ON FUNCTION public.check_legacy_password(text,text) FROM PUBLIC, anon, authenticated, service_role;
ALTER FUNCTION public.check_legacy_password(text,text) SET search_path=pg_catalog,public;

DROP POLICY "Enable ALL for authenticated users" ON public.users;
CREATE FUNCTION public.qms_site_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=auth.uid()::text AND u.is_admin AND u.status='Active')
$$;
REVOKE ALL ON FUNCTION public.qms_site_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qms_site_admin() TO authenticated;
CREATE POLICY users_read_safe ON public.users FOR SELECT TO authenticated USING(true);
CREATE POLICY users_insert_pending_or_admin ON public.users FOR INSERT TO authenticated WITH CHECK(
 (auth_id=auth.uid()::text AND role='employee' AND status='Pending' AND NOT is_admin
  AND NOT weekly_review_enabled AND NOT legacy_post_manager)
 OR public.qms_site_admin()
);

CREATE POLICY users_update_self_or_admin ON public.users FOR UPDATE TO authenticated USING(auth_id=auth.uid()::text OR public.qms_site_admin()) WITH CHECK(auth_id=auth.uid()::text OR public.qms_site_admin());
-- Trusted SQL only. GUC bindings supplied by the protected executor, never a browser.
CREATE FUNCTION public.guard_users_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE trusted boolean := coalesce(auth.role(),'')='' AND session_user IN ('postgres','supabase_admin');
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'employee deletion forbidden'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email OR NEW.auth_id IS DISTINCT FROM OLD.auth_id OR NEW.password IS DISTINCT FROM OLD.password) THEN
  RAISE EXCEPTION 'identity/password mirror immutable';
 END IF;
 IF TG_OP='UPDATE' AND OLD.is_admin AND (NOT NEW.is_admin OR NEW.status IS DISTINCT FROM 'Active') THEN RAISE EXCEPTION 'sole administrator immutable'; END IF;
 IF trusted THEN RETURN NEW; END IF;
 IF coalesce(auth.role(),'') NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'verified actor required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.password IS NOT NULL OR NEW.is_admin OR NEW.weekly_review_enabled OR NEW.legacy_post_manager OR NEW.auth_id IS NULL THEN RAISE EXCEPTION 'protected signup fields'; END IF;
  IF auth.role()='service_role' OR public.qms_site_admin() THEN RETURN NEW; END IF;
  IF NEW.auth_id=auth.uid()::text AND NEW.email=auth.jwt()->>'email' AND NEW.role='employee' AND NEW.status='Pending' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'signup contract rejected';
 END IF;
 IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.weekly_review_enabled IS DISTINCT FROM OLD.weekly_review_enabled OR NEW.legacy_post_manager IS DISTINCT FROM OLD.legacy_post_manager THEN RAISE EXCEPTION 'capability flags immutable'; END IF;
 IF NEW.date IS DISTINCT FROM OLD.date OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'registration metadata immutable'; END IF;
 IF auth.role()='service_role' OR public.qms_site_admin() THEN RETURN NEW; END IF;
 IF OLD.auth_id IS DISTINCT FROM auth.uid()::text OR NEW.company IS DISTINCT FROM OLD.company OR NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'self update limited to name/rank'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_users_admin BEFORE INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.guard_users_admin();
REVOKE ALL ON FUNCTION public.guard_users_admin() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_weekly_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor record; own boolean; same_body boolean;
BEGIN
 IF coalesce(auth.role(),'')='' AND session_user IN ('postgres','supabase_admin') THEN RETURN coalesce(NEW,OLD); END IF;
 SELECT id,auth_id,role,weekly_review_enabled INTO actor FROM public.users WHERE auth_id=auth.uid()::text AND status='Active';
 IF NOT FOUND THEN RAISE EXCEPTION 'Active report actor required'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."authorId" NOT IN (actor.id,actor.auth_id) OR NEW."authorId" IS NULL OR NEW.status NOT IN ('draft','submitted') OR coalesce(NEW."reviewerComment",'')<>'' OR coalesce(NEW."approverComment",'')<>'' THEN RAISE EXCEPTION 'report insert rejected'; END IF;
  RETURN NEW;
 END IF;
 own := OLD."authorId" IN (actor.id,actor.auth_id);
 IF TG_OP='DELETE' THEN
  IF NOT coalesce(own,false) OR OLD.status<>'draft' THEN RAISE EXCEPTION 'report delete rejected'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW."authorId" IS DISTINCT FROM OLD."authorId" OR NEW."weekStartDate" IS DISTINCT FROM OLD."weekStartDate" THEN RAISE EXCEPTION 'report identity immutable'; END IF;
 same_body := (to_jsonb(NEW)-ARRAY['status','reviewerComment','approverComment']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reviewerComment','approverComment']);
 -- Own draft/submit and own cancellation retain the original editing contract.
 IF own AND NEW.status IN ('draft','submitted') AND (OLD.status='draft' OR (NEW.status='draft' AND same_body)) AND coalesce(NEW."reviewerComment",'')='' AND coalesce(NEW."approverComment",'')='' THEN RETURN NEW; END IF;
 IF own OR NOT same_body THEN RAISE EXCEPTION 'report body/write actor rejected'; END IF;
 IF NEW.status=OLD.status AND NEW."reviewerComment" IS DISTINCT FROM OLD."reviewerComment" AND OLD.status IN ('reviewed','approved') AND (actor.role IN ('manager','admin') OR actor.weekly_review_enabled) AND NEW."approverComment" IS NOT DISTINCT FROM OLD."approverComment" THEN RETURN NEW; END IF;
 IF NEW.status='approved' AND OLD.status='approved' AND actor.role IN ('director','admin') AND NEW."reviewerComment" IS NOT DISTINCT FROM OLD."reviewerComment" THEN RETURN NEW; END IF;
 IF NEW.status='reviewed' AND OLD.status='submitted' AND (actor.role IN ('manager','admin') OR actor.weekly_review_enabled) AND NEW."approverComment" IS NOT DISTINCT FROM OLD."approverComment" THEN RETURN NEW; END IF;
 IF NEW.status='approved' AND OLD.status IN ('submitted','reviewed') AND actor.role IN ('director','admin') AND NEW."reviewerComment" IS NOT DISTINCT FROM OLD."reviewerComment" THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'review/approval permission or transition rejected';
END $$;
CREATE TRIGGER guard_weekly_review BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_reports FOR EACH ROW EXECUTE FUNCTION public.guard_weekly_review();
REVOKE ALL ON FUNCTION public.guard_weekly_review() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.qms_legacy_post_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=auth.uid()::text AND u.status='Active' AND u.legacy_post_manager)
$$;
REVOKE ALL ON FUNCTION public.qms_legacy_post_manager() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.qms_legacy_post_manager() TO authenticated;
ALTER POLICY suggestions_select_policy ON public.suggestions TO authenticated
 USING(status='published' OR "authorEmail"=auth.jwt()->>'email' OR public.qms_legacy_post_manager());
ALTER POLICY suggestions_insert_policy ON public.suggestions TO authenticated
 WITH CHECK(status='draft' AND "authorEmail"=auth.jwt()->>'email');
ALTER POLICY suggestions_update_policy ON public.suggestions TO authenticated
 USING(public.qms_legacy_post_manager()) WITH CHECK(public.qms_legacy_post_manager());
ALTER POLICY devnotes_insert_policy ON public.dev_notes TO authenticated WITH CHECK(public.qms_legacy_post_manager());
ALTER POLICY devnotes_update_policy ON public.dev_notes TO authenticated
 USING(public.qms_legacy_post_manager()) WITH CHECK(public.qms_legacy_post_manager());
ALTER POLICY devnotes_select_policy ON public.dev_notes TO authenticated
 USING(status='published' OR public.qms_legacy_post_manager());
-- Fixed notice/settings writes belong to the sole site admin, not rank/role.
DROP POLICY "Enable ALL for authenticated users" ON public.notices;
CREATE POLICY qms_notices_read ON public.notices FOR SELECT TO authenticated USING(true);
CREATE POLICY qms_notices_admin ON public.notices TO authenticated USING(public.qms_site_admin()) WITH CHECK(public.qms_site_admin());
DROP POLICY "Enable ALL for authenticated users" ON public.settings;
CREATE POLICY qms_settings_read ON public.settings FOR SELECT TO authenticated USING(true);
CREATE POLICY qms_settings_admin ON public.settings TO authenticated USING(public.qms_site_admin()) WITH CHECK(public.qms_site_admin());

LOCK TABLE public.resources IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.resources) THEN RAISE EXCEPTION 'MAIN resources baseline drift: preserve and map legacy rows'; END IF; END $$;
ALTER TABLE public.resources
 ADD COLUMN module text NOT NULL, ADD COLUMN module_label text NOT NULL,
 ADD COLUMN category text NOT NULL, ADD COLUMN category_label text NOT NULL,
 ADD COLUMN doc_key text NOT NULL, ADD COLUMN revision integer NOT NULL,
 ADD COLUMN description text NOT NULL DEFAULT '', ADD COLUMN source_ref text,
 ADD COLUMN revision_note text NOT NULL DEFAULT '', ADD COLUMN bucket_id text NOT NULL DEFAULT 'qms-files',
 ADD COLUMN storage_path text NOT NULL, ADD COLUMN original_name text NOT NULL,
 ADD COLUMN file_size bigint NOT NULL, ADD COLUMN mime_type text NOT NULL, ADD COLUMN sha256 text NOT NULL,
 ADD COLUMN registered_by_auth uuid NOT NULL, ADD COLUMN registered_by_name text NOT NULL,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN is_current boolean NOT NULL DEFAULT false, ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
 ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by_auth uuid;
ALTER TABLE public.resources
 ADD CONSTRAINT resources_revision_check CHECK(revision>0),
 ADD CONSTRAINT resources_bucket_id_check CHECK(bucket_id='qms-files'),
 ADD CONSTRAINT resources_storage_path_check CHECK(storage_path LIKE 'resources/%'),
 ADD CONSTRAINT resources_file_size_check CHECK(file_size BETWEEN 0 AND 20971520),
 ADD CONSTRAINT resources_sha256_check CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 ADD CONSTRAINT resources_module_check CHECK(module ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
 ADD CONSTRAINT resources_category_check CHECK(category ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
 ADD CONSTRAINT resources_doc_key_check CHECK(doc_key ~ '^[a-z0-9][a-z0-9._-]{0,127}$'),
 ADD CONSTRAINT resources_title_check CHECK(title IS NOT NULL AND btrim(title)<>''),
 ADD CONSTRAINT resources_check CHECK((NOT is_deleted AND deleted_at IS NULL AND deleted_by_auth IS NULL)
    OR (is_deleted AND deleted_at IS NOT NULL AND deleted_by_auth IS NOT NULL)),
 ADD CONSTRAINT resources_check1 CHECK(NOT(is_current AND is_deleted));
CREATE UNIQUE INDEX resources_doc_revision_uniq ON public.resources(module,category,doc_key,revision);
CREATE UNIQUE INDEX resources_storage_path_uniq ON public.resources(storage_path);
CREATE UNIQUE INDEX resources_one_current_uniq ON public.resources(module,category,doc_key) WHERE is_current AND NOT is_deleted;
DROP POLICY "Enable ALL for authenticated users" ON public.resources;
REVOKE INSERT,UPDATE,DELETE ON public.resources FROM PUBLIC,anon,authenticated;
REVOKE SELECT ON public.resources FROM PUBLIC,anon;
GRANT SELECT ON public.resources TO authenticated;
CREATE POLICY resources_select_current_or_quality ON public.resources FOR SELECT TO authenticated USING(
 (is_current AND NOT is_deleted) OR EXISTS(SELECT 1 FROM public.users u
  WHERE u.auth_id=auth.uid()::text AND u.status='Active' AND btrim(coalesce(u.company,''))='품질보증부')
);

CREATE FUNCTION public.resource_publish_revision(p_id uuid, p_module text, p_module_label text, p_category text, p_category_label text, p_doc_key text, p_title text, p_description text, p_source_ref text, p_revision_note text, p_storage_path text, p_original_name text, p_file_size bigint, p_mime_type text, p_sha256 text)
 RETURNS public.resources
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_auth uuid;
  v_actor_name text;
  v_existing public.resources%rowtype;
  v_row public.resources%rowtype;
  v_module_label text;
  v_revision integer;
  v_folders text[];
  v_ext text;
  v_original_ext text;
  v_canonical_mime text;
  v_request_mime text;
  v_object_mime text;
  v_object_size bigint;
  v_object_metadata jsonb;
begin
  select auth.uid(), u.name
    into v_actor_auth, v_actor_name
  from public.users u
  where u.auth_id = auth.uid()::text
    and u.status = 'Active'
    and btrim(coalesce(u.company, '')) = '품질보증부'
  limit 1;

  if not found then
    raise exception using errcode = '42501', message = 'resource_publish_revision: quality department (Active) required';
  end if;

  if p_id is null then raise exception 'resource_publish_revision: p_id required'; end if;
  p_module := lower(btrim(coalesce(p_module, '')));
  p_category := lower(btrim(coalesce(p_category, '')));
  p_doc_key := lower(btrim(coalesce(p_doc_key, '')));
  p_module_label := btrim(coalesce(p_module_label, ''));
  p_category_label := btrim(coalesce(p_category_label, ''));
  p_title := btrim(coalesce(p_title, ''));
  p_original_name := btrim(coalesce(p_original_name, ''));
  p_storage_path := btrim(coalesce(p_storage_path, ''));
  p_sha256 := lower(btrim(coalesce(p_sha256, '')));

  if p_module !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or p_category !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
     or p_doc_key !~ '^[a-z0-9][a-z0-9._-]{0,127}$' then
    raise exception 'resource_publish_revision: invalid module/category/doc_key';
  end if;
  if p_module_label = '' or p_category_label = '' or p_title = '' or p_original_name = '' then
    raise exception 'resource_publish_revision: label/title/original_name required';
  end if;
  if p_file_size is null or p_file_size < 0 or p_file_size > 20971520 then
    raise exception 'resource_publish_revision: file size out of range';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'resource_publish_revision: sha256 required';
  end if;

  v_folders := storage.foldername(p_storage_path);
  v_ext := lower(coalesce(storage.extension(p_storage_path), ''));
  v_original_ext := lower(coalesce(storage.extension(p_original_name), ''));
  if coalesce(array_length(v_folders, 1), 0) <> 5
     or v_folders[1] <> 'resources'
     or v_folders[2] <> p_module
     or v_folders[3] <> p_category
     or v_folders[4] !~ '^[0-9]{4}$'
     or v_folders[5] <> p_doc_key
     or storage.filename(p_storage_path) not like p_id::text || '--%'
     or v_ext = ''
     or v_ext <> v_original_ext then
    raise exception 'resource_publish_revision: storage path/original extension mismatch';
  end if;

  if v_ext not in (
    'pdf','png','jpg','jpeg','webp','gif',
    'doc','docx','xls','xlsx','ppt','pptx',
    'csv','txt','zip','hwp','hwpx'
  ) then
    raise exception 'resource_publish_revision: extension % not allowed', v_ext;
  end if;

  v_canonical_mime := case v_ext
    when 'pdf' then 'application/pdf'
    when 'png' then 'image/png'
    when 'jpg' then 'image/jpeg'
    when 'jpeg' then 'image/jpeg'
    when 'webp' then 'image/webp'
    when 'gif' then 'image/gif'
    when 'doc' then 'application/msword'
    when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'xls' then 'application/vnd.ms-excel'
    when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    when 'ppt' then 'application/vnd.ms-powerpoint'
    when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    when 'csv' then 'text/csv'
    when 'txt' then 'text/plain'
    when 'zip' then 'application/zip'
    when 'hwp' then 'application/x-hwp'
    when 'hwpx' then 'application/vnd.hancom.hwpx'
  end;

  select o.metadata
    into v_object_metadata
  from storage.objects o
  where o.bucket_id = 'qms-files'
    and o.name = p_storage_path;
  if not found then
    raise exception 'resource_publish_revision: storage object not found';
  end if;

  if coalesce(v_object_metadata ->> 'size', '') !~ '^[0-9]+$' then
    raise exception 'resource_publish_revision: stored object size missing';
  end if;
  v_object_size := (v_object_metadata ->> 'size')::bigint;
  if v_object_size <> p_file_size or v_object_size > 20971520 then
    raise exception 'resource_publish_revision: stored object size mismatch';
  end if;

  v_request_mime := lower(btrim(coalesce(p_mime_type, '')));
  v_object_mime := lower(btrim(coalesce(v_object_metadata ->> 'mimetype', '')));

  if not (
    v_request_mime in ('', 'application/octet-stream', v_canonical_mime)
    or (v_ext = 'hwp' and v_request_mime in ('application/x-hwp','application/haansofthwp','application/vnd.hancom.hwp'))
    or (v_ext = 'hwpx' and v_request_mime in ('application/vnd.hancom.hwpx','application/zip','application/x-zip-compressed'))
    or (v_ext = 'zip' and v_request_mime = 'application/x-zip-compressed')
    or (v_ext = 'csv' and v_request_mime = 'application/vnd.ms-excel')
  ) then
    raise exception 'resource_publish_revision: requested MIME mismatch';
  end if;

  if not (
    v_object_mime in ('', 'application/octet-stream', v_canonical_mime)
    or (v_ext = 'hwp' and v_object_mime in ('application/x-hwp','application/haansofthwp','application/vnd.hancom.hwp'))
    or (v_ext = 'hwpx' and v_object_mime in ('application/vnd.hancom.hwpx','application/zip','application/x-zip-compressed'))
    or (v_ext = 'zip' and v_object_mime = 'application/x-zip-compressed')
    or (v_ext = 'csv' and v_object_mime = 'application/vnd.ms-excel')
  ) then
    raise exception 'resource_publish_revision: stored MIME mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('resources-module:' || p_module, 0));

  select * into v_existing
  from public.resources r
  where r.id = p_id::text;
  if found then
    if v_existing.module = p_module
       and v_existing.category = p_category
       and v_existing.category_label = p_category_label
       and v_existing.doc_key = p_doc_key
       and v_existing.title = p_title
       and v_existing.description = coalesce(p_description, '')
       and v_existing.source_ref is not distinct from nullif(btrim(coalesce(p_source_ref, '')), '')
       and v_existing.revision_note = coalesce(p_revision_note, '')
       and v_existing.storage_path = p_storage_path
       and v_existing.original_name = p_original_name
       and v_existing.file_size = p_file_size
       and v_existing.mime_type = v_canonical_mime
       and v_existing.sha256 = p_sha256
       and v_existing.registered_by_auth = v_actor_auth then
      return v_existing;
    end if;
    raise exception 'resource_publish_revision: p_id conflict';
  end if;

  select r.module_label into v_module_label
  from public.resources r
  where r.module = p_module
  order by r.created_at desc, r.id desc
  limit 1;
  v_module_label := coalesce(nullif(v_module_label, ''), p_module_label);

  select coalesce(max(r.revision), 0) + 1 into v_revision
  from public.resources r
  where r.module = p_module
    and r.category = p_category
    and r.doc_key = p_doc_key;

  update public.resources r
     set is_current = false
   where r.module = p_module
     and r.category = p_category
     and r.doc_key = p_doc_key
     and r.is_current = true;

  insert into public.resources(
    id,module,module_label,category,category_label,doc_key,revision,
    title,description,source_ref,revision_note,
    bucket_id,storage_path,original_name,file_size,mime_type,sha256,
    registered_by_auth,registered_by_name,created_at,
    is_current,is_deleted,deleted_at,deleted_by_auth
  ) values (
    p_id::text,p_module,v_module_label,p_category,p_category_label,p_doc_key,v_revision,
    p_title,coalesce(p_description,''),nullif(btrim(coalesce(p_source_ref,'')),''),coalesce(p_revision_note,''),
    'qms-files',p_storage_path,p_original_name,p_file_size,v_canonical_mime,p_sha256,
    v_actor_auth,v_actor_name,now(),
    true,false,null,null
  ) returning * into v_row;

  return v_row;
end $function$;

CREATE FUNCTION public.resource_soft_delete(p_id uuid)
 RETURNS public.resources
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_auth uuid;
  v_row public.resources%rowtype;
begin
  select auth.uid() into v_actor_auth
  from public.users u
  where u.auth_id = auth.uid()::text
    and u.status = 'Active'
    and btrim(coalesce(u.company, '')) = '품질보증부'
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'resource_soft_delete: quality department (Active) required';
  end if;

  select * into v_row
  from public.resources r
  where r.id = p_id::text
  for update;
  if not found then raise exception 'resource_soft_delete: resource not found'; end if;
  if v_row.is_deleted then return v_row; end if;

  update public.resources r
     set is_current = false,
         is_deleted = true,
         deleted_at = now(),
         deleted_by_auth = v_actor_auth
   where r.id = p_id::text
  returning * into v_row;

  return v_row;
end $function$;

CREATE FUNCTION public.resource_restore(p_id uuid)
 RETURNS public.resources
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_auth uuid;
  v_module text;
  v_row public.resources%rowtype;
  v_make_current boolean;
begin
  select auth.uid() into v_actor_auth
  from public.users u
  where u.auth_id = auth.uid()::text and u.status = 'Active' and btrim(coalesce(u.company, '')) = '품질보증부'
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'resource_restore: quality department (Active) required';
  end if;

  -- same module lock as resource_publish_revision, taken before the row lock
  select r.module into v_module from public.resources r where r.id = p_id::text;
  if not found then raise exception 'resource_restore: resource not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('resources-module:' || v_module, 0));

  select * into v_row from public.resources r where r.id = p_id::text for update;
  if not found then raise exception 'resource_restore: resource not found'; end if;
  if v_row.module <> v_module then raise exception 'resource_restore: module changed, retry'; end if;
  if not v_row.is_deleted then return v_row; end if;

  v_make_current :=
    not exists (select 1 from public.resources r
                 where r.module = v_row.module and r.category = v_row.category and r.doc_key = v_row.doc_key
                   and r.is_current and not r.is_deleted)
    and v_row.revision = (select max(r.revision) from public.resources r
                           where r.module = v_row.module and r.category = v_row.category and r.doc_key = v_row.doc_key);

  update public.resources r
     set is_deleted = false, deleted_at = null, deleted_by_auth = null, is_current = v_make_current
   where r.id = p_id::text
  returning * into v_row;
  return v_row;
end $function$;
-- 신규 함수는 생성 직후 기본 PUBLIC EXECUTE를 반드시 회수한다. 미실행 계약 초안.
REVOKE ALL ON FUNCTION public.resource_publish_revision(uuid,text,text,text,text,text,text,text,text,text,text,text,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resource_soft_delete(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resource_restore(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resource_publish_revision(uuid,text,text,text,text,text,text,text,text,text,text,text,bigint,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.resource_soft_delete(uuid),public.resource_restore(uuid) TO authenticated,service_role;
CREATE POLICY qms_files_authenticated_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='qms-files' AND split_part(name,'/',1)='resources' AND
 (EXISTS(SELECT 1 FROM public.resources r WHERE r.bucket_id=storage.objects.bucket_id
  AND r.storage_path=storage.objects.name AND r.is_current AND NOT r.is_deleted)
 OR EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=auth.uid()::text
  AND u.status='Active' AND btrim(coalesce(u.company,''))='품질보증부'))
);
CREATE POLICY qms_files_authenticated_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='qms-files' AND split_part(name,'/',1)='resources'
 AND lower(storage.extension(name)) IN ('pdf','png','jpg','jpeg','webp','gif','doc','docx','xls','xlsx','ppt','pptx','csv','txt','zip','hwp','hwpx')
 AND EXISTS(SELECT 1 FROM public.users u WHERE u.auth_id=auth.uid()::text
  AND u.status='Active' AND btrim(coalesce(u.company,''))='품질보증부')
);
-- anon/UPDATE/DELETE 정책은 만들지 않는다. 실제 byte/MIME는 승인된 업로드/다운로드 시험으로 별도 확인.
ALTER TABLE public.inspections ADD COLUMN item_code text;
CREATE TABLE public.inspection_measurements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ri_no text NOT NULL, part_no text, item_name text,
 inspect_point text, kind text, nominal numeric, tol_upper numeric, tol_lower numeric,
 x1 text,x2 text,x3 text,x4 text,x5 text,judgment text,note text,assignee text,content_hash text,
 source_row integer NOT NULL, sync_batch_id uuid, synced_at timestamptz NOT NULL DEFAULT now(),
 seq integer NOT NULL, missing_since timestamptz, missing_seen integer, missing_confirmed_at timestamptz,
 review_reason text, CONSTRAINT inspection_measurements_ri_seq_key UNIQUE(ri_no,seq)
);
ALTER TABLE public.inspection_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY inspection_measurements_authenticated_select ON public.inspection_measurements
 FOR SELECT TO authenticated USING(true);
REVOKE ALL ON public.inspection_measurements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.inspection_measurements TO authenticated;
GRANT ALL ON public.inspection_measurements TO service_role;
CREATE UNIQUE INDEX sync_logs_one_running_per_gid ON public.sync_logs(sheet_gid) WHERE status='running';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.users WHERE is_admin)<>1 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=current_setting('qms.qa_pk') AND role='director' AND weekly_review_enabled) THEN RAISE EXCEPTION 'capability readback failed'; END IF;
 IF has_column_privilege('authenticated','public.users','password','SELECT') OR has_column_privilege('authenticated','public.users','password','UPDATE') OR has_function_privilege('authenticated','public.check_legacy_password(text,text)','EXECUTE') THEN RAISE EXCEPTION 'password ACL readback failed'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
DROP TRIGGER IF EXISTS qms_users_transition ON public.users;
DROP TRIGGER IF EXISTS qms_resources_transition ON public.resources;
DROP TRIGGER IF EXISTS qms_storage_transition ON storage.objects;
COMMIT;
