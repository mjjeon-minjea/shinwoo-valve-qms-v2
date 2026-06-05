---
name: supabase-postgres-best-practices
description: Supabase의 Postgres 성능 최적화 및 모범 사례 가이드라인입니다. Postgres 쿼리 작성, 스키마 설계, 데이터베이스 구성 및 최적화 검토 시 이 스킬을 사용합니다.
license: MIT
metadata:
  author: supabase
  version: "1.1.1"
  organization: Supabase
  date: January 2026
  abstract: Supabase와 Postgres를 사용하는 개발자를 위한 포괄적인 성능 최적화 가이드입니다. 쿼리 성능, 연결 관리, 보안(RLS) 등 총 8개 카테고리에 걸쳐 중요도에 따라 정리되어 있습니다. 각 규칙은 설명, 올바른/잘못된 SQL 예시, 쿼리 계획 분석 등을 포함합니다.
---

# Supabase Postgres 모범 사례 (Supabase Postgres Best Practices)

Supabase에서 제공하는 Postgres 성능 최적화 가이드입니다. 자동화된 쿼리 최적화 및 스키마 설계를 안내하기 위해 영향도에 따른 8개 카테고리의 규칙을 수록하고 있습니다.

## 적용 시점 (When to Apply)

다음 작업 시 본 가이드를 참조하십시오:
- SQL 쿼리를 작성하거나 스키마를 설계할 때
- 인덱스를 설계하고 쿼리 성능을 최적화할 때
- 데이터베이스 성능 관련 이슈를 검토할 때
- 커넥션 풀링(Connection Pooling) 또는 데이터베이스 스케일링을 구성할 때
- Postgres 전용 기능을 최적화하여 사용하고자 할 때
- 행 단위 보안(RLS, Row-Level Security)을 설계 및 적용할 때

## 우선순위별 규칙 카테고리 (Rule Categories by Priority)

| 우선순위 | 카테고리 | 영향도 | 접두사 |
|----------|----------|--------|--------|
| 1 | 쿼리 성능 최적화 | 심각 (CRITICAL) | `query-` |
| 2 | 커넥션 관리 | 심각 (CRITICAL) | `conn-` |
| 3 | 보안 및 행 단위 보안(RLS) | 심각 (CRITICAL) | `security-` |
| 4 | 스키마 설계 | 높음 (HIGH) | `schema-` |
| 5 | 동시성 및 잠금(Locking) | 중간-높음 (MEDIUM-HIGH) | `lock-` |
| 6 | 데이터 접근 패턴 | 중간 (MEDIUM) | `data-` |
| 7 | 모니터링 및 진단 | 낮음-중간 (LOW-MEDIUM) | `monitor-` |
| 8 | 고급 기능 활용 | 낮음 (LOW) | `advanced-` |

## 사용 방법 (How to Use)

세부 규칙 설명과 SQL 예제는 개별 규칙 파일을 참조하십시오:

```
references/query-missing-indexes.md
references/query-partial-indexes.md
references/_sections.md
```

각 규칙 파일은 다음으로 구성되어 있습니다:
- 해당 규칙이 중요한 이유에 대한 간략한 설명
- 잘못된 SQL 예시와 그에 대한 설명
- 올바른 SQL 예시와 그에 대한 설명
- 선택적으로 EXPLAIN 결과 또는 지표 분석
- 추가적인 컨텍스트 및 참고 자료 링크
- Supabase 전용 유의 사항 (해당하는 경우)

## 참고 자료 (References)

- https://www.postgresql.org/docs/current/
- https://supabase.com/docs
- https://wiki.postgresql.org/wiki/Performance_Optimization
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/auth/row-level-security
