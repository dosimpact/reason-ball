# 2026-10-20 모델 의도 판단과 프롬프트 분리

- 결정(IUI-006/110): Python `intent` graph가 대화 맥락으로 chat/report와 참조 메시지를 선택한다. 일반 `agent`/전용 `report`는 별도 패키지 프롬프트를 사용하고 Next.js는 HTTP로 연결한다. 벤더 구조화는 분류 이후 데이터 보존 단계다.
- 경계: 일반 주제 보고서에 벤더 UI를 강제하지 않는다. report는 도구 없는 단일 모델 노드이며, 의도 판단 실패/시간 초과는 오류로 반환한다. 키워드 fallback은 없다.
- 교훈: 작성 형식과 새 원문을 혼동한 source 선택, 잘못된 Concat/List 계약을 프롬프트에 보강했다. 잘못된 보고서는 검증에서 거절해 저장하지 않았다. 이전 보고서가 선택되면 보존한 원문을 복원한다.
- 당시 최종 검증: Chrome 22/22(당시 벤더 MD/HTML 16+일반/보고서 전환 4+fixture 2), frontend 347 tests/typecheck/lint/build, Python 14 tests/Ruff, 실제 도구/후속 질문/카운터/400 smoke PASS. 벤더 16개 모두 report/latest 및 AI 해설 성공.
- 패키징·정리: wheel/sdist의 프롬프트 3개, 생성 자산 cmp/재시작, 일반 보고서 print overflow를 확인했다. 새 PDF는 만들지 않았다. 테스트 브라우저만 닫고 사용자 탭/히스토리와 2036/3044를 보존했다.
- 현재 계약: [IUI-110](../stock/system.md#iui-110-모델-의도-라우팅과-생성-프롬프트). 위 Chrome 결과는 이후 교체한 합성 fixture의 재검증 결과가 아니다.
