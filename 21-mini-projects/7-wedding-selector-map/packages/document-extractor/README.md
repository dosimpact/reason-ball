# 공시 원본 Markdown 추출

추가 수집목록의 PDF·HWP·HWPX·DOCX·PNG·JPEG를 원본 옆의 `<원본파일명>.md`로 추출한다. ZIP은 내부 파일 목록과 이미 추출한 PDF/XLSX Markdown 링크를 제공한다. 원본 바이트와 기존 엑셀 Markdown은 변경하지 않는다.

## 실행

macOS의 Vision OCR과 Swift 컴파일러가 필요하다. 저장소 루트에서 실행한다.

```sh
uv venv /tmp/wedding-extractor-venv
uv pip install --python /tmp/wedding-extractor-venv/bin/python -r packages/document-extractor/requirements.txt
swiftc -O packages/document-extractor/ocr.swift -o /tmp/wedding-vision-ocr
/tmp/wedding-extractor-venv/bin/python packages/document-extractor/extract.py --root database/참가격_웨딩홀_업체별_공시원본 --vision /tmp/wedding-vision-ocr
```

특정 첨부만 재추출하려면 `--only <첨부ID>`를 추가한다. 이 경우 임시 재검증 JSON을 `/tmp/wedding-document-extraction/`에 저장한다. 최종 전체 검증 JSON을 갱신하려면 전체 실행을 수행한다.

## 추출 범위

- PDF: 모든 페이지를 PDFium으로 렌더링하고 pdfplumber로 텍스트·표를 읽는다. 각 페이지에 한국어·영어 Vision OCR을 별도 적용한다.
- HWP: pyhwp로 문단 텍스트와 XHTML 표를 읽고 병합 범위를 기록한다. 내장 이미지는 OLE 스트림을 읽어 보존하고 OCR한다.
- HWPX·DOCX: ZIP 내부 XML의 본문·표·내장 이미지를 추출한다. HWPX 셀 주소와 병합 범위를 기록한다.
- 이미지: 원본을 보존하고 회색조·명암 조정·최대 2배 확대 사본으로 OCR한다. 사본과 좌표·신뢰도 JSON을 남긴다.
- ZIP: 내부 파일의 경로·크기·해시와 콘텐츠 Markdown 링크를 보존한다.

모든 자동 OCR 결과는 원문 텍스트와 구분한다. OCR 신뢰도는 정답 확률이 아니며 금액·날짜·기간을 확정하는 근거로 단독 사용하지 않는다. 표의 빈칸은 임의로 채우지 않고 숫자 단위나 적용연도를 추정하지 않는다. 원본 페이지·이미지는 각 `<원본파일명>.assets/`에 보존한다.

## 검증

```sh
/tmp/wedding-extractor-venv/bin/python packages/document-extractor/validate.py --root database/참가격_웨딩홀_업체별_공시원본
```

파일·페이지 완비, 원본 SHA-256 보존, PDF 텍스트·표와 HWP/HWPX/DOCX 텍스트 보존, OCR 인식 행 보존, Markdown 상대 링크, 기존 XLSX 보존을 검사한다. 기존 엑셀 Markdown이 역사적 검증 스냅샷과 다르면 별도 변경 목록으로 기록하며 되돌리지 않는다. 이 추출기는 형식 확장자가 붙은 Markdown만 작성한다. 검사는 추출 결과의 구조적 완전성을 확인한다. OCR의 모든 글자와 금액에 대한 수동 검증을 대체하지 않는다.
