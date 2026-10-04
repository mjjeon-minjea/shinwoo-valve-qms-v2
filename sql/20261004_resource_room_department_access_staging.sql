-- 20261004 자료실 관리 권한 = 품질보증부(Active) · 회원 부서/승인상태 자가변경 차단 — STAGING ONLY
-- 대상: Shinwoo_QMS_Staging (ref srzaanvojyhwzugoaimk, system_identifier 7623125441096521075). 메인 적용 금지(별도 승인 필요).
-- 원문: 2026-10-04 KST live pg_get_functiondef / pg_policies / proacl / trigger 읽기 결과에서 정확 치환으로 생성(build_sql.py).
-- 바꾸는 것:
--   1) guard_users_admin: 비관리자 본인 UPDATE 시 company/status 변경 거부 추가 (가입 규격·관리자 수정·마지막 관리자 보호 불변)
--   2) resource_publish_revision / resource_soft_delete / resource_restore: is_admin → status='Active' AND btrim(company)='품질보증부'
--   3) storage.objects qms_files_authenticated_insert/read: resources/ 접두만 같은 판정, 그 밖(NCR 첨부 등)은 원문 그대로
--   4) public.resources: 전면 허용 정책(ALL true)을 SELECT 정책으로 교체 — 현재본은 인증 사용자 전원, 지난 판·숨긴 판은 품질보증부
--      (authenticated 표 권한은 원래 SELECT 만이라 ALL 정책의 실효 범위도 SELECT 였다. 쓰기는 SECURITY DEFINER 함수만)
-- 바꾸지 않는 것: 함수 시그니처·EXECUTE ACL·owner·SECURITY DEFINER·search_path, users 표 정책, 트리거 정의, 그 밖의 표/정책.
-- 실패 시: 한 트랜잭션이라 어느 검사든 실패하면 전부 되돌아간다. 적용 뒤 되돌림은 파일 끝 ROLLBACK 블록(주석) 참고.
-- 원문 해시(md5 pg_get_functiondef): {"guard_users_admin": "ccd916796d6691b60303fead5f610435", "resource_publish_revision": "cf4ff96b7a02c1c3134dc15a210d5537", "resource_soft_delete": "a75ddc446dc01ba2987fafa340e65736", "resource_restore": "93381178e874703961a67505d8447eda"}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- [P0] PREFLIGHT: 스테이징 신원 + 원문/ACL/정책 해시 일치 — 하나라도 다르면 중단
do $preflight$
declare
  v_oid oid;
begin
  if (select system_identifier::text from pg_control_system()) <> '7623125441096521075' or current_database() <> 'postgres' then
    raise exception 'PREFLIGHT: not the bound staging database (system_identifier %)', (select system_identifier from pg_control_system());
  end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'guard_users_admin';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'guard_users_admin') <> 1 then raise exception 'PRE guard_users_admin: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) <> 'ccd916796d6691b60303fead5f610435' then raise exception 'PREFLIGHT guard_users_admin: live definition hash changed, %', md5(pg_get_functiondef(v_oid)); end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'PRE guard_users_admin: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{search_path=public}' then raise exception 'PRE guard_users_admin: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'PRE guard_users_admin: security definer/owner differs'; end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_publish_revision';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_publish_revision') <> 1 then raise exception 'PRE resource_publish_revision: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) <> 'cf4ff96b7a02c1c3134dc15a210d5537' then raise exception 'PREFLIGHT resource_publish_revision: live definition hash changed, %', md5(pg_get_functiondef(v_oid)); end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'PRE resource_publish_revision: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{"search_path=pg_catalog, public"}' then raise exception 'PRE resource_publish_revision: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'PRE resource_publish_revision: security definer/owner differs'; end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_soft_delete';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_soft_delete') <> 1 then raise exception 'PRE resource_soft_delete: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) <> 'a75ddc446dc01ba2987fafa340e65736' then raise exception 'PREFLIGHT resource_soft_delete: live definition hash changed, %', md5(pg_get_functiondef(v_oid)); end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'PRE resource_soft_delete: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{"search_path=pg_catalog, public"}' then raise exception 'PRE resource_soft_delete: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'PRE resource_soft_delete: security definer/owner differs'; end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_restore';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_restore') <> 1 then raise exception 'PRE resource_restore: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) <> '93381178e874703961a67505d8447eda' then raise exception 'PREFLIGHT resource_restore: live definition hash changed, %', md5(pg_get_functiondef(v_oid)); end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'PRE resource_restore: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{"search_path=pg_catalog, public"}' then raise exception 'PRE resource_restore: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'PRE resource_restore: security definer/owner differs'; end if;
  if (select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) from pg_policies where schemaname='storage' and tablename='objects' and policyname='qms_files_authenticated_insert') is distinct from 'd4a6170e8161af98b88f2974522f57cf' then
    raise exception 'PREFLIGHT policy storage.objects.qms_files_authenticated_insert: live hash changed'; end if;
  if (select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) from pg_policies where schemaname='storage' and tablename='objects' and policyname='qms_files_authenticated_read') is distinct from '7758e9fab5de843a0c04f82f02c90c98' then
    raise exception 'PREFLIGHT policy storage.objects.qms_files_authenticated_read: live hash changed'; end if;
  if (select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) from pg_policies where schemaname='public' and tablename='resources' and policyname='Enable ALL for authenticated users') is distinct from 'fe2e7aa3a94b94b876d7713f1517686d' then
    raise exception 'PREFLIGHT policy public.resources.Enable ALL for authenticated users: live hash changed'; end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects') <> 2
     or (select count(*) from pg_policies where schemaname='public' and tablename='resources') <> 1 then
    raise exception 'PREFLIGHT: unexpected policy set on storage.objects/public.resources';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.users'::regclass and tgname = 'trg_guard_users_admin' and tgenabled = 'O'
                   and tgfoid = 'public.guard_users_admin()'::regprocedure) then
    raise exception 'PREFLIGHT: trg_guard_users_admin missing/disabled';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.resources'::regclass) then
    raise exception 'PREFLIGHT: public.resources RLS expected ON';
  end if;
  if (select relacl::text from pg_class where oid = 'public.resources'::regclass)
     is distinct from '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}' then
    raise exception 'PREFLIGHT: public.resources table ACL changed';
  end if;
end
$preflight$;

-- [1] 회원 보호 트리거: 비관리자의 company/status 자가 변경 거부 추가
CREATE OR REPLACE FUNCTION public.guard_users_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  jwt_role  text := coalesce(auth.jwt() ->> 'role', '');
  jwt_email text := coalesce(auth.jwt() ->> 'email', '');
  caller_admin boolean := false;
  admin_cnt int;
begin
  if jwt_role = '' then
    return coalesce(new, old);  -- 직접 SQL: 통제 대상 아님
  end if;

  if jwt_role = 'authenticated' then
    select coalesce(u.is_admin, false) into caller_admin
      from public.users u where u.auth_id = auth.uid() limit 1;
    caller_admin := coalesce(caller_admin, false);
  elsif jwt_role = 'service_role' then
    caller_admin := true;  -- 서버 API는 호출 전에 자체적으로 관리자를 검증한다
  else
    raise exception 'users 변경 권한이 없습니다';
  end if;

  -- [공통] is_admin=true 로 만들어지는 행은 실존 Auth 계정과 연결돼야 한다 (가짜 관리자 금지)
  if tg_op in ('INSERT','UPDATE') and new.is_admin = true then
    if new.auth_id is null
       or not exists (select 1 from auth.users au
                       where au.id = new.auth_id
                         and lower(au.email) = lower(new.email)) then
      raise exception '시스템 관리자는 실존 Auth 계정(이메일 일치)과 연결돼야 합니다';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if not caller_admin then
      -- 자기 가입 행만, 가입 규격 강제 (예림 합의 260830):
      -- 본인 auth_id · JWT 이메일 필수 일치 · role='employee' · status='Pending' · is_admin=false
      if new.auth_id is distinct from auth.uid()
         or jwt_email = ''
         or lower(new.email) is distinct from lower(jwt_email)
         or new.is_admin = true
         or lower(coalesce(new.role,'')) <> 'employee'
         or coalesce(new.status,'') <> 'Pending' then
        raise exception '회원 등록 권한이 없습니다 (가입 규격 위반)';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not caller_admin then
      if old.auth_id is distinct from auth.uid() then
        raise exception '다른 회원 정보를 변경할 권한이 없습니다';
      end if;
      if new.auth_id  is distinct from old.auth_id
         or new.email    is distinct from old.email
         or new.role     is distinct from old.role
         or new.is_admin is distinct from old.is_admin then
        raise exception '신원·권한 항목은 시스템 관리자만 변경할 수 있습니다';
      end if;
      -- 20261004: 부서·승인 상태도 본인이 바꾸지 못한다 (자료실·NCR 품질보증부 권한의 근거)
      if new.company  is distinct from old.company
         or new.status   is distinct from old.status then
        raise exception '부서·승인 상태는 시스템 관리자만 변경할 수 있습니다';
      end if;
    end if;
    if old.is_admin = true and new.is_admin is not true then
      perform pg_advisory_xact_lock(hashtext('guard_users_admin'));
      select count(*) into admin_cnt from public.users where is_admin = true;
      if admin_cnt <= 1 then
        raise exception '마지막 시스템 관리자는 해제할 수 없습니다';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not caller_admin then
      raise exception '회원 삭제 권한이 없습니다';
    end if;
    if old.is_admin = true then
      perform pg_advisory_xact_lock(hashtext('guard_users_admin'));
      select count(*) into admin_cnt from public.users where is_admin = true;
      if admin_cnt <= 1 then
        raise exception '마지막 시스템 관리자 계정은 삭제할 수 없습니다';
      end if;
    end if;
    return old;
  end if;

  return coalesce(new, old);
end $function$;

-- [2] 자료실 서버 함수 3개: 판정만 is_admin → 품질보증부(Active)
CREATE OR REPLACE FUNCTION public.resource_publish_revision(p_id uuid, p_module text, p_module_label text, p_category text, p_category_label text, p_doc_key text, p_title text, p_description text, p_source_ref text, p_revision_note text, p_storage_path text, p_original_name text, p_file_size bigint, p_mime_type text, p_sha256 text)
 RETURNS resources
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
  select u.auth_id, u.name
    into v_actor_auth, v_actor_name
  from public.users u
  where u.auth_id = auth.uid()
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
  where r.id = p_id;
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
    p_id,p_module,v_module_label,p_category,p_category_label,p_doc_key,v_revision,
    p_title,coalesce(p_description,''),nullif(btrim(coalesce(p_source_ref,'')),''),coalesce(p_revision_note,''),
    'qms-files',p_storage_path,p_original_name,p_file_size,v_canonical_mime,p_sha256,
    v_actor_auth,v_actor_name,now(),
    true,false,null,null
  ) returning * into v_row;

  return v_row;
end $function$;

CREATE OR REPLACE FUNCTION public.resource_soft_delete(p_id uuid)
 RETURNS resources
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_auth uuid;
  v_row public.resources%rowtype;
begin
  select u.auth_id into v_actor_auth
  from public.users u
  where u.auth_id = auth.uid()
    and u.status = 'Active'
    and btrim(coalesce(u.company, '')) = '품질보증부'
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'resource_soft_delete: quality department (Active) required';
  end if;

  select * into v_row
  from public.resources r
  where r.id = p_id
  for update;
  if not found then raise exception 'resource_soft_delete: resource not found'; end if;
  if v_row.is_deleted then return v_row; end if;

  update public.resources r
     set is_current = false,
         is_deleted = true,
         deleted_at = now(),
         deleted_by_auth = v_actor_auth
   where r.id = p_id
  returning * into v_row;

  return v_row;
end $function$;

CREATE OR REPLACE FUNCTION public.resource_restore(p_id uuid)
 RETURNS resources
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
  select u.auth_id into v_actor_auth
  from public.users u
  where u.auth_id = auth.uid() and u.status = 'Active' and btrim(coalesce(u.company, '')) = '품질보증부'
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'resource_restore: quality department (Active) required';
  end if;

  -- same module lock as resource_publish_revision, taken before the row lock
  select r.module into v_module from public.resources r where r.id = p_id;
  if not found then raise exception 'resource_restore: resource not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('resources-module:' || v_module, 0));

  select * into v_row from public.resources r where r.id = p_id for update;
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
   where r.id = p_id
  returning * into v_row;
  return v_row;
end $function$;

-- [3] qms-files: resources/ 접두만 품질보증부 판정, 그 밖 경로는 원문 그대로 허용
drop policy qms_files_authenticated_insert on storage.objects;
create policy qms_files_authenticated_insert on storage.objects
  as permissive for insert to authenticated
  with check (
    bucket_id = 'qms-files'
    and (
      split_part(name, '/', 1) <> 'resources'
      or (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.status = 'Active' and btrim(coalesce(u.company, '')) = '품질보증부')
          and lower(coalesce(storage.extension(name), '')) = any (ARRAY['pdf'::text, 'png'::text, 'jpg'::text, 'jpeg'::text, 'webp'::text, 'gif'::text, 'doc'::text, 'docx'::text, 'xls'::text, 'xlsx'::text, 'ppt'::text, 'pptx'::text, 'csv'::text, 'txt'::text, 'zip'::text, 'hwp'::text, 'hwpx'::text]))
    )
  );

drop policy qms_files_authenticated_read on storage.objects;
create policy qms_files_authenticated_read on storage.objects
  as permissive for select to authenticated
  using (
    bucket_id = 'qms-files'
    and (
      split_part(name, '/', 1) <> 'resources'
      or exists (select 1 from public.resources r where r.storage_path = objects.name and r.is_current = true and r.is_deleted = false)
      or exists (select 1 from public.users u where u.auth_id = auth.uid() and u.status = 'Active' and btrim(coalesce(u.company, '')) = '품질보증부')
    )
  );

-- [4] public.resources: 현재본은 전원, 지난 판·숨긴 판(판 이력)은 품질보증부만 SELECT
drop policy "Enable ALL for authenticated users" on public.resources;
create policy resources_select_current_or_quality on public.resources
  as permissive for select to authenticated
  using ((is_current = true and is_deleted = false) or exists (select 1 from public.users u where u.auth_id = auth.uid() and u.status = 'Active' and btrim(coalesce(u.company, '')) = '품질보증부'));

-- [P9] POSTCHECK: 정의는 바뀌고 ACL/search_path/owner/정책 집합/RLS/트리거는 보존
do $postcheck$
declare
  v_oid oid;
begin
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'guard_users_admin';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'guard_users_admin') <> 1 then raise exception 'POST guard_users_admin: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) = 'ccd916796d6691b60303fead5f610435' then raise exception 'POSTCHECK guard_users_admin: definition not replaced'; end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'POST guard_users_admin: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{search_path=public}' then raise exception 'POST guard_users_admin: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'POST guard_users_admin: security definer/owner differs'; end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_publish_revision';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_publish_revision') <> 1 then raise exception 'POST resource_publish_revision: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) = 'cf4ff96b7a02c1c3134dc15a210d5537' then raise exception 'POSTCHECK resource_publish_revision: definition not replaced'; end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'POST resource_publish_revision: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{"search_path=pg_catalog, public"}' then raise exception 'POST resource_publish_revision: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'POST resource_publish_revision: security definer/owner differs'; end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_soft_delete';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_soft_delete') <> 1 then raise exception 'POST resource_soft_delete: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) = 'a75ddc446dc01ba2987fafa340e65736' then raise exception 'POSTCHECK resource_soft_delete: definition not replaced'; end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'POST resource_soft_delete: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{"search_path=pg_catalog, public"}' then raise exception 'POST resource_soft_delete: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'POST resource_soft_delete: security definer/owner differs'; end if;
  select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_restore';
  if v_oid is null or (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'resource_restore') <> 1 then raise exception 'POST resource_restore: missing or overloaded'; end if;
  if md5(pg_get_functiondef(v_oid)) = '93381178e874703961a67505d8447eda' then raise exception 'POSTCHECK resource_restore: definition not replaced'; end if;
  if (select proacl::text from pg_proc where oid = v_oid) is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then raise exception 'POST resource_restore: EXECUTE ACL differs, %', (select proacl::text from pg_proc where oid = v_oid); end if;
  if (select proconfig::text from pg_proc where oid = v_oid) is distinct from '{"search_path=pg_catalog, public"}' then raise exception 'POST resource_restore: search_path differs'; end if;
  if not (select prosecdef from pg_proc where oid = v_oid) or pg_get_userbyid((select proowner from pg_proc where oid = v_oid)) <> 'postgres' then raise exception 'POST resource_restore: security definer/owner differs'; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('resource_publish_revision','resource_soft_delete','resource_restore')
               and (pg_get_functiondef(oid) like '%is_admin%' or pg_get_functiondef(oid) not like '%품질보증부%')) then
    raise exception 'POSTCHECK: resource functions still use is_admin or miss quality predicate';
  end if;
  if pg_get_functiondef('public.guard_users_admin()'::regprocedure) not like '%new.company  is distinct from old.company%'
     or pg_get_functiondef('public.guard_users_admin()'::regprocedure) not like '%마지막 시스템 관리자는 해제할 수 없습니다%' then
    raise exception 'POSTCHECK: guard_users_admin content';
  end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
        and policyname in ('qms_files_authenticated_insert','qms_files_authenticated_read')) <> 2
     or (select count(*) from pg_policies where schemaname='storage' and tablename='objects') <> 2
     or (select count(*) from pg_policies where schemaname='public' and tablename='resources') <> 1
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='resources'
                      and policyname='resources_select_current_or_quality' and cmd='SELECT') then
    raise exception 'POSTCHECK: policy set mismatch';
  end if;
  if exists (select 1 from pg_policies where ((schemaname='storage' and tablename='objects') or (schemaname='public' and tablename='resources'))
               and coalesce(qual,'')||coalesce(with_check,'') like '%is_admin%') then
    raise exception 'POSTCHECK: is_admin left in resource policies';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.resources'::regclass)
     or not exists (select 1 from pg_trigger where tgrelid = 'public.users'::regclass and tgname = 'trg_guard_users_admin' and tgenabled = 'O') then
    raise exception 'POSTCHECK: RLS/trigger state';
  end if;
end
$postcheck$;

commit;

/* ===================== ROLLBACK (적용 뒤 되돌림 · 별도 승인 후 실행) =====================
   위 트랜잭션이 COMMIT 된 뒤에만 쓴다. 실패한 적용은 자동으로 전부 되돌아가므로 이 블록이 필요 없다.
   원문 = 2026-10-04 live 읽기 결과 그대로(md5 는 헤더 참고). CREATE OR REPLACE 라 EXECUTE ACL 은 그대로 남는다.

begin;
set local lock_timeout = '5s';
do $rb$ begin
  if (select system_identifier::text from pg_control_system()) <> '7623125441096521075' then raise exception 'ROLLBACK: not staging'; end if;
end $rb$;

CREATE OR REPLACE FUNCTION public.guard_users_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  jwt_role  text := coalesce(auth.jwt() ->> 'role', '');
  jwt_email text := coalesce(auth.jwt() ->> 'email', '');
  caller_admin boolean := false;
  admin_cnt int;
begin
  if jwt_role = '' then
    return coalesce(new, old);  -- 직접 SQL: 통제 대상 아님
  end if;

  if jwt_role = 'authenticated' then
    select coalesce(u.is_admin, false) into caller_admin
      from public.users u where u.auth_id = auth.uid() limit 1;
    caller_admin := coalesce(caller_admin, false);
  elsif jwt_role = 'service_role' then
    caller_admin := true;  -- 서버 API는 호출 전에 자체적으로 관리자를 검증한다
  else
    raise exception 'users 변경 권한이 없습니다';
  end if;

  -- [공통] is_admin=true 로 만들어지는 행은 실존 Auth 계정과 연결돼야 한다 (가짜 관리자 금지)
  if tg_op in ('INSERT','UPDATE') and new.is_admin = true then
    if new.auth_id is null
       or not exists (select 1 from auth.users au
                       where au.id = new.auth_id
                         and lower(au.email) = lower(new.email)) then
      raise exception '시스템 관리자는 실존 Auth 계정(이메일 일치)과 연결돼야 합니다';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if not caller_admin then
      -- 자기 가입 행만, 가입 규격 강제 (예림 합의 260830):
      -- 본인 auth_id · JWT 이메일 필수 일치 · role='employee' · status='Pending' · is_admin=false
      if new.auth_id is distinct from auth.uid()
         or jwt_email = ''
         or lower(new.email) is distinct from lower(jwt_email)
         or new.is_admin = true
         or lower(coalesce(new.role,'')) <> 'employee'
         or coalesce(new.status,'') <> 'Pending' then
        raise exception '회원 등록 권한이 없습니다 (가입 규격 위반)';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not caller_admin then
      if old.auth_id is distinct from auth.uid() then
        raise exception '다른 회원 정보를 변경할 권한이 없습니다';
      end if;
      if new.auth_id  is distinct from old.auth_id
         or new.email    is distinct from old.email
         or new.role     is distinct from old.role
         or new.is_admin is distinct from old.is_admin then
        raise exception '신원·권한 항목은 시스템 관리자만 변경할 수 있습니다';
      end if;
    end if;
    if old.is_admin = true and new.is_admin is not true then
      perform pg_advisory_xact_lock(hashtext('guard_users_admin'));
      select count(*) into admin_cnt from public.users where is_admin = true;
      if admin_cnt <= 1 then
        raise exception '마지막 시스템 관리자는 해제할 수 없습니다';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not caller_admin then
      raise exception '회원 삭제 권한이 없습니다';
    end if;
    if old.is_admin = true then
      perform pg_advisory_xact_lock(hashtext('guard_users_admin'));
      select count(*) into admin_cnt from public.users where is_admin = true;
      if admin_cnt <= 1 then
        raise exception '마지막 시스템 관리자 계정은 삭제할 수 없습니다';
      end if;
    end if;
    return old;
  end if;

  return coalesce(new, old);
end $function$;

CREATE OR REPLACE FUNCTION public.resource_publish_revision(p_id uuid, p_module text, p_module_label text, p_category text, p_category_label text, p_doc_key text, p_title text, p_description text, p_source_ref text, p_revision_note text, p_storage_path text, p_original_name text, p_file_size bigint, p_mime_type text, p_sha256 text)
 RETURNS resources
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
  select u.auth_id, u.name
    into v_actor_auth, v_actor_name
  from public.users u
  where u.auth_id = auth.uid()
    and u.status = 'Active'
    and u.is_admin = true
  limit 1;

  if not found then
    raise exception using errcode = '42501', message = 'resource_publish_revision: is_admin required';
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
  where r.id = p_id;
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
    p_id,p_module,v_module_label,p_category,p_category_label,p_doc_key,v_revision,
    p_title,coalesce(p_description,''),nullif(btrim(coalesce(p_source_ref,'')),''),coalesce(p_revision_note,''),
    'qms-files',p_storage_path,p_original_name,p_file_size,v_canonical_mime,p_sha256,
    v_actor_auth,v_actor_name,now(),
    true,false,null,null
  ) returning * into v_row;

  return v_row;
end $function$;

CREATE OR REPLACE FUNCTION public.resource_soft_delete(p_id uuid)
 RETURNS resources
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_auth uuid;
  v_row public.resources%rowtype;
begin
  select u.auth_id into v_actor_auth
  from public.users u
  where u.auth_id = auth.uid()
    and u.status = 'Active'
    and u.is_admin = true
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'resource_soft_delete: is_admin required';
  end if;

  select * into v_row
  from public.resources r
  where r.id = p_id
  for update;
  if not found then raise exception 'resource_soft_delete: resource not found'; end if;
  if v_row.is_deleted then return v_row; end if;

  update public.resources r
     set is_current = false,
         is_deleted = true,
         deleted_at = now(),
         deleted_by_auth = v_actor_auth
   where r.id = p_id
  returning * into v_row;

  return v_row;
end $function$;

CREATE OR REPLACE FUNCTION public.resource_restore(p_id uuid)
 RETURNS resources
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
  select u.auth_id into v_actor_auth
  from public.users u
  where u.auth_id = auth.uid() and u.status = 'Active' and u.is_admin = true
  limit 1;
  if not found then
    raise exception using errcode = '42501', message = 'resource_restore: is_admin required';
  end if;

  -- same module lock as resource_publish_revision, taken before the row lock
  select r.module into v_module from public.resources r where r.id = p_id;
  if not found then raise exception 'resource_restore: resource not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('resources-module:' || v_module, 0));

  select * into v_row from public.resources r where r.id = p_id for update;
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
   where r.id = p_id
  returning * into v_row;
  return v_row;
end $function$;

drop policy qms_files_authenticated_insert on storage.objects;
create policy qms_files_authenticated_insert on storage.objects
  as permissive for insert to authenticated
  with check (bucket_id = 'qms-files' and (split_part(name, '/', 1) <> 'resources'
    or (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.status = 'Active' and u.is_admin = true) and lower(coalesce(storage.extension(name), '')) = any (ARRAY['pdf'::text, 'png'::text, 'jpg'::text, 'jpeg'::text, 'webp'::text, 'gif'::text, 'doc'::text, 'docx'::text, 'xls'::text, 'xlsx'::text, 'ppt'::text, 'pptx'::text, 'csv'::text, 'txt'::text, 'zip'::text, 'hwp'::text, 'hwpx'::text]))));

drop policy qms_files_authenticated_read on storage.objects;
create policy qms_files_authenticated_read on storage.objects
  as permissive for select to authenticated
  using (bucket_id = 'qms-files' and (split_part(name, '/', 1) <> 'resources'
    or exists (select 1 from public.resources r where r.storage_path = objects.name and r.is_current = true and r.is_deleted = false)
    or exists (select 1 from public.users u where u.auth_id = auth.uid() and u.status = 'Active' and u.is_admin = true)));

drop policy resources_select_current_or_quality on public.resources;
create policy "Enable ALL for authenticated users" on public.resources as permissive for all to authenticated using (true) with check (true);

do $rbcheck$ begin
  if md5(pg_get_functiondef('public.guard_users_admin()'::regprocedure)) <> 'ccd916796d6691b60303fead5f610435'
     or md5(pg_get_functiondef('public.resource_soft_delete(uuid)'::regprocedure)) <> 'a75ddc446dc01ba2987fafa340e65736'
     or md5(pg_get_functiondef('public.resource_restore(uuid)'::regprocedure)) <> '93381178e874703961a67505d8447eda'
     or (select md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and proname='resource_publish_revision') <> 'cf4ff96b7a02c1c3134dc15a210d5537' then
    raise exception 'ROLLBACK CHECK: function hash not restored';
  end if;
  if (select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) from pg_policies where schemaname='storage' and tablename='objects' and policyname='qms_files_authenticated_insert') is distinct from 'd4a6170e8161af98b88f2974522f57cf' then raise exception 'ROLLBACK CHECK: policy qms_files_authenticated_insert'; end if;
  if (select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) from pg_policies where schemaname='storage' and tablename='objects' and policyname='qms_files_authenticated_read') is distinct from '7758e9fab5de843a0c04f82f02c90c98' then raise exception 'ROLLBACK CHECK: policy qms_files_authenticated_read'; end if;
  if (select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) from pg_policies where schemaname='public' and tablename='resources' and policyname='Enable ALL for authenticated users') is distinct from 'fe2e7aa3a94b94b876d7713f1517686d' then raise exception 'ROLLBACK CHECK: policy Enable ALL for authenticated users'; end if;
end $rbcheck$;
commit;
   ======================================================================================= */
