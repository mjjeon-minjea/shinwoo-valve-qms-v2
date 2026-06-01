import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const STAGING_URL = 'https://srzaanvojyhwzugoaimk.supabase.co';
const STAGING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyemFhbnZvanlod3p1Z29haW1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTE0NzksImV4cCI6MjA5MDc4NzQ3OX0.2C8p28n-sFKGjy8__LgCAOT0t0oJEfGY0kdZ8W7Ifgc';

const PROD_URL = 'https://zuahpjdsypovxdplxryw.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1YWhwamRzeXBvdnhkcGx4cnl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTgyMzgsImV4cCI6MjA5NTMzNDIzOH0.P3U-O5WGi6QJ-jLeRpXqMk6PrEBFyMgaVDRx3IZuJ-k';

const stagingSupabase = createClient(STAGING_URL, STAGING_KEY);
const prodSupabase = createClient(PROD_URL, PROD_KEY);

async function runMigration() {
    console.log('🚀 [QMS v2 데이터 이관] 중복 자가 교정 및 RLS 우회 탑재 이관 엔진 기동...');

    try {
        // 1. Staging DB 데이터 조회 및 사전 백업
        console.log('\n[1단계] Staging DB 데이터 조회 및 로컬 영구 백업...');
        
        const { data: stagingUsers, error: usersFetchErr } = await stagingSupabase
            .from('users')
            .select('*');
        if (usersFetchErr) throw new Error(`Staging users Fetch 실패: ${usersFetchErr.message}`);

        const { data: stagingReports, error: reportsFetchErr } = await stagingSupabase
            .from('weekly_reports')
            .select('*');
        if (reportsFetchErr) throw new Error(`Staging weekly_reports Fetch 실패: ${reportsFetchErr.message}`);

        console.log(`- Staging users: ${stagingUsers.length}건`);
        console.log(`- Staging weekly_reports: ${stagingReports.length}건`);

        // 로컬 백업 저장
        const backupDir = path.resolve('scripts');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(path.join(backupDir, 'staging_users_backup.json'), JSON.stringify(stagingUsers, null, 2), 'utf-8');
        fs.writeFileSync(path.join(backupDir, 'staging_weekly_reports_backup.json'), JSON.stringify(stagingReports, null, 2), 'utf-8');
        console.log('- 로컬 이중 백업 완료.');

        // 2. Production DB Auth 회원가입 및 세션 획득
        console.log('\n[2단계] Production DB 사용자 계정 회원가입 및 세션 획득 진행...');
        
        const authIdMap = {}; // { staging_auth_id: prod_auth_id }
        const userClients = {}; // { prod_auth_id: supabaseClient }

        for (const user of stagingUsers) {
            console.log(`- 사용자 [${user.name}] (${user.email}) 처리 중...`);
            
            // 2-1. 회원가입 시도
            const { data: signUpData, error: signUpErr } = await prodSupabase.auth.signUp({
                email: user.email,
                password: user.password,
                options: {
                    data: {
                        name: user.name
                    }
                }
            });

            if (signUpErr && !signUpErr.message.includes('already registered')) {
                console.warn(`  ⚠️ 가입 오류 경고 (무시 가능): ${signUpErr.message}`);
            }

            // 2-2. 로그인하여 세션 획득
            const { data: signInData, error: signInErr } = await prodSupabase.auth.signInWithPassword({
                email: user.email,
                password: user.password
            });

            if (signInErr) {
                throw new Error(`  ❌ [${user.name}] 로그인 실패: ${signInErr.message}`);
            }

            const session = signInData.session;
            const prodAuthId = session.user.id;
            console.log(`  ➔ 로그인 성공. Production UID: ${prodAuthId}`);

            // Staging auth_id와 Production auth_id 매핑 테이블 저장
            authIdMap[user.auth_id] = prodAuthId;
            authIdMap[user.id] = prodAuthId;

            // 해당 유저 전용 인증 헤더 클라이언트 생성
            userClients[prodAuthId] = createClient(PROD_URL, PROD_KEY, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                },
                global: {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                }
            });

            // 2-3. [중요] 이전 실행에서 잘못 삽입된 중복 행 (id가 prodAuthId 와 같은 행) 클린업
            console.log(`  ➔ 이전 중복 데이터 클린업 시도 (ID: ${prodAuthId})...`);
            const { error: cleanupErr } = await userClients[prodAuthId]
                .from('users')
                .delete()
                .eq('id', prodAuthId);

            if (cleanupErr) {
                console.warn(`  ⚠️ 클린업 오류 경고 (무시 가능): ${cleanupErr.message}`);
            }

            // 2-4. 본인 세션으로 public.users 테이블 정보 업데이트
            // RLS 정책 상 auth.uid() = auth_id 인 행만 변경 가능합니다.
            // 트리거가 자동 생성해 둔 기존 행(PK id 가 Staging 원래 ID로 기입되어 있음)을 Upsert로 덮어씁니다!
            console.log(`  ➔ [${user.name}] public.users 프로필 동기화 중...`);
            const profileData = {
                id: user.id, // PK를 Staging의 원래 고유 ID로 유지!!
                auth_id: prodAuthId, // auth_id 필드에만 새로 발급된 UID 대입
                email: user.email,
                password: user.password,
                name: user.name,
                company: user.company,
                role: user.role,
                rank: user.rank,
                date: user.date,
                status: user.status
            };

            const { error: profileErr } = await userClients[prodAuthId]
                .from('users')
                .upsert(profileData, { onConflict: 'id' });

            if (profileErr) {
                throw new Error(`  ❌ [${user.name}] 프로필 DB 업데이트 실패: ${profileErr.message}`);
            }
            console.log(`  ✅ [${user.name}] 프로필 동기화 완료.`);
        }

        // 3. 주간업무보고 데이터 이관 (작성자 매핑 치환 후 본인 세션으로 Upsert)
        console.log('\n[3단계] 주간업무보고 데이터 작성자 정보 매핑 치환 및 이관...');
        
        const mappedReports = stagingReports.map(report => {
            const prodAuthorId = authIdMap[report.authorId];
            if (!prodAuthorId) {
                console.warn(`⚠️ [경고] 보고서 ID ${report.id}의 작성자 auth_id 매핑을 찾을 수 없습니다: ${report.authorId}`);
            }
            return {
                ...report,
                authorId: prodAuthorId || report.authorId
            };
        });

        console.log(`- 작성자 매핑 치환 완료 (총 ${mappedReports.length}건)`);

        console.log('\n[4단계] 작성자 본인 세션을 사용한 주간업무보고 Upsert 진행...');
        
        let successCount = 0;
        for (const report of mappedReports) {
            const client = userClients[report.authorId];
            if (!client) {
                console.error(`❌ 작성자 ${report.authorName} (${report.authorId})의 인증 세션 클라이언트가 없습니다.`);
                continue;
            }

            const { error: reportUpsertErr } = await client
                .from('weekly_reports')
                .upsert(report, { onConflict: 'id' });

            if (reportUpsertErr) {
                console.error(`❌ [보고서 ID ${report.id}] 작성자 ${report.authorName} 이송 실패: ${reportUpsertErr.message}`);
            } else {
                successCount++;
            }
        }

        console.log(`- 주간업무보고 Upsert 완료: 총 ${mappedReports.length}건 중 ${successCount}건 성공`);

        // 4. 이관 후 최종 데이터 카운트 정밀 대조 및 검증
        console.log('\n[5단계] Production DB 최종 적재 상태 및 건수 정밀 대조 검증...');
        
        const managerAuthId = authIdMap['6a40cb30-1c44-4404-bb1e-433344028380'] || authIdMap['1'];
        const verifierClient = userClients[managerAuthId] || prodSupabase;

        const { data: prodUsers, error: prodUsersErr } = await verifierClient.from('users').select('id');
        if (prodUsersErr) throw new Error(`Prod users 검증 조회 실패: ${prodUsersErr.message}`);

        const { data: prodReports, error: prodReportsErr } = await verifierClient.from('weekly_reports').select('id');
        if (prodReportsErr) throw new Error(`Prod reports 검증 조회 실패: ${prodReportsErr.message}`);

        console.log(`- [검증 결과] Production DB users 최종 적재 건수: ${prodUsers.length}건`);
        console.log(`- [검증 결과] Production DB weekly_reports 최종 적재 건수: ${prodReports.length}건`);

        const isUsersMatch = prodUsers.length === stagingUsers.length;
        const isReportsMatch = prodReports.length === stagingReports.length;

        console.log('\n==================================================');
        if (isUsersMatch && isReportsMatch) {
            console.log('✅ [검증 대성공] Staging DB와 Production DB의 데이터 건수가 100% 무결하게 일치합니다!');
            console.log(`- users: Staging ${stagingUsers.length}건 === Production ${prodUsers.length}건`);
            console.log(`- weekly_reports: Staging ${stagingReports.length}건 === Production ${prodReports.length}건`);
        } else {
            console.error('❌ [검증 실패] 적재된 데이터 건수 정합성 불일치!');
            console.error(`- users: Staging ${stagingUsers.length}건 | Production ${prodUsers.length}건`);
            console.error(`- weekly_reports: Staging ${stagingReports.length}건 | Production ${prodReports.length}건`);
        }
        console.log('==================================================');

    } catch (err) {
        console.error('\n❌ [이관 장애 발생] 마이그레이션이 비정상 중단되었습니다.');
        console.error(err.message);
        process.exit(1);
    }
}

runMigration();
