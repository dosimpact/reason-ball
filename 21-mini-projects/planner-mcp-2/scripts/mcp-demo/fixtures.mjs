export const source = [
  "[UI]",
  "  -> EVENT: 프로젝트 생성 클릭",
  "    -> CALL: create_project // 입력한 이름 전달",
  "[Application]",
  "  -> FLOW: createProject",
  "    -> CHECK: 프로젝트 이름 검증 // 공백 이름 거부",
  "    /*",
  "첫 줄 설명",
  "-> (+) Prefix: 주석 내부 기호",
  "[FakeLayer] <- (-) 주석이며 노드가 아니다",
  "    */",
  "    -> (+) CustomDomain: 생성 알림 표시 // 추가 예정",
  "    -> (-) OLD: 이전 저장 경로 // 삭제 예정",
  "    <- RETURN: 생성된 프로젝트",
  "[Infrastructure]",
  "  -> IO: SQLite 저장",
  "    <- RETURN: 프로젝트 ID",
].join("\n");
export const extensions = [
  {
    id: "architecture",
    type: "react-flow-diagram",
    title: "설계 → 구현 → 검증",
    schemaVersion: 1,
    data: {
      nodes: ["design", "implementation", "verification"].map((id, i) => ({
        id,
        label: [
          "사람 설계 + AI 문서화",
          "AI 구현 + MCP 기록",
          "AI 1차 검증 → 사람 확인",
        ][i],
        position: { x: i * 240, y: 0 },
      })),
      edges: [
        { id: "d-i", source: "design", target: "implementation" },
        { id: "i-v", source: "implementation", target: "verification" },
      ],
    },
  },
  {
    id: "code-flow",
    type: "codeweave",
    title: "프로젝트 생성 · 레이어와 변경 표시",
    schemaVersion: 1,
    data: { source },
  },
  {
    id: "verification-flow",
    type: "codeweave",
    title: "검증 흐름",
    schemaVersion: 1,
    data: {
      source:
        "[Verification]\n  -> TEST: MCP 결과 확인\n    <- RETURN: 사람 확인 대기",
    },
  },
];
export const markdown =
  "# 문서 편집 예시\n\n**What**: 설계와 검증을 한 문서에 연결합니다.\n\n| 역할 | 책임 |\n| --- | --- |\n| AI | 구현 및 1차 검증 |\n| 사람 | 최종 확인 |\n\n- [ ] 이 본문 체크는 공용 정형 체크리스트와 별개입니다.\n\n\x60\x60\x60mermaid\nflowchart LR\n  D[설계] --> I[구현] --> V[AI 검증] --> H[사람 확인]\n\x60\x60\x60\n";
