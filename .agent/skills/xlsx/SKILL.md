---
name: xlsx
description: 스프레드시트 파일(xlsx, xlsm, csv, tsv)이 작업의 주요 입력 또는 출력물인 경우 이 스킬을 호출합니다. 기존 파일 읽기, 편집, 수식 계산, 서식 설정, 차트 생성, 난잡한 데이터의 정제 및 구조화, 다양한 표 형식 파일 간의 변환 작업 등을 포괄합니다.
license: Proprietary. LICENSE.txt has complete terms
---

# 스프레드시트 처리 가이드 (Spreadsheet Processing Guide)

## 출력물 요구사항 (Requirements for Outputs)

### 모든 Excel 파일 공통 규칙

#### Professional Font
- 사용자의 별도 요청이 없다면, 최종 산출물 전체에 일관되고 프로페셔널한 폰트(예: Arial, Times New Roman, 맑은 고딕 등)를 일관되게 사용하십시오.

#### 수식 에러 제로 (Zero Formula Errors)
- 제공하는 모든 Excel 모델은 수식 에러(`#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?` 등)가 **단 하나도 없어야(ZERO)** 합니다.

#### 기존 템플릿 보존 (템플릿 파일 수정 시)
- 기존 파일을 수정할 때는 파일의 형식, 스타일, 컨벤션을 면밀히 파악하여 **동일하게 유지**하십시오.
- 이미 정립된 패턴이 있는 파일에 무리하게 표준 서식을 강제하여 변경하지 마십시오.
- 기존 템플릿의 서식 규칙이 항상 이 가이드라인보다 우선합니다.

## 재무 모델 (Financial Models)

### 색상 코드 표준 (Color Coding Standards)
사용자 또는 기존 템플릿의 별도 지침이 없는 경우 적용되는 업계 표준 색상 규칙:

- **파란색 텍스트 (RGB: 0, 0, 255)**: 하드코딩된 입력값 및 시나리오별로 사용자가 직접 변경할 숫자값
- **검은색 텍스트 (RGB: 0, 0, 0)**: 모든 수식 및 계산 결과값
- **초록색 텍스트 (RGB: 0, 128, 0)**: 동일 통합 문서 내의 다른 시트에서 참조하여 가져온 값 (참조 링크)
- **빨간색 텍스트 (RGB: 255, 0, 0)**: 다른 외부 파일로부터 가져온 외부 참조 링크
- **노란색 배경색 (RGB: 255, 255, 0)**: 주의가 필요한 주요 가정(Assumption) 또는 업데이트가 필요한 셀

### 숫자 서식 표준 (Number Formatting Standards)

#### 필수 형식 규칙
- **연도 (Years)**: 숫자가 아닌 텍스트 문자열로 서식을 지정합니다 (예: "2024"로 표기하며, "2,024"와 같이 쉼표가 들어가지 않도록 함).
- **통화 (Currency)**: `$#,##0` 또는 `₩#,##0` 형식을 사용하며, 헤더 영역에 단위를 항상 명시합니다 (예: "매출액 (백만 원)").
- **숫자 0 표기**: 백분율을 포함한 모든 0값은 셀 서식을 통해 하이픈(`-`)으로 표기되도록 설정합니다 (예: `₩#,##0;(₩#,##0);-`).
- **백분율 (Percentages)**: 기본적으로 소수점 첫째 자리까지(`0.0%`) 표기합니다.
- **배수 (Multiples)**: 밸류에이션 배수(EV/EBITDA, P/E 등)는 소수점 첫째 자리와 x를 결합하여 `0.0x` 형태로 표기합니다.
- **음수 표기**: 마이너스 기호(`-123`) 대신 괄호 `(123)` 형식을 사용합니다.

### 수식 작성 규칙 (Formula Construction Rules)

#### 가정(Assumption) 입력 셀의 격리
- 모든 입력 변수 및 가정(성장률, 마진율, 배수 등)은 계산 수식과 분리하여 독립된 셀에 배치하십시오.
- 수식 내에 하드코딩된 값을 넣지 말고, 해당 변수가 선언된 셀 주소를 참조하십시오.
- 예시: `=B5*1.05` 대신 `=B5*(1+$B$6)` 형태로 작성합니다.

#### 수식 오류 방지
- 모든 셀 참조 주소가 올바른지 검증합니다.
- 범위 지정 시 오프셋 오류(하나씩 밀리는 현상)가 없는지 확인합니다.
- 예측 기간 전체에 걸쳐 수식이 일관되게 적용되었는지 확인합니다.
- 경계값(0값, 음수 등)을 대입하여 에러 발생 여부를 사전 검증합니다.
- 의도하지 않은 순환 참조(Circular Reference)가 없는지 확인합니다.

#### 하드코딩 값의 출처 명시
- 수식 없이 직접 입력한 하드코딩 값에 대해서는 해당 셀이나 테이블 끝에 주석을 달아 출처를 기록하십시오.
- 포맷: "출처: [시스템/문서명], [날짜], [상세 세부정보], [URL(가능한 경우)]"
- 예시:
  - "출처: 공시 10-K, FY2024, 45페이지, 매출액 주석"
  - "출처: Bloomberg Terminal, 2025-08-15, AAPL US Equity"

---

# XLSX 생성, 편집 및 분석 가이드

## 개요 (Overview)

사용자가 Excel 파일의 생성, 수정 또는 데이터 분석을 요청할 때 적절한 라이브러리와 워크플로우를 선택하여 처리합니다.

## 중요 요구사항 (Important Requirements)

**수식 재계산을 위한 LibreOffice 활용**: 수식을 작성 또는 수정한 경우, `scripts/recalc.py` 스크립트를 사용하여 수식 계산값을 새로 고침할 수 있습니다. 시스템에 LibreOffice가 설치되어 있다고 가정하고 작동합니다.

## 데이터 읽기 및 분석 (Reading and analyzing data)

### Pandas를 활용한 데이터 분석
데이터 분석, 시각화 및 기본 표 조작에는 강력한 조작 기능을 지원하는 **pandas**를 사용합니다:

```python
import pandas as pd

# Excel 파일 읽기
df = pd.read_excel('file.xlsx')  # 기본값: 첫 번째 시트 로드
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # 모든 시트를 dict 형태로 로드

# 데이터 분석
df.head()      # 상위 데이터 미리보기
df.info()      # 컬럼 정보 및 타입 확인
df.describe()  # 기초 통계량 확인

# Excel 파일 저장
df.to_excel('output.xlsx', index=False)
```

## Excel 파일 처리 워크플로우 (Excel File Workflows)

## 🚨 매우 중요: 하드코딩 대신 Excel 수식 사용
**Python 코드 내에서 연산을 완료한 뒤 결과값만 셀에 주입하지 말고, 반드시 Excel 수식 문자열을 입력하십시오.** 그래야 사용자가 파일을 열었을 때 데이터가 동적으로 변경 및 업데이트될 수 있습니다.

### ❌ 잘못된 예시 - 계산된 결과값을 직접 셀에 주입 (Hardcoding)
```python
# Bad: Python에서 합계를 계산하여 값만 입력
total = df['Sales'].sum()
sheet['B10'] = total  # 5000 이라는 숫자가 하드코딩됨

# Bad: Python에서 성장률을 계산하여 값만 입력
growth = (df.iloc[-1]['Revenue'] - df.iloc[0]['Revenue']) / df.iloc[0]['Revenue']
sheet['C5'] = growth  # 0.15 라는 숫자가 하드코딩됨

# Bad: Python에서 평균값 계산
avg = sum(values) / len(values)
sheet['D20'] = avg  # 42.5 라는 숫자가 하드코딩됨
```

### ✅ 올바른 예시 - Excel 수식 문자열 주입
```python
# Good: Excel의 SUM 함수 적용
sheet['B10'] = '=SUM(B2:B9)'

# Good: Excel 수식으로 성장률 작성
sheet['C5'] = '=(C4-C2)/C2'

# Good: Excel의 AVERAGE 함수 적용
sheet['D20'] = '=AVERAGE(D2:D19)'
```

합계, 백분율, 비율, 차이 등 모든 연산 부위에 동일하게 적용됩니다. 원본 데이터가 바뀌면 Excel 내에서 자동으로 재계산되어야 합니다.

## 일반적인 워크플로우 절차
1. **도구 선정**: 단순 데이터 핸들링은 pandas, 수식 및 스타일 지정은 openpyxl을 사용합니다.
2. **파일 로드/생성**: 신규 워크북을 만들거나 기존 파일을 로드합니다.
3. **편집 및 주입**: 데이터, 수식, 서식을 추가하거나 수정합니다.
4. **저장**: 파일로 저장합니다.
5. **수식 재계산 (수식을 작성한 경우 필수)**: `scripts/recalc.py` 스크립트를 구동하여 계산값을 반영시킵니다.
   ```bash
   python scripts/recalc.py output.xlsx
   ```
6. **오류 검증 및 수정**:
   - 스크립트 실행 결과 에러가 보고되면 JSON 상세 에러 정보를 확인합니다.
   - `status`가 `errors_found`인 경우, `error_summary`를 통해 깨진 수식 종류와 해당 셀 위치를 확인하여 수정하고 재계산합니다.

### openpyxl을 활용한 신규 Excel 생성 예시
```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# 데이터 추가
sheet['A1'] = 'Hello'
sheet['B1'] = 'World'
sheet.append(['Row', 'of', 'data'])

# 수식 추가
sheet['B2'] = '=SUM(A1:A10)'

# 서식 적용
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')

# 열 너비 조정
sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
```

### openpyxl을 활용한 기존 Excel 수정 예시
```python
from openpyxl import load_workbook

# 기존 파일 로드 (수식 자체를 유지하기 위해 data_only 옵션 없이 로드)
wb = load_workbook('existing.xlsx')
sheet = wb.active

# 여러 시트 순회 처리
for sheet_name in wb.sheetnames:
    sheet = wb[sheet_name]
    print(f"시트명: {sheet_name}")

# 셀 수정 및 행/열 조작
sheet['A1'] = 'New Value'
sheet.insert_rows(2)  # 2번째 위치에 행 삽입
sheet.delete_cols(3)  # 3번째 열 삭제

# 신규 시트 추가
new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save('modified.xlsx')
```

## 수식 검증 체크리스트 (Formula Verification Checklist)

최종 파일을 제공하기 전에 아래 사항을 점검하십시오:

- [ ] **샘플 검증**: 전체 수식을 적용하기 전에 2~3개 셀에서 샘플 수식이 올바른 값을 가리키는지 확인했는가
- [ ] **열 매핑 검증**: 대입할 열 알파벳이 데이터 구조와 정확히 일치하는가 (예: 64번째 열은 BK가 아닌 BL인지 검산)
- [ ] **행 인덱스 오프셋**: DataFrame의 0-indexed 행 and Excel의 1-indexed 행 간의 불일치를 보정했는가 (DataFrame의 5행은 Excel의 6행에 해당)
- [ ] **결측치(NaN) 처리**: 결측 데이터를 `pd.notna()` 등으로 예외 처리했는가
- [ ] **나누기 0 에러 방지**: 분모가 0이 될 수 있는 수식의 경우 사전에 조건을 걸어 분기 처리했는가 (`#DIV/0!` 방지)
- [ ] **유효한 참조 검증**: 삭제되거나 누락된 셀을 가리키는 오류가 없는가 (`#REF!` 방지)
- [ ] **시트 간 참조**: 다른 시트의 셀을 참조할 때 느낌표 형식(`SheetName!A1`)을 올바르게 준수했는가

## 개발 모범 사례 (Best Practices)

- **openpyxl 사용 시 유의 사항**:
  - 수식 문자열은 그대로 두고 계산된 결과값만 읽어오고 싶은 경우 `load_workbook('file.xlsx', data_only=True)`를 사용하십시오.
  - **주의**: `data_only=True` 옵션으로 파일을 열어서 그대로 `save()`해 버리면, 기존 파일 내의 모든 수식이 날아가고 최종 결과값 숫자로 완전히 대체되어 영구 소실됩니다. 수식을 보존해야 한다면 절대 이 옵션으로 로드한 워크북을 덮어쓰기 저장하지 마십시오.
  - 대용량 파일의 경우 메모리 절약을 위해 `read_only=True` 또는 `write_only=True` 모드를 적용하십시오.
- **Python 코드 작성 스타일 지침**:
  - Excel 처리를 위한 Python 스크립트를 작성할 때는 구구절절한 주석을 줄이고 가장 핵심적이고 압축적인 코드만 작성하십시오.
  - 불필요하게 긴 변수명과 중복 처리를 방지하고 간결함을 유지하십시오.