# 2026-10-25 참가격 예식장 공시 수집 완전성 검토

## 판정

**부분 수집. 기본정보 목록은 전체 338건과 일치하지만 가격 첨부가 모두 수집된 상태는 아니다.** 원본 275개는 사이트 내용과 일치한다. 동일 내용 중복·ZIP 내부 파일까지 연결하면 276개 게시글을 로컬 원본으로 확인할 수 있다. 56개 게시글의 비엑셀 첨부는 미수집이며 6개 게시글에는 첨부 ID가 없다.

## 범위와 방법

- 대상: [참가격 중요정보 공개(예식장)](https://www.price.go.kr/tprice/portal/board/boardInfoMgr.do?boardTypeCode=0090000140)의 14개 지역 전체 페이지. 결혼준비대행 자료는 제외했다.
- 기존 stock: [업무 설계 META-001–004](../stock/business-design.md), [데이터 설계 META-DATA-001–004](../stock/system-design.md). 기존 설계 자체가 일부 원본 275개를 대상으로 하므로 검토 결과는 범위 제한을 재확인한다.
- 게시글 338개의 상세·본문을 실시간 재조회했다. 게시글 ID, 주소, 연락처, 자료 공개일을 기본정보 JSON과 비교했다.
- 현재 첨부 332개와 이전 첨부 30728 1개, 총 333개를 임시 폴더에 내려받아 실제 형식·SHA-256을 확인했다. 다운로드 오류 0건.
- 기존 원본·MD·TXT·목록·stock 문서는 변경하지 않았다. 이 검토 기록과 근거 JSON만 추가했다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| 사이트 게시글 ↔ 기본정보 JSON | 338/338건, 누락·추가 0건 |
| 주소·연락처·자료 공개일 ↔ 사이트 본문 | 정규화한 공백 기준 불일치 0건 |
| 원본 파일 ↔ 수집목록 SHA-256 | 275/275개 일치 |
| 원본 파일 ↔ 실시간 사이트 첨부 내용 | 275/275개 일치. ZIP은 내부 파일, 중복 ID는 해시로 연결 |
| XLSX·TXT·MD 3종 | 업체별 275세트 및 통합 1세트 완비 |
| XLSX ZIP CRC | 276/276개 정상 |
| XLSX ↔ Markdown | 305시트, 공백만 있는 셀을 제외한 19,069개 셀 대조, 차이 0건 |
| 추출 파일 ↔ 직전 검증 SHA-256 | XLSX·MD 276세트 전부 일치 |
| Markdown 상대 링크 | 깨진 링크 0개 |
| 원본 이미지 | 자산 78개, XLSX 내부 이미지 78개와 바이트 해시 일치 |

셀 대조는 원본 XML을 기준으로 병합 영역에 남아 있는 값도 포함했다. 날짜만 Excel 날짜형을 ISO 문자열로 변환하고 개행·앞뒤 공백을 정규화했다. 이전 기록의 값 있는 셀 19,074개에는 공백만 있는 셀 5개가 포함돼 있다. 이미지 속 글자나 스캔의 금액 전체를 OCR·육안으로 검증했다는 의미는 아니다.

## 지역별 완전성

`로컬 연결`은 게시글 수다. 파일 개수와 다르며, 중복 내용 파일 1개가 여러 게시글을 대표할 수 있다.

| 지역 | 사이트 게시글 | 로컬 연결 | 미수집 첨부 | 첨부 ID 없음 |
| --- | ---: | ---: | ---: | ---: |
| 서울(강남) | 51 | 47 | 4 | 0 |
| 서울(강남외) | 51 | 42 | 7 | 2 |
| 경기도 | 40 | 32 | 8 | 0 |
| 인천 | 9 | 7 | 2 | 0 |
| 강원도 | 9 | 5 | 3 | 1 |
| 충청.세종 | 35 | 31 | 4 | 0 |
| 대전 | 19 | 16 | 0 | 3 |
| 경상도 | 24 | 21 | 3 | 0 |
| 전남광주 | 26 | 16 | 10 | 0 |
| 대구 | 11 | 9 | 2 | 0 |
| 울산 | 6 | 6 | 0 | 0 |
| 전라북도 | 10 | 10 | 0 | 0 |
| 부산 | 29 | 20 | 9 | 0 |
| 제주도 | 18 | 14 | 4 | 0 |
| **합계** | **338** | **276** | **56** | **6** |

## 중복과 ZIP 판정

- 셀레네하우스웨딩 청주점: 현재 첨부 `31591`은 로컬 `31589` 파일과 SHA-256이 동일하다. 별도 파일명이 없지만 내용 누락으로 세지 않았다.
- 대구 MH컨벤션: 현재 첨부 `31644`는 이전 공시 `30728` 원본과 SHA-256이 동일하다. 현재 ID와 로컬 경로의 연결은 명시적으로 관리할 필요가 있다.
- 경원재 바이 워커힐: 현재 첨부 `31623`은 XLSX·PDF를 포함한 ZIP이다. 로컬 XLSX는 ZIP 내부 XLSX와 정확히 일치한다. ZIP 자체와 바이트가 다른 것은 오류가 아니다. PDF와 ZIP 전체는 현재 폴더에 없다.

## 미수집 첨부 56개

형식별: PDF 34개, HWP 14개, PNG 3개, JPEG 2개, HWPX 2개, DOCX 1개. HWP는 OLE 내부 `HWP Document File` 서명으로, HWPX·DOCX는 ZIP 내부 구조로 판별했다.

| 지역 | 업체 | 게시글 | 첨부 ID | 실제 형식 |
| --- | --- | --- | --- | --- |
| 서울(강남) | JW메리어트호텔 | [38283](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000140&boardSeq=38283&actionType=read) | 31410 | PDF |
| 서울(강남) | 그랜드 인터컨티넨탈 서울 파르나스 | [38285](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000140&boardSeq=38285&actionType=read) | 31413 | PDF |
| 서울(강남외) | 콘래드 서울 호텔 | [38720](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38720&actionType=read) | 31904 | PDF |
| 경기도 | 메종드라무르웨딩 | [38724](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38724&actionType=read) | 31908 | PDF |
| 경기도 | 더 마리포사 웨딩홀 | [38681](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38681&actionType=read) | 31833 | HWP |
| 인천 | CN천년부페웨딩홀 주안점 | [38485](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000143&boardSeq=38485&actionType=read) | 31622 | HWP |
| 인천 | 라마다 송도호텔 | [38487](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000143&boardSeq=38487&actionType=read) | 31624 | PDF |
| 강원도 | 더 테라리움 춘천 | [38340](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000152&boardSeq=38340&actionType=read) | 31559 | PDF |
| 강원도 | 산과바다 베키니아호텔 주문진리조트 | [38347](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000152&boardSeq=38347&actionType=read) | 31561 | HWP |
| 강원도 | 호텔탑스텐 | [38356](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000152&boardSeq=38356&actionType=read) | 31485 | PDF |
| 충청.세종 | 파라다이스웨딩홀 | [38703](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000149&boardSeq=38703&actionType=read) | 31869 | PDF |
| 경상도 | 그랜드머큐어앰배서더창원 웨딩 | [38377](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000151&boardSeq=38377&actionType=read) | 31506 | PNG |
| 전남광주 | 소노캄 여수 | [38726](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38726&actionType=read) | 31912 | PDF |
| 전남광주 | 아모르웨딩컨벤션 | [38719](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38719&actionType=read) | 31902 | JPEG |
| 전남광주 | 라부쏠라 | [38566](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38566&actionType=read) | 31702 | PDF |
| 대구 | 대구 메리어트 호텔 | [38514](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000144&boardSeq=38514&actionType=read) | 31650 | PDF |
| 대구 | 퀸벨호텔 | [38523](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000144&boardSeq=38523&actionType=read) | 31660 | JPEG |
| 부산 | W스퀘어웨딩홀 | [38434](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38434&actionType=read) | 31570 | PDF |
| 부산 | W웨딩 K웨딩홀 | [38436](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38436&actionType=read) | 31572 | PNG |
| 제주도 | 소노벨 제주 | [38728](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000153&boardSeq=38728&actionType=read) | 31914 | PDF |
| 제주도 | 서귀포웨딩홀 | [38313](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000153&boardSeq=38313&actionType=read) | 31442 | HWPX |
| 제주도 | 서귀포칼호텔 | [38315](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000153&boardSeq=38315&actionType=read) | 31445 | PDF |
| 서울(강남) | 루이비스컨벤션 송파문정점 | [38303](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000140&boardSeq=38303&actionType=read) | 31432 | PNG |
| 서울(강남) | 마레보인웨이브 | [38305](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000140&boardSeq=38305&actionType=read) | 31434 | PDF |
| 서울(강남외) | 국방컨벤션센터 | [38361](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38361&actionType=read) | 31490 | HWP |
| 서울(강남외) | 나인트리 프리미어 로카우스호텔 | [38364](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38364&actionType=read) | 31493 | PDF |
| 서울(강남외) | 당산 그랜드컨벤션센터 | [38366](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38366&actionType=read) | 31495 | PDF |
| 서울(강남외) | 더에스비웨딩컨벤션 | [38369](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38369&actionType=read) | 31498 | PDF |
| 서울(강남외) | 서울드래곤시티 | [38396](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38396&actionType=read) | 31525 | PDF |
| 서울(강남외) | 웨스틴조선서울 | [38413](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38413&actionType=read) | 31563 | PDF |
| 경기도 | 그래비티 조선 서울 판교 | [38500](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38500&actionType=read) | 31637 | HWP |
| 경기도 | 루클라비 | [38521](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38521&actionType=read) | 31658 | PDF |
| 경기도 | 빌라드아모르 이천 | [38522](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38522&actionType=read) | 31659 | PDF |
| 경기도 | 제이앤제이아트컨벤션 | [38533](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38533&actionType=read) | 31670 | HWP |
| 경기도 | 티웨딩홀 | [38535](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38535&actionType=read) | 31672 | PDF |
| 경기도 | 호텔라뷔포레 | [38539](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000148&boardSeq=38539&actionType=read) | 31676 | PDF |
| 충청.세종 | 모나밸리 웨딩홀 | [38443](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000149&boardSeq=38443&actionType=read) | 31579 | PDF |
| 충청.세종 | 아르떼웨딩 | [38461](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000149&boardSeq=38461&actionType=read) | 31598 | PDF |
| 충청.세종 | 티웨딩 천안 | [38471](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000149&boardSeq=38471&actionType=read) | 31608 | PDF |
| 경상도 | 세코 컨벤션 웨딩 | [38397](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000151&boardSeq=38397&actionType=read) | 31526 | PDF |
| 경상도 | 아트라움웨딩홀 | [38401](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000151&boardSeq=38401&actionType=read) | 31530 | HWP |
| 전남광주 | 마리나웨딩홀여수 | [38568](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38568&actionType=read) | 31704 | PDF |
| 전남광주 | 메리포엠 웨딩홀 | [38569](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38569&actionType=read) | 31846 | PDF |
| 전남광주 | 목포예술웨딩컨벤션 | [38570](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38570&actionType=read) | 31706 | HWP |
| 전남광주 | 아네스웨딩홀 | [38574](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38574&actionType=read) | 31710 | PDF |
| 전남광주 | 에메랄드웨딩홀 | [38575](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38575&actionType=read) | 31711 | PDF |
| 전남광주 | 웨딩그룹위더스 광주 | [38577](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38577&actionType=read) | 31713 | HWP |
| 전남광주 | 유탑 마리나호텔 | [38578](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000146&boardSeq=38578&actionType=read) | 31715 | DOCX |
| 부산 | 그랜드블랑 | [38456](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38456&actionType=read) | 31593 | HWP |
| 부산 | 금강국민호텔 | [38458](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38458&actionType=read) | 31595 | HWP |
| 부산 | 디엘웨딩홀 | [38464](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38464&actionType=read) | 31601 | PDF |
| 부산 | 목장원 | [38469](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38469&actionType=read) | 31605 | HWP |
| 부산 | 웨스틴 조선 부산 | [38479](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38479&actionType=read) | 31616 | PDF |
| 부산 | 호메르스 호텔 | [38483](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38483&actionType=read) | 31620 | HWPX |
| 부산 | 호텔 농심 | [38484](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000142&boardSeq=38484&actionType=read) | 31621 | HWP |
| 제주도 | 제주 호텔더원 | [38325](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000153&boardSeq=38325&actionType=read) | 31455 | HWP |


## 첨부 ID가 없는 게시글 6개

상세 페이지에서 첨부 ID를 확인할 수 없었던 건이다. 업체 정보 자체가 없다는 뜻은 아니다.

| 지역 | 업체 | 게시글 |
| --- | --- | --- |
| 서울(강남외) | 웨딩시그니처 | [38665](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38665&actionType=read) |
| 서울(강남외) | 코트야드 메리어트 서울 타임스퀘어 | [38666](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000141&boardSeq=38666&actionType=read) |
| 강원도 | 미래컨벤션웨딩홀 | [38345](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000152&boardSeq=38345&actionType=read) |
| 대전 | 비브레스 가든 | [38667](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000145&boardSeq=38667&actionType=read) |
| 대전 | 호텔ICC웨딩홀 | [38554](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000145&boardSeq=38554&actionType=read) |
| 대전 | 호텔인터시티 | [38556](https://www.price.go.kr/tprice/portal/board/boardInfoDetail.do?boardTypeCode=0090000145&boardSeq=38556&actionType=read) |


## 문서·연결 문제와 후속 조치

1. `파일목록.html`: 로컬 링크 560개 중 558개가 현재 폴더 기준으로 깨져 있다. 이전 `03_참가격_업체별_공시원본/` 접두 경로와 현재 폴더에 없는 다른 수집 범주의 경로를 유지하고 있다. 현재 탐색에는 [엑셀_추출_목록.md](../../엑셀_추출_목록.md)를 사용한다. 이 목록의 828개 링크는 모두 유효하다.
2. `수집목록.json`: 원래 전체 수집 283건의 범위·경로가 남아 있다. 현재 폴더의 공시 원본 275건과 나머지 8건을 구분해야 한다. 원본 해시가 맞더라도 기록된 이전 접두 경로는 현재 폴더 기준으로 바로 열리지 않는다.
3. `읽어주세요.txt`: 예전 4개 범주의 안내와 `첨부없는_게시글정보` 폴더 안내가 남아 있다. 해당 폴더는 현재 대상 경로에 없다. 기본정보 JSON에 적힌 `standalone_post_txt=62`를 현재 TXT 62개 존재의 증거로 사용할 수 없다.
4. 파일 ID `30728` 원본은 확장자가 `.xls`이나 실제로는 HWP다. 변환 XLSX 및 원본이 모두 보존돼 있지만 확장자로만 형식을 판단하면 오분류된다.
5. 퍼스트가든 웨딩의 공개일 `026-05-20`은 사이트 원문에도 동일하게 적혀 있다. 로컬 전사 오류가 아니며 날짜형 정제 때 확인 필요 상태를 유지한다.
6. 전체 가격자료 확보가 목표라면 위 56개 비엑셀 첨부를 별도 원본으로 보존한 뒤 형식별 추출이 필요하다. 현재 첨부가 없는 6건은 별도 상태로 관리해야 한다. 이번 검토는 해당 자료를 기존 데이터셋에 추가하거나 가격을 추정하지 않았다.

## 근거와 stock 반영 상태

[전체 조회·해시·셀 검증 JSON](2026-10-25-site-completeness-audit.json)에 게시글별 연결과 누락 목록을 보존했다. 임시 다운로드와 조사 스크립트는 `/tmp/wedding-site-audit-20261025` 및 `/tmp/wedding_*audit*.py`에 두었다.

기존 stock의 일부 수집 범위와 원본 보존 규칙은 이번 재검증과 일치한다. 수집 범위 확대나 데이터 수정 결정은 하지 않았으며 따라서 stock의 동작·범위 규칙은 변경하지 않았다. 위 후속 조치는 미실행 상태다.
