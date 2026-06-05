---
name: pdf
description: 사용자가 PDF 파일과 관련된 작업(텍스트/테이블 추출, PDF 병합/분할, 페이지 회전, 워터마크 추가, PDF 신규 생성, PDF 폼 작성, 암호화/복호화, 이미지 추출, 스캔된 PDF OCR 등)을 요청할 때 이 스킬을 사용합니다.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF 처리 가이드 (PDF Processing Guide)

## 개요 (Overview)

이 가이드는 Python 라이브러리 및 명령행 도구를 사용하여 PDF를 처리하는 핵심 작업들을 다룹니다. 고급 기능, JavaScript 라이브러리 활용 및 상세 예제는 REFERENCE.md를 참조하십시오. PDF 폼(Form)을 채워야 하는 경우 FORMS.md의 지침을 읽고 따르십시오.

## 빠른 시작 (Quick Start)

```python
from pypdf import PdfReader, PdfWriter

# PDF 읽기
reader = PdfReader("document.pdf")
print(f"총 페이지 수: {len(reader.pages)}")

# 텍스트 추출
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Python 라이브러리 (Python Libraries)

### pypdf - 기본 작업

#### PDF 병합 (Merge)
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### PDF 분할 (Split)
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### 메타데이터 추출 (Extract Metadata)
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"제목: {meta.title}")
print(f"작성자: {meta.author}")
print(f"주제: {meta.subject}")
print(f"생성 프로그램: {meta.creator}")
```

#### 페이지 회전 (Rotate Pages)
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # 시계 방향으로 90도 회전
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - 텍스트 및 표 추출

#### 레이아웃을 보존하며 텍스트 추출
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### 표(Table) 추출
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"페이지 {i+1}의 {j+1}번째 표:")
            for row in table:
                print(row)
```

#### 고급 표 추출 (Pandas 활용)
```python
import pandas as pd
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # 비어있지 않은 표인 경우만 처리
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# 모든 표 병합
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - PDF 생성

#### 기본 PDF 생성
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# 텍스트 추가
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# 선 그리기
c.line(100, height - 140, 400, height - 140)

# 저장
c.save()
```

#### 다중 페이지 PDF 생성
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# 타이틀 추가
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

# 본문 추가
body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# 페이지 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# PDF 빌드
doc.build(story)
```

#### 아래 첨자 및 위 첨자 표기

**중요**: ReportLab PDF 내에서 유니코드 아래 첨자/위 첨자 문자(₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹)를 직접 사용하지 마십시오. 내장 폰트에 해당 글리프가 없어 검은색 사각형(상자)으로 깨져서 렌더링될 수 있습니다.

대신, Paragraph 객체 내에서 ReportLab의 XML 마크업 태그를 활용하십시오:
```python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()

# 아래 첨자: <sub> 태그 사용
chemical = Paragraph("H<sub>2</sub>O", styles['Normal'])

# 위 첨자: <super> 태그 사용
squared = Paragraph("x<super>2</super> + y<super>2</super>", styles['Normal'])
```

Canvas로 그리는 텍스트(Paragraph 객체가 아닌 경우)는 유니코드 문자를 쓰지 말고 폰트 크기와 좌표를 수동으로 조절하여 정렬하십시오.

## 명령행 도구 (Command-Line Tools)

### pdftotext (poppler-utils)
```bash
# 텍스트 추출
pdftotext input.pdf output.txt

# 레이아웃을 보존하며 텍스트 추출
pdftotext -layout input.pdf output.txt

# 특정 범위 페이지 추출 (예: 1~5페이지)
pdftotext -f 1 -l 5 input.pdf output.txt
```

### qpdf
```bash
# PDF 병합
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# 특정 페이지 추출
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# 페이지 회전
qpdf input.pdf output.pdf --rotate=+90:1  # 1페이지를 시계 방향으로 90도 회전

# 비밀번호 해제
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (사용 가능한 경우)
```bash
# PDF 병합
pdftk file1.pdf file2.pdf cat output merged.pdf

# PDF 페이지 분할 (개별 파일로 쪼개기)
pdftk input.pdf burst

# 페이지 회전
pdftk input.pdf rotate 1east output rotated.pdf
```

## 일반적인 작업 예제 (Common Tasks)

### 스캔된 PDF에서 텍스트 추출 (OCR)
```python
# 필요 라이브러리: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# PDF를 이미지로 변환
images = convert_from_path('scanned.pdf')

# 각 페이지별 OCR 수행
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### 워터마크 추가 (Add Watermark)
```python
from pypdf import PdfReader, PdfWriter

# 워터마크 가져오기 (또는 기존 워터마크 파일 로드)
watermark = PdfReader("watermark.pdf").pages[0]

# 모든 페이지에 적용
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### 이미지 추출 (Extract Images)
```bash
# pdfimages 도구 사용 (poppler-utils)
pdfimages -j input.pdf output_prefix

# 이렇게 하면 모든 이미지가 output_prefix-000.jpg, output_prefix-001.jpg 등으로 순차 추출됩니다.
```

### 비밀번호로 보호 및 암호화 (Password Protection)
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# 비밀번호 설정 (사용자 비밀번호, 소유자 비밀번호)
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## 빠른 참조 (Quick Reference)

| 작업 | 권장 도구 | 명령어 및 코드 예시 |
|------|-----------|--------------|
| PDF 병합 | pypdf | `writer.add_page(page)` |
| PDF 분할 | pypdf | 파일당 한 페이지씩 분배해 쓰기 |
| 텍스트 추출 | pdfplumber | `page.extract_text()` |
| 표 추출 | pdfplumber | `page.extract_tables()` |
| PDF 신규 생성 | reportlab | Canvas 또는 Platypus 방식 |
| CLI 기반 병합 | qpdf | `qpdf --empty --pages ...` |
| 스캔본 OCR | pytesseract | 먼저 이미지로 변환한 후 OCR |
| PDF 폼 작성 | pdf-lib 또는 pypdf | FORMS.md 내용 참고 |

## 다음 단계 (Next Steps)

- pypdfium2 라이브러리의 고급 사용법은 REFERENCE.md를 참조하십시오.
- JavaScript 라이브러리(pdf-lib) 활용은 REFERENCE.md를 참조하십시오.
- PDF 폼을 채워야 한다면 FORMS.md의 지침을 따르십시오.
- 트러블슈팅 가이드는 REFERENCE.md를 참조하십시오.
