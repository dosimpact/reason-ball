import { PALETTE, type Difficulty, type GameState } from "../../entities/game";
import { useGameSession } from "./use-game-session";
import "./game.css";
import { GameDialog } from "../../shared/ui";
export function GameWidget() {
  const {
    view,
    canvas,
    paused,
    speed,
    instructions,
    message,
    hint,
    start,
    deploy,
    requestHint,
    openHelp,
    closeHelp,
    togglePause,
    hasStarted,
    hintPending,
    rendererReady,
    setSpeed,
    speedRef,
  } = useGameSession();
  const seconds = Math.max(
    0,
    Math.ceil((view.timeLimitMs - view.elapsedMs) / 1000),
  );
  const percent = Math.round((view.collected / view.total) * 100);
  const occupiedSlots = view.slots.filter(Boolean).length;
  return (
    <main className="atelier">
      <header className="site-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            🐾
          </div>
          <div>
            <div className="brand-name">CAT ATELIER</div>
            <div className="brand-note">작은 발걸음으로 완성하는 큰 그림</div>
          </div>
        </div>
        <div className="header-note">A LITTLE ORDER, A LITTLE WONDER.</div>
      </header>
      <div className="game-layout">
        <aside className="intro-panel">
          <div className="eyebrow">THE ART OF LITTLE THINGS</div>
          <h1>
            A tiny world.
            <br />A beautiful
            <br />
            <em>little puzzle.</em>
          </h1>
          <p>
            색을 맞추고, 길을 열어 주세요.
            <br />
            작은 고양이들이 한 조각씩
            <br />
            그림을 집으로 가져갑니다.
          </p>
          <div className="edition">THE PIXEL COLLECTION · VOL. 01</div>
        </aside>
        <section className="wood-board" aria-label="Cat Atelier game board">
          <div className="board-top">
            <div className="level-label">
              <small>{view.difficulty.toUpperCase()} COLLECTION</small>Level{" "}
              {String(view.level).padStart(2, "0")}
            </div>
            <div className="top-actions">
              <button
                className="icon-button speed-button"
                aria-label={`Speed ${speed}x`}
                onClick={() => {
                  const next = speed === 1 ? 3 : 1;
                  speedRef.current = next;
                  setSpeed(next);
                }}
              >
                {speed}×
              </button>
              <button
                className="icon-button"
                aria-label="How to play"
                onClick={openHelp}
              >
                ?
              </button>
              <button
                className="icon-button"
                aria-label={paused ? "Resume game" : "Pause game"}
                onClick={togglePause}
              >
                {" "}
                {paused ? "▶" : "Ⅱ"}
              </button>
            </div>
          </div>
          <div className="tray">
            <div className="tray-meta">
              <span>{view.motif.toUpperCase()}</span>
              <span className="timer" role="timer" aria-label="Time remaining">
                ◷ {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
            </div>
            <div className="collection-status">
              <span>
                모은 블록 {view.collected} / {view.total}
              </span>
              <strong>{percent}%</strong>
            </div>
            <div className="collection-track" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
            <div
              className="game-canvas"
              ref={canvas}
              aria-label={`Pixel artwork: ${view.collected} of ${view.total} blocks collected`}
            />
          </div>
          <div className="dock-caption">
            <span>고양이 상자</span>
            <strong>사용 중 {occupiedSlots} / 5</strong>
          </div>
          <div className="slot-row" aria-label="Five active box slots">
            {view.slots.map((box, i) => (
              <div
                key={i}
                data-testid={`slot-${i}`}
                className={`slot ${box ? "occupied" : ""}`}
                style={
                  box
                    ? ({
                        "--box-color": PALETTE[box.color],
                        "--box-ink": ["ink", "brown"].includes(box.color)
                          ? "#fffaf3"
                          : "#17382e",
                      } as React.CSSProperties)
                    : undefined
                }
                aria-label={
                  box
                    ? `Slot ${i + 1}: ${box.color}, ${box.count - box.collected} remaining`
                    : `Slot ${i + 1}: empty`
                }
              >
                {box ? (
                  <>
                    <strong>{box.count - box.collected}</strong>
                    <small>
                      {paused
                        ? "일시 정지"
                        : box.pending > 0
                          ? "운반 중"
                          : "차례 대기"}
                    </small>
                  </>
                ) : (
                  <>
                    <span className="empty-dock" aria-hidden="true">
                      ·
                    </span>
                    <small>빈 자리</small>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="queue-caption">
            <span>맨 앞 상자를 선택하세요</span>
            <span>빈 자리에 자동 배치</span>
          </div>
          <Queues
            view={view}
            paused={paused || !rendererReady}
            hint={hint}
            deploy={deploy}
          />
          <div className="board-bottom">
            바깥 테두리부터, 같은 색 블록을 가져와요.
          </div>
          <div className="status-message" aria-live="polite">
            {hintPending
              ? "광고를 준비하고 있어요. 게임은 잠시 멈춰요."
              : paused
                ? "일시 정지 · PAUSED"
                : message ||
                  (!rendererReady
                    ? "고양이 작업실을 준비하고 있어요…"
                    : !hasStarted
                      ? "첫 상자를 고르면 시작해요. 천천히 살펴보세요."
                      : "색이 같은 고양이가 드러난 블록을 가져갑니다.")}
          </div>
          <span className="sr-only" data-testid="game-status">
            {view.status}
          </span>
        </section>
        <aside className="help-panel">
          <div className="eyebrow">A MOMENT OF FOCUS</div>
          <h2>고양이 작업실</h2>
          {[
            [
              "상자를 골라 주세요",
              "아래 세 줄에서 맨 앞의 색 상자를 선택하세요.",
            ],
            [
              "고양이에게 길을 열어 주세요",
              "아래 길에서 출발해 바깥으로 드러난 같은 색 블록을 가져옵니다.",
            ],
            [
              "다섯 자리를 잘 써 주세요",
              "상자가 비워지면 자리가 생겨요. 모든 그림을 정리하면 성공!",
            ],
          ].map(([title, copy], i) => (
            <div className="how-step" key={title}>
              <span className="step-number">0{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{copy}</p>
              </div>
            </div>
          ))}
          <div className="help-divider" />
          <div>
            <label className="challenge-label" htmlFor="difficulty">
              YOUR CHALLENGE
            </label>
            <div className="selectors">
              <select
                id="difficulty"
                aria-label="Difficulty"
                value={view.difficulty}
                onChange={(e) => start(1, e.target.value as Difficulty)}
              >
                <option value="easy">Easy · 쉬움</option>
                <option value="normal">Normal · 보통</option>
                <option value="hard">Hard · 어려움</option>
              </select>
              <select
                aria-label="Level"
                value={view.level}
                onChange={(e) => start(Number(e.target.value), view.difficulty)}
              >
                {Array.from({ length: 100 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Level {String(i + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="utility-actions">
            <button
              onClick={requestHint}
              disabled={paused || hintPending}
              aria-label={
                window.ReactNativeWebView
                  ? "Watch rewarded ad for hint"
                  : "Hint"
              }
            >
              ✦{" "}
              {hintPending
                ? "광고 준비 중"
                : window.ReactNativeWebView
                  ? "광고 힌트"
                  : "힌트"}
            </button>
            <button
              onClick={() => start(view.level, view.difficulty)}
              aria-label="Restart level"
            >
              ↻ 다시 시작
            </button>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="progress-copy">
            <span>COLLECTION PROGRESS</span>
            <span>{percent}%</span>
          </div>
        </aside>
      </div>
      <footer className="footer">
        <span>MADE FOR A QUIETER MOMENT.</span>
        <span>KEYBOARD · 1 / 2 / 3 TO CHOOSE · SPACE TO PAUSE</span>
      </footer>
      {(instructions || view.status !== "playing") && (
        <div className="modal-backdrop">
          <GameDialog
            label={
              instructions
                ? "How to play"
                : view.status === "won"
                  ? "Level complete"
                  : "Try again"
            }
          >
            <div className="modal-icon">
              {instructions ? "✳" : view.status === "won" ? "✦" : "◷"}
            </div>
            <h2>
              {instructions
                ? "작은 조각, 큰 그림"
                : view.status === "won"
                  ? "아름다운 정리 완료!"
                  : "다시 한 번 해볼까요?"}
            </h2>
            <p>
              {instructions
                ? "상자를 고르면 같은 색 고양이가 출발합니다. 바깥 테두리에 드러난 블록만 가져올 수 있어요. 다섯 슬롯이 막히지 않도록 색과 순서를 살펴보세요."
                : view.status === "won"
                  ? `Level ${view.level} 완료 · ${view.total}개의 작은 조각이 집으로 돌아갔어요.`
                  : view.lossReason === "time"
                    ? "시간이 다 되었어요. 3× 속도로 고양이를 더 빠르게 움직일 수 있어요."
                    : "상자가 모두 막혔어요. 드러난 블록의 색을 먼저 살펴보세요."}
            </p>
            {instructions ? (
              <button onClick={closeHelp}>시작하기</button>
            ) : (
              <>
                <button
                  onClick={() =>
                    start(
                      view.status === "won"
                        ? view.level === 100
                          ? 1
                          : view.level + 1
                        : view.level,
                      view.difficulty,
                    )
                  }
                >
                  {view.status === "won"
                    ? view.level === 100
                      ? "레벨 1로 돌아가기"
                      : "다음 레벨 →"
                    : "다시 도전"}
                </button>
                <button
                  className="secondary"
                  onClick={() => start(view.level, view.difficulty)}
                >
                  처음부터
                </button>
              </>
            )}
          </GameDialog>
        </div>
      )}
    </main>
  );
}

function Queues({
  view,
  paused,
  hint,
  deploy,
}: {
  view: GameState;
  paused: boolean;
  hint: number | null;
  deploy: (lane: number) => void;
}) {
  return (
    <div className="queues">
      {view.queues.map((queue, lane) => (
        <div className="queue" key={lane}>
          <button
            className="queue-box"
            data-testid={`queue-${lane}`}
            aria-label={`Queue ${lane + 1}${queue[0] ? `: ${queue[0].color}, ${queue[0].count} blocks` : ": empty"}`}
            disabled={
              !queue[0] ||
              paused ||
              !view.slots.includes(null) ||
              view.status !== "playing"
            }
            style={
              {
                "--box-color": queue[0] ? PALETTE[queue[0].color] : "#aaa68c",
                "--box-ink":
                  queue[0] && ["ink", "brown"].includes(queue[0].color)
                    ? "#fffaf3"
                    : "#17382e",
                outline: hint === lane ? "3px solid #304b35" : undefined,
                outlineOffset: 4,
              } as React.CSSProperties
            }
            onClick={() => deploy(lane)}
          >
            {queue[0]?.count ?? "✓"}
          </button>
          <div
            className="queue-previews"
            aria-label={`Queue ${lane + 1} upcoming boxes`}
          >
            {[1, 2].map((offset) => {
              const box = queue[offset];
              return (
                <div
                  key={offset}
                  className={`queue-peek ${box ? "" : "empty-preview"}`}
                  aria-label={
                    box
                      ? `Upcoming ${box.color}, ${box.count} blocks`
                      : "No upcoming box"
                  }
                  style={
                    box
                      ? ({
                          "--box-color": PALETTE[box.color],
                          "--box-ink": ["ink", "brown"].includes(box.color)
                            ? "#fffaf3"
                            : "#17382e",
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <small>{offset === 1 ? "다음" : "그다음"}</small>
                  <span>{box?.count ?? "—"}</span>
                </div>
              );
            })}
          </div>
          <div className="queue-key">
            {lane + 1}번 줄 · {queue.length}상자
          </div>
        </div>
      ))}
    </div>
  );
}
