---
name: theme-factory
description: 산출물(슬라이드, 문서, 보고서, HTML 랜딩 페이지 등)에 일관된 스타일 테마를 지정하는 도구 세트입니다. 미리 정의된 10개의 테마를 적용하거나 현장에서 커스텀 테마를 생성하여 적용할 수 있습니다.
license: Complete terms in LICENSE.txt
---

# 테마 팩토리 스킬 (Theme Factory Skill)

이 스킬은 신중하게 선정된 색상 팔레트와 폰트 조합이 포함된 프로페셔널한 스타일 테마 라이브러리를 제공합니다. 선택한 테마는 모든 산출물에 일관되게 적용할 수 있습니다.

## 목적 (Purpose)

프레젠테이션 슬라이드나 문서 등의 산출물에 일관되고 프로페셔널한 스타일을 지정합니다. 각 테마는 다음 요소를 포함합니다:
- Hex 코드로 정의된 조화로운 색상 팔레트
- 헤더와 본문에 어울리는 보완용 폰트 조합
- 다양한 컨텍스트와 독자에 적합한 독창적 시각 정체성(Visual Identity)

## 사용 지침 (Usage Instructions)

슬라이드 덱이나 기타 산출물에 스타일 테마를 적용하는 절차:

1. **테마 쇼케이스 안내**: `theme-showcase.pdf` 파일을 보여주어 사용자가 시각적으로 제공 가능한 모든 테마를 확인하도록 돕습니다. 파일을 수정하지 않고 있는 그대로 사용자에게 보여줍니다.
2. **테마 선택 요청**: 산출물에 적용하고자 하는 테마를 사용자에게 제안하고 선택을 요청합니다.
3. **선택 대기**: 사용자가 선택한 테마에 대한 명시적인 확인을 받을 때까지 대기합니다.
4. **테마 적용**: 선택된 테마의 색상과 폰트 스타일을 산출물에 일관되게 적용합니다.

## 제공되는 테마 목록 (Themes Available)

`theme-showcase.pdf`에서 확인할 수 있는 10가지 표준 테마는 다음과 같습니다:

1. **Ocean Depths** - 프로페셔널하고 차분한 해양 느낌의 테마
2. **Sunset Boulevard** - Warm and vibrant sunset colors
3. **Forest Canopy** - Natural and grounded earth tones
4. **Modern Minimalist** - Clean and contemporary grayscale
5. **Golden Hour** - Rich and warm autumnal palette
6. **Arctic Frost** - Cool and crisp winter-inspired theme
7. **Desert Rose** - Soft and sophisticated dusty tones
8. **Tech Innovation** - Bold and modern tech aesthetic
9. **Botanical Garden** - Fresh and organic garden colors
10. **Midnight Galaxy** - Dramatic and cosmic deep tones

## 테마 세부 사항 (Theme Details)

각 테마는 `themes/` 디렉토리에 정의되어 있으며 다음 사양을 포함합니다:
- Hex 코드로 구성된 색상 팔레트
- 헤더와 본문 폰트 쌍
- 대상 독자에 맞춘 고유한 시각 아이덴티티

## 적용 프로세스 (Application Process)

원하는 테마가 선택되면 다음을 진행합니다:
1. `themes/` 디렉토리에서 해당하는 테마 정의 파일을 읽습니다.
2. 지정된 색상과 폰트를 산출물 전체에 일관되게 적용합니다.
3. 텍스트의 가독성과 명암 대비(contrast)가 충분한지 검증합니다.
4. 모든 슬라이드/페이지에 걸쳐 테마의 시각적 일관성을 유지합니다.

## 커스텀 테마 생성 (Create your Own Theme)

기존 테마 중 요구사항에 맞는 것이 없는 경우, 커스텀 테마를 생성할 수 있습니다. 사용자가 제시하는 아이디어를 바탕으로 위의 표준 테마들과 유사한 구조의 새로운 테마를 생성합니다. 폰트/색상 조합을 연상시킬 수 있는 적절한 테마 이름을 지정하고 사용자가 제공한 기본 묘사에 따라 색상과 폰트를 도출합니다. 테마가 생성되면 검토 및 검증을 위해 사용자에게 보여준 뒤, 위의 프로세스에 따라 산출물에 적용합니다.
