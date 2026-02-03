-- [A/S] 누락된 칸 최종 보수 공사
-- 아까 빠진 칸들만 콕 집어서 추가합니다!

-- 1. 사용자 테이블 (Role=권한 칸이 없었네요!)
alter table users add column if not exists role text;
alter table users add column if not exists company text;

-- 2. 공지사항 (Type=분류 칸 추가)
alter table notices add column if not exists type text;
alter table notices add column if not exists author text;

-- 3. 자료실 (Attachment=첨부파일 칸 추가)
alter table resources add column if not exists attachment text;
alter table resources add column if not exists type text;
alter table resources add column if not exists author text;
