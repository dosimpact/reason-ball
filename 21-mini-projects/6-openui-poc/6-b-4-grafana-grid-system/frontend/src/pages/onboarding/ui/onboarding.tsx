"use client";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./onboarding.css";
const nodes: Node[] = [
  {
    id: "user",
    position: { x: 0, y: 140 },
    data: { label: "사용자 · 질문 / 직접 조작" },
    type: "input",
  },
  {
    id: "chat",
    position: { x: 240, y: 20 },
    data: { label: "Headless Chat · OpenUI Renderer" },
  },
  {
    id: "canvas",
    position: { x: 240, y: 260 },
    data: { label: "Canvas · 24열 패널 / 탭" },
  },
  {
    id: "api",
    position: { x: 500, y: 140 },
    data: { label: "Next.js HTTP proxy" },
  },
  {
    id: "agent",
    position: { x: 740, y: 20 },
    data: { label: "Python Deep Agent" },
  },
  {
    id: "commands",
    position: { x: 740, y: 260 },
    data: { label: "공통 Canvas 명령 · revision" },
  },
  {
    id: "sec",
    position: { x: 1000, y: -80 },
    data: { label: "SEC 수집 subagent / subgraph" },
  },
  {
    id: "search",
    position: { x: 1000, y: 70 },
    data: { label: "문서 비교 / 섹션 / XBRL 분석" },
  },
  {
    id: "db",
    position: { x: 1000, y: 280 },
    data: { label: "SQLite · 원문 / 벡터 / 대화 / 패널" },
    type: "output",
  },
];
const edges: Edge[] = [
  ["user", "chat"],
  ["user", "canvas"],
  ["chat", "api"],
  ["canvas", "api"],
  ["api", "agent"],
  ["api", "commands"],
  ["agent", "sec"],
  ["agent", "search"],
  ["agent", "commands"],
  ["sec", "db"],
  ["search", "db"],
  ["commands", "db"],
].map(([source, target]) => ({
  id: `${source}-${target}`,
  source,
  target,
  animated: source === "api",
  label: source === "api" && target === "agent" ? "AG-UI" : "",
}));
export default function Onboarding() {
  return (
    <main className="onboarding">
      <nav>
        <Link href="/">← Filing Studio</Link>
        <a href="#experience">사용 경험</a>
        <a href="#canvas-guide">Canvas 조작</a>
        <a href="#architecture">전체 구조</a>
        <a href="#data">데이터</a>
        <a href="#openui">OpenUI</a>
        <a href="#operations">실행·검증</a>
      </nav>
      <header>
        <span>FILING STUDIO / ONBOARDING</span>
        <h1>
          질문이 분석으로,
          <br />
          분석이 대시보드로.
        </h1>
        <p>
          SEC 사업보고서를 읽고 비교하며, 필요한 결과를 지속 가능한 Canvas로
          만드는 자체 앱입니다.
        </p>
      </header>
      <section id="experience">
        <h2>1. 사용자에게 보이는 흐름</h2>
        <div className="onboard-cards">
          <article>
            <b>01 · 대화에서 시작</b>
            <p>
              기업명·티커로 보고서를 찾고, 요약·섹션 읽기·기업 간 비교를
              요청합니다. 준비된 PDF도 검색합니다.
            </p>
          </article>
          <article>
            <b>02 · 결과를 Canvas로</b>
            <p>
              차트·표·메모·인터랙티브 UI를 대화에서 추가하거나 직접 생성합니다.
              패널의 출처와 조회 조건도 유지합니다.
            </p>
          </article>
          <article>
            <b>03 · 계속 다듬기</b>
            <p>
              드래그·리사이즈·고정·탭 이동을 직접 하거나 대화로 요청합니다. 이전
              대화를 열면 서버에 저장한 대시보드를 복원합니다.
            </p>
          </article>
        </div>
        <p>
          예: “최근 3년 매출을 보여줘” → “이 그래프를 Canvas에 추가해줘” →
          “2020년은 제외해줘” → “전체를 내려받고 싶어”. 대상을 특정할 수 없으면
          먼저 확인합니다.
        </p>
      </section>
      <section id="canvas-guide">
        <h2>Canvas 조작 안내</h2>
        <ul>
          <li>
            대화 결과의 추가 버튼이나 드래그로 현재 입력값까지 Canvas에
            복사합니다. 이후 Canvas의 입력 변경은 대화 원본과 독립적입니다.
          </li>
          <li>
            패널 핸들을 드래그해 이동하고 오른쪽 아래에서 크기를 바꿉니다.
            도중에 Escape를 누르면 취소합니다. 방향키로 이동하고 Shift+방향키로
            크기를 조절할 수도 있습니다.
          </li>
          <li>
            고정한 패널은 이동·크기·탭 변경이 차단됩니다. 먼저 고정을
            해제하세요. 패널 이동 버튼은 다른 탭에 있는 대상도 찾아 강조합니다.
          </li>
          <li>
            현재 탭 삭제는 탭 제목과 포함 패널 수를 확인한 뒤 실행합니다. 다른
            탭과 대화·원본 결과는 남고, 마지막 탭은 유지합니다.
          </li>
          <li>
            좁은 Canvas에서는 한 열로 표시하고 직접 드래그를 끕니다. 넓은
            화면으로 돌아오면 저장된 배치를 다시 사용합니다.
          </li>
          <li>
            분석 중 중단하면 미완성 상태가 대화에 남습니다. 이전 대화를 다시
            열어 후속 질문을 이어갈 수 있습니다.
          </li>
        </ul>
      </section>
      <section id="architecture">
        <h2>2. 전체 시스템 — 이동·확대 가능한 구조도</h2>
        <p>
          왼쪽은 사용자 화면, 가운데는 요청과 에이전트, 오른쪽은 수집·분석·영속
          저장입니다. 마우스로 확대하거나 노드를 이동하며 관계를 살펴보세요.
        </p>
        <div className="architecture-flow">
          <ReactFlow
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView
            colorMode="dark"
            minZoom={0.15}
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <p>
          대화 요청은 <code>/api/dashboard/chat</code>에서 Python{" "}
          <code>/dashboard/chat</code>으로 전달됩니다. 서버는 AG-UI
          텍스트·도구·상태 이벤트를 보내고, 화면은 요청을 시작한 대화에만
          적용합니다.
        </p>
      </section>
      <section id="data">
        <h2>3. 숫자와 문장의 근거</h2>
        <ul>
          <li>
            <b>공시 수집:</b> 기업을 CIK로 식별하고 Submissions에서 공시를 찾은
            뒤 원문을 저장합니다. 다운로드 실패와 준비 완료를 구분합니다.
          </li>
          <li>
            <b>섹션:</b> 연간 보고서는 Item, 분기 보고서는 Part와 Item을 함께 식별해 원문과 위치를 보관합니다. 추출에 실패한 섹션을
            임의로 만들지 않고 전체 원문을 확인할 수 있게 합니다.
          </li>
          <li>
            <b>검색:</b> 기존 PDF의 페이지별 벡터와 SEC 원문의 섹션별 벡터를
            SQLite에 저장합니다. 유사도는 근거의 순위를 뜻하며 사실 부재의
            확정이 아닙니다. 정확한 제목·문구가 있으면 페이지 문구 검색으로
            위치를 찾은 뒤 원문을 읽습니다. PDF 쪽수와 내부 인쇄 쪽수는 다를 수 있습니다.
          </li>
          <li>
            <b>원문 확인 범위:</b> 준비된 PDF의 페이지 원문을 읽고 긴 페이지는
            이어 읽습니다. 원문 확인 요청의 답변 뒤에는 실제 읽은 페이지·섹션
            범위를 별도로 표시합니다. 검색 결과나 일부 페이지를 전체 보고서
            완독으로 해석하지 마세요.
          </li>
          <li>
            <b>연간 수치:</b> XBRL의 연간 기간, 통화·단위, 원래 공시와 정정
            공시를 구분합니다. 누락 연도는 0으로 채우지 않으며 연도가 연속되지
            않으면 YoY를 계산하지 않습니다.
          </li>
        </ul>
        <h3>보고서 비교를 검토하는 방법</h3>
        <p>
          현재 준비 자료에는 NVIDIA FY2027 Q2의 공식 IR 분기 PDF도 포함됩니다.
          3개월 분기 매출과 6개월 누적 매출은 기간을 나누어 읽습니다.
          위험 요인의 변경 여부는 예외 조건까지 포함한 원문을 확인하고,
          보고서에 명시된 내용과 추가 추론을 구분합니다.
          IR PDF 준비 성공은 SEC 직접 수집 성공을 뜻하지 않습니다.
        </p>
        <p>
          준비된 FY2025·FY2026 NVIDIA 보고서를 비교하고, 원문이 확인된 FY2024~2026
          매출 차트를 같은 패널에서 확대하거나 특정 연도를 제외할 수 있습니다.
          검증 기준은 3년이며, 요청한 n년에 맞춰 기간을 변경합니다. 확보되지 않은 연도는 안내하고 임의로 채우지 않습니다. 보고서 대상은 10-K와 10-Q 및 각 정정본입니다.
          답변과 패널 게시 전 근거 검사는 기업·수치·기간·단위를 대조하고 불일치 시
          보완을 요청합니다. 모델 기반 검사이므로 사용자의 원문 검토를 대체하지 않습니다.
        </p>
        <p>
          대화의 작업 내역에서 검색·원문 읽기·저장의 진행 중, 응답 수신, 실패 상태를
          확인합니다. 도구 응답 수신은 분석이 정확하다는 보증이 아닙니다.
        </p>
        <p className="onboard-note">
          현재 환경의 SEC 직접 접근은 403을 반환했습니다. 모델·임베딩 호출은
          확인했지만, 최신 원문 수집 성공 여부는 별도 검증해야 합니다. 준비된
          PDF 비교와 Canvas 작업은 독립적으로 진행할 수 있습니다.
        </p>
      </section>
      <section>
        <h2>4. Canvas 상태가 일관되는 이유</h2>
        <p>
          브라우저와 에이전트는 같은 패널 명령을 사용합니다. 패널 ID는 계속
          유지되며, 기존 패널 수정 요청은 해당 ID를 대상으로 처리합니다. 모델의
          요청한 신규 패널 개수와 기존 대상별 도구 성공을 검사합니다. 모든 필드의
          의미적 정확성까지 보장하는 것은 아닙니다.
        </p>
        <ol>
          <li>현재 대화의 대시보드와 revision을 읽습니다.</li>
          <li>변경 명령에 operation ID와 base revision을 붙입니다.</li>
          <li>서버가 스키마·고정·참조·충돌을 검사하고 SQLite에 저장합니다.</li>
          <li>AG-UI STATE_SNAPSHOT 또는 STATE_DELTA로 화면을 갱신합니다.</li>
        </ol>
        <p>
          이미 처리한 명령은 중복 적용하지 않습니다. 사용자가 먼저 변경했다면
          오래된 명령을 거절하고 현재 상태를 다시 읽습니다. 같은 브라우저의 연속
          입력은 대화별로 순서대로 저장해 자체 충돌을 줄입니다. 패널을 지워도 원문
          보고서와 대화는 남습니다.
        </p>
      </section>
      <section id="openui">
        <h2>5. OpenUI 카탈로그와 프롬프트</h2>
        <p>
          기존 6-5의 컴포넌트·함수·액션 계약을 보존합니다. <code>Col</code>은
          표의 열, <code>VStack</code>은 세로 레이아웃입니다. 독립 패널의
          프로그램은 자신의 root와 변수를 가져야 합니다.
        </p>
        <pre>{`Frontend catalog (SSOT)\n  components + defineFunction + defineAction\n    ↓ npm run generate\n  src/shared/ui/openui/generated/spec.json\n  src/shared/ui/openui/generated/system-prompt.txt\n    ↓ explicit cp\n  backend-langgraph/agent/system-prompt.txt\n    ↓ Deep Agent → OpenUI program → Renderer`}</pre>
        <h3>defineFunction — YearOverYear</h3>
        <p>
          <code>@YearOverYear(120, 100)</code>은 20을 반환합니다. 분모가 0이면
          null입니다. 사용자 가정에 따른 계산기에 사용할 수 있지만, 보고서의
          누락 수치를 대신 만들지 않습니다.
        </p>
        <h3>재무 패널 갱신과 Snapshot</h3>
        <p>
          지금 새로고침은 저장된 SEC 조회 조건을 다시 실행하며 모델을 호출하지
          않습니다. Live 모드에서는 자동 갱신을 끄거나 1·5·15분으로 설정합니다.
          열린 Canvas 탭과 보이는 브라우저에서만 갱신하며 앱을 닫은 동안에는
          실행하지 않습니다. Snapshot은 현재 데이터를 보관하고 Live로 전환하기
          전에는 갱신하지 않습니다.
        </p>
        <p>
          마지막 정상 조회와 원천 확인 시각, 최근 공시일을 구분합니다. 조회가
          실패하면 마지막 데이터를 유지하고 오류를 표시합니다. SEC 접근이 차단된
          현재 환경에서는 실제 갱신 성공을 확인하지 못했으며 컨트롤은 격리된
          가정 데이터로 검증했습니다.
        </p>
        <h3>defineAction — FocusPanel</h3>
        <p>
          <code>{'@FocusPanel("실제 패널 ID")'}</code>는 호스트의 공통 명령으로
          해당 패널을 선택하고 화면에서 찾습니다. 클라이언트가 임의 코드를
          실행하는 구조가 아닙니다.
        </p>
        <h3>검증할 예제</h3>
        <p>
          “현재값 120, 전년값 100인 가정용 성장률 계산기를 만들고 값을 바꿀 수
          있게 해줘.” 이후 실제 패널 ID를 사용한 이동 버튼을 요청할 수 있습니다.
          기존 CopyToClipboard와 59개 계산 함수도 유지합니다.
        </p>
      </section>
      <section>
        <h2>6. 소스 코드 읽는 순서</h2>
        <table>
          <thead>
            <tr>
              <th>경로</th>
              <th>책임</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "frontend/src/pages/workspace",
                "헤드리스 대화, 목록, 전체 배치",
              ],
              [
                "frontend/src/features/dashboard",
                "Canvas 조작, AG-UI 분배, 다운로드",
              ],
              ["frontend/src/entities/dashboard", "패널 계약과 OpenUI 렌더링"],
              ["frontend/src/shared/ui/openui", "승계한 UI·함수·액션 카탈로그"],
              [
                "backend-langgraph/agent/dashboard",
                "Deep Agent, HTTP, 도구, 상태 명령",
              ],
              [
                "backend-langgraph/agent/sec",
                "SEC 클라이언트·수집 그래프·파싱·검색",
              ],
              [
                "backend-langgraph/agent/documents.py",
                "기존 PDF 검색과 임베딩",
              ],
              ["backend-langgraph/agent/history.py", "서버 소유 대화 저장"],
            ].map(([path, role]) => (
              <tr key={path}>
                <td>
                  <code>{path}</code>
                </td>
                <td>{role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          프런트엔드는 FSD 계층과 public API를 사용합니다.
          저장·네트워크·계산·렌더링을 분리하여 한 함수가 한 수준의 책임을 갖도록
          구성합니다.
        </p>
      </section>
      <section id="operations">
        <h2>7. 실행과 검증</h2>
        <pre>{`# backend-langgraph\nuv sync --frozen\nuv run prepare-documents --include-history --include-quarterly  # 현재 연간·분기 검토 자료 유지\nuv run langgraph dev --port 2041 --no-browser\n\n# frontend\nnpm ci\nnpm run dev  # http://127.0.0.1:3049\n\n# PDF preparation rebuilds the selected index; keep both include flags.\n\n# Catalog change\nnpm run generate\ncp src/shared/ui/openui/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt\n# Restart backend after prompt asset changes\n\n# Checks\nuv run pytest\nuv run ruff check agent tests\nnpm test\nnpm run typecheck\nnpm run lint\nnpm run verify`}</pre>
        <p>
          루트 .env 및 백엔드 .env는 서버에서만 읽습니다. SQLite 파일, 원문 PDF,
          키, 캐시는 Git에 올리지 않습니다. 기존 서버를 재사용하거나 종료하지
          않고 이 프로젝트의 포트를 사용합니다.
        </p>
        <p>
          검증은 정적 검사, 단위 테스트, 실제 공급자/API 호출, 브라우저 사용자
          흐름으로 나누어 기록합니다. 과거 6-5의 성공 기록은 이번 프로젝트의
          성공 증거가 아닙니다.
        </p>
      </section>
      <section>
        <h2>8. 내보내기와 지원 범위</h2>
        <p>
          JSON은 모든 탭의 패널·조회 조건·배치·출처·입력값을 담습니다.
          가져오기는 기존 내용을 보존하며 새 탭에 추가합니다. CSV는 재무 행과
          일반 표·차트의 값을 패널·탭·행·열·시각화 종류로 구분하고 저장된
          입력값과 계산을 반영합니다. 새로 게시하거나 수정한 프로그램의 화면 출처도
          패널 출처 메타데이터에 저장합니다. 표·차트가 없는 패널은 PDF 또는 JSON으로
          전체 내용을 보관합니다. PDF는 브라우저 인쇄에서 저장하며, 생성 중인
          답변은 완료한 후 내보내는 것이 좋습니다.
        </p>
        <p>
          로컬 단일 사용자 앱입니다. 공개 배포 인증, 다중 사용자 협업, OCR은
          별도 범위입니다. SEC 오류와 자료 부족은 화면에서 안내하며 성공으로
          위장하지 않습니다.
        </p>
        <p>
          <Link href="/">대시보드로 돌아가기 →</Link>
        </p>
      </section>
    </main>
  );
}
