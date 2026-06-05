---
name: finishing-a-development-branch
description: 구현이 완료되고 모든 테스트가 통과했을 때, 해당 작업을 어떻게 통합할지 결정해야 하는 경우에 사용합니다. 로컬 머지, PR 생성, 브랜치 보존, 또는 작업 폐기와 같은 구조화된 옵션을 제공하여 개발 작업의 마무리를 안내합니다.
---

# 개발 브랜치 마무리 (Finishing a Development Branch)

## 개요 (Overview)

명확한 옵션을 제시하고 사용자가 선택한 워크플로우를 처리함으로써 개발 작업의 마무리를 안내합니다.

**핵심 원칙:** 테스트 검증 → 환경 감지 → 옵션 제시 → 선택 사항 실행 → 작업 공간 정리.

**시작 시 안내 메시지:** "작업을 마무리하기 위해 finishing-a-development-branch 스킬을 사용합니다."

## 프로세스 (The Process)

### 1단계: 테스트 검증 (Verify Tests)

**옵션을 제시하기 전에, 테스트가 정상적으로 통과하는지 먼저 확인합니다:**

```bash
# 프로젝트의 테스트 스위트 실행
npm test / cargo test / pytest / go test ./...
```

**테스트가 실패하는 경우:**
```
테스트 실패 (<N>개 실패). 작업을 마무리하기 전에 수정해야 합니다:

[실패 로그 표시]

테스트가 모두 통과하기 전에는 머지나 PR을 진행할 수 없습니다.
```

동작을 멈추고 2단계로 진행하지 않습니다.

**테스트가 통과하는 경우:** 2단계로 진행합니다.

### 2단계: 환경 감지 (Detect Environment)

**옵션을 제시하기 전에 작업 공간의 상태를 파악합니다:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

이 결과에 따라 제시할 메뉴와 정리(cleanup) 방식이 결정됩니다:

| 상태 | 제공할 메뉴 | 정리 방식 |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (일반 저장소) | 표준 4가지 옵션 | 정리할 작업 트리(worktree) 없음 |
| `GIT_DIR != GIT_COMMON`, 이름 있는 브랜치 | 표준 4가지 옵션 | 출처 기반 정리 (6단계 참조) |
| `GIT_DIR != GIT_COMMON`, 분리된 HEAD (detached HEAD) | 축소된 3가지 옵션 (머지 없음) | 정리 안 함 (외부 관리됨) |

### 3단계: 기준 브랜치 확인 (Determine Base Branch)

```bash
# 일반적인 기준 브랜치 찾기
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

또는 사용자에게 물어봅니다: "이 브랜치는 main에서 분기된 것이 맞습니까?"

### 4단계: 옵션 제시 (Present Options)

**일반 저장소 및 이름 있는 브랜치 작업 트리인 경우 — 정확히 아래 4가지 옵션을 제시합니다:**

```
구현이 완료되었습니다. 어떻게 진행하시겠습니까?

1. 로컬에서 <기준-브랜치>로 머지하기 (Merge locally)
2. 변경 사항을 원격에 푸시하고 풀 리퀘스트(PR) 생성하기
3. 브랜치를 현재 상태 그대로 보존하기 (나중에 처리)
4. 현재 작업 내용을 폐기하기 (Discard)

선택하실 옵션 번호를 입력해 주세요.
```

**분리된 HEAD (detached HEAD)인 경우 — 정확히 아래 3가지 옵션을 제시합니다:**

```
구현이 완료되었습니다. 현재 외부에서 관리되는 작업 공간(detached HEAD) 상태입니다.

1. 새 브랜치로 푸시하고 풀 리퀘스트(PR) 생성하기
2. 현재 상태 그대로 보존하기 (나중에 처리)
3. 현재 작업 내용을 폐기하기 (Discard)

선택하실 옵션 번호를 입력해 주세요.
```

**구구절절한 설명을 덧붙이지 말고** 옵션을 간결하게 제시하십시오.

### 5단계: 선택 사항 실행 (Execute Choice)

#### 옵션 1: 로컬 머지 (Merge Locally)

```bash
# 안전한 작업 디렉토리(CWD) 확보를 위해 메인 저장소 루트로 이동
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# 머지 먼저 수행 — 무언가를 삭제하기 전에 머지 성공 여부를 확인
git checkout <base-branch>
git pull
git merge <feature-branch>

# 머지된 결과물에서 테스트 재검증
<test command>
```

머지가 성공한 후에만 작업 트리를 정리(6단계)하고 브랜치를 삭제합니다:

```bash
git branch -d <feature-branch>
```

#### 옵션 2: 푸시 및 PR 생성 (Push and Create PR)

```bash
# 브랜치 푸시
git push -u origin <feature-branch>

# PR 생성
gh pr create --title "<제목>" --body "$(cat <<'EOF'
## 요약 (Summary)
- <변경 사항 핵심 요약 2~3개 항목>

## 테스트 계획 (Test Plan)
- [ ] <검증 단계>
EOF
)"
```

**작업 트리를 정리하지 마십시오.** 사용자가 PR 피드백을 반영하여 수정할 수 있도록 작업 트리를 유지해야 합니다.

#### 옵션 3: 현재 상태 유지 (Keep As-Is)

다음과 같이 안내합니다: "<name> 브랜치를 유지합니다. 작업 트리가 <path>에 보존되었습니다."

**작업 트리를 정리하지 않습니다.**

#### 옵션 4: 작업 폐기 (Discard)

**먼저 사용자의 확인을 구합니다:**
```
이 작업은 다음 항목들을 영구적으로 삭제합니다:
- 브랜치: <name>
- 모든 커밋 리스트: <commit-list>
- 작업 트리 경로: <path>

계속하려면 'discard'를 타이핑하여 승인해 주십시오.
```

정확한 승인 단어가 입력될 때까지 대기합니다.

승인 시:
```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

그 후 작업 트리를 정리(6단계)하고 브랜치를 강제 삭제합니다:
```bash
git branch -D <feature-branch>
```

### 6단계: 작업 공간 정리 (Cleanup Workspace)

**옵션 1과 옵션 4를 선택한 경우에만 실행됩니다.** 옵션 2와 3은 항상 작업 트리를 유지합니다.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**`GIT_DIR == GIT_COMMON`인 경우:** 일반 저장소이므로 정리할 작업 트리가 없습니다. 작업을 종료합니다.

**작업 트리 경로가 `.worktrees/`, `worktrees/`, 또는 `~/.config/superpowers/worktrees/` 하위에 있는 경우:** 에이전트 시스템에서 생성한 작업 트리이므로 직접 삭제를 책임집니다.

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # 유효하지 않은 작업 트리 등록 정보 정리
```

**그 외의 경우:** 실행 환경(Harness)에서 생성하고 관리하는 작업 공간이므로 함부로 삭제해서는 안 됩니다. 플랫폼에서 제공하는 작업 공간 종료(exit) 도구가 있다면 그것을 사용하고, 없다면 작업 공간을 그대로 둡니다.

## 빠른 참조 (Quick Reference)

| 옵션 | 머지 수행 | 푸시 수행 | 작업 트리 유지 | 브랜치 정리 |
|--------|-------|------|---------------|----------------|
| 1. 로컬 머지 | 예 | - | - | 예 |
| 2. PR 생성 | - | 예 | 예 | - |
| 3. 상태 유지 | - | - | 예 | - |
| 4. 작업 폐기 | - | - | - | 예 (강제) |

## 자주 발생하는 실수 (Common Mistakes)

**테스트 검증 생략**
- **문제:** 오류가 있는 코드를 머지하거나 실패하는 PR을 생성하게 됨.
- **해결책:** 옵션을 제시하기 전에 항상 테스트 통과 여부를 검증하십시오.

**모호한 질문 제시**
- **문제:** "다음 단계로 어떻게 할까요?"와 같은 질문은 대응하기 모호함.
- **해결책:** 구조화된 4가지 옵션(detached HEAD는 3가지)을 정확히 제시하십시오.

**옵션 2 선택 시 작업 트리 정리**
- **문제:** 사용자가 PR 피드백을 반영해 수정해야 하는 작업 트리를 지워버림.
- **해결책:** 정리 작업은 옵션 1과 4의 경우에만 수행하십시오.

**작업 트리 제거 전에 브랜치 삭제**
- **문제:** 작업 트리가 여전히 브랜치를 참조하고 있어 `git branch -d` 명령이 실패함.
- **해결책:** 머지 완료 후 작업 트리를 먼저 삭제하고 브랜치를 삭제하십시오.

**삭제 대상 작업 트리 내부에서 `git worktree remove` 실행**
- **문제:** 현재 작업 디렉토리(CWD)가 삭제하려는 작업 트리 내부인 경우 명령이 실패하거나 무시됨.
- **해결책:** 항상 메인 저장소 루트로 `cd`한 뒤 `git worktree remove`를 실행하십시오.

**실행 환경(Harness) 소유의 작업 트리 정리**
- **문제:** 환경이 만든 작업 트리를 임의로 지우면 상태 불일치 에러가 발생함.
- **해결책:** `.worktrees/`, `worktrees/`, 또는 `~/.config/superpowers/worktrees/` 하위에 위치한 작업 트리만 정리하십시오.

**작업 폐기(Discard) 시 확인 절차 생략**
- **문제:** 실수로 아까운 개발 작업물을 날려버림.
- **해결책:** 사용자가 직접 "discard"를 입력해 승인하도록 확인 단계를 거치십시오.

## 금지 및 필수 사항 (Red Flags & Commitments)

**절대 금지 (Never):**
- 테스트가 실패하는 상황에서 진행
- 최종 병합 결과물에 대한 테스트 검증 없이 로컬 머지 완료
- 사용자 확인 없이 작업물 영구 삭제
- 명시적 요청 없이 강제 푸시(`force-push`) 실행
- 머지 성공을 확인하기 전에 작업 트리 삭제
- 직접 생성하지 않은 작업 트리 임의 삭제 (출처 검증 필수)
- 삭제할 작업 트리 내부에서 `git worktree remove` 실행

**항상 실행 (Always):**
- 옵션을 제시하기 전에 먼저 테스트 실행 및 검증
- 메뉴를 보여주기 전에 Git 환경(작업 공간 구조) 감지
- 표준 4가지 옵션(detached HEAD의 경우 3가지)을 명확히 제시
- 옵션 4(폐기) 실행 시 타이핑 확인 획득
- 작업 트리 정리는 옵션 1과 4에만 한하여 실행
- 작업 트리 제거 실행 전에 메인 저장소 루트로 디렉토리 이동
- 작업 트리 삭제 후 `git worktree prune` 실행
