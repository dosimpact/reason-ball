import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  deployBox,
  getHintLane,
  tickGame,
  type Difficulty,
  type GameState,
} from "../../entities/game";
import {
  readSelection,
  saveSelection,
  saveProgress,
} from "../../features/progress";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(message: string): void };
  }
}
function nativeMessage(message: object) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ v: 1, ...message }));
}
export function useGameSession() {
  const [initial] = useState(() => {
    const selection = readSelection();
    return createGame(selection.level, selection.difficulty);
  });
  const game = useRef<GameState>(initial);
  const [view, setView] = useState(game.current);
  const pendingReward = useRef<string | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transientNotice = useRef<"full" | "wait" | null>(null);
  const manualPause = useRef(false);
  const helpOpen = useRef(false);
  const started = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  const backgroundPause = useRef(false);
  const nativePause = useRef(false);
  const canvas = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1),
    [instructions, setInstructions] = useState(false),
    [message, setMessage] = useState(""),
    [hint, setHint] = useState<number | null>(null);
  const publish = useCallback(() => {
    if (
      (transientNotice.current === "full" &&
        game.current.slots.includes(null)) ||
      (transientNotice.current === "wait" && getHintLane(game.current) !== null)
    ) {
      transientNotice.current = null;
      setMessage("");
    }
    setView({ ...game.current });
  }, []);
  const pause = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);
  const syncPause = useCallback(() => {
    pause(
      manualPause.current ||
        backgroundPause.current ||
        helpOpen.current ||
        !!pendingReward.current,
    );
  }, [pause]);
  const openHelp = useCallback(() => {
    helpOpen.current = true;
    setInstructions(true);
    syncPause();
  }, [syncPause]);
  const closeHelp = useCallback(() => {
    helpOpen.current = false;
    setInstructions(false);
    syncPause();
  }, [syncPause]);
  const togglePause = useCallback(() => {
    if (helpOpen.current || pendingReward.current) return;
    manualPause.current = !manualPause.current;
    syncPause();
  }, [syncPause]);
  const start = useCallback(
    (level: number, difficulty: Difficulty) => {
      pendingReward.current = null;
      setHintPending(false);
      started.current = false;
      setHasStarted(false);
      helpOpen.current = false;
      setInstructions(false);
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
      game.current = createGame(level, difficulty);
      saveSelection(difficulty, level);
      manualPause.current = false;
      syncPause();
      setHint(null);
      transientNotice.current = null;
      setMessage("");
      publish();
    },
    [syncPause, publish],
  );
  const deploy = useCallback(
    (lane: number) => {
      if (pausedRef.current || game.current.status !== "playing") return;
      const before = game.current;
      game.current = deployBox(before, lane);
      setHint(null);
      if (game.current === before) {
        const full = !game.current.slots.includes(null);
        transientNotice.current = full ? "full" : null;
        setMessage(
          full
            ? "대기 슬롯이 가득 찼어요. 고양이가 돌아올 때까지 기다려 주세요."
            : "이 줄의 상자는 모두 사용했어요. 다른 줄을 선택해 주세요.",
        );
      } else {
        transientNotice.current = null;
        started.current = true;
        setHasStarted(true);
        setMessage("");
      }
      publish();
    },
    [publish],
  );
  const revealHint = useCallback(() => {
    const lane = getHintLane(game.current);
    setHint(lane);
    transientNotice.current = lane === null ? "wait" : null;
    setMessage(
      lane === null
        ? game.current.ants.length
          ? "고양이가 작업을 마칠 때까지 잠시 기다려 주세요."
          : "지금 추천할 상자가 없어요. 드러난 색과 빈자리를 살펴보세요."
        : `${lane + 1}번 상자를 선택해 보세요.`,
    );
  }, []);
  const requestHint = () => {
    if (
      pausedRef.current ||
      game.current.status !== "playing" ||
      pendingReward.current
    )
      return;
    if (getHintLane(game.current) === null) {
      revealHint();
      return;
    }
    if (window.ReactNativeWebView) {
      const requestId = String(Date.now());
      pendingReward.current = requestId;
      setHintPending(true);
      syncPause();
      rewardTimer.current = setTimeout(() => {
        if (pendingReward.current === requestId) {
          pendingReward.current = null;
          setHintPending(false);
          syncPause();
          setMessage("광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }
      }, 200000);
      setMessage("보상 광고를 준비하고 있어요.");
      nativeMessage({ type: "REWARDED_HINT", requestId });
    } else revealHint();
  };
  useEffect(() => {
    nativeMessage({ type: "READY" });
    const handle = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.v !== 1) return;
      if (detail.type === "PAUSE") {
        nativePause.current = detail.paused === true;
        backgroundPause.current = nativePause.current || document.hidden;
        syncPause();
      }
      if (
        detail.type === "REWARDED_RESULT" &&
        detail.requestId === pendingReward.current
      ) {
        pendingReward.current = null;
        setHintPending(false);
        syncPause();
        if (rewardTimer.current) clearTimeout(rewardTimer.current);
        if (detail.earned) revealHint();
        else setMessage("광고를 완료하지 않아 힌트가 지급되지 않았어요.");
      }
    };
    window.addEventListener("ant:native", handle);
    return () => {
      window.removeEventListener("ant:native", handle);
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
    };
  }, [syncPause, revealHint]);
  useEffect(() => {
    let accumulator = 0,
      lastPublish = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ready = false;
    const loop = (now: number, elapsed: number) => {
      if (!ready) {
        ready = true;
        setRendererReady(true);
      }
      const delta = Math.min(elapsed, 100);
      if (
        started.current &&
        !pausedRef.current &&
        game.current.status === "playing"
      ) {
        accumulator += delta;
        while (accumulator >= 25) {
          game.current = tickGame(game.current, 25, speedRef.current);
          accumulator -= 25;
        }
        if (game.current.status === "won") {
          saveProgress(game.current.difficulty, game.current.level + 1);
          nativeMessage({ type: "LEVEL_COMPLETE", level: game.current.level });
          publish();
        } else if (game.current.status === "lost") publish();
      }
      if (now - lastPublish > 100) {
        publish();
        lastPublish = now;
      }
      return {
        state: game.current,
        reducedMotion: reduced,
        animate:
          started.current &&
          !pausedRef.current &&
          game.current.status === "playing",
      };
    };
    let disposed = false;
    let renderer: { destroy(): void } | undefined;
    void import("./renderer")
      .then(({ createRenderer }) => {
        if (!disposed && canvas.current)
          renderer = createRenderer(canvas.current, loop);
      })
      .catch(() => {
        if (!disposed)
          setMessage("게임 화면을 불러오지 못했어요. 새로고침해 주세요.");
      });
    return () => {
      disposed = true;
      renderer?.destroy();
    };
  }, [publish]);
  useEffect(() => {
    const handle = () => {
      backgroundPause.current = nativePause.current || document.hidden;
      syncPause();
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [syncPause]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches("input,select,button")) return;
      if (["1", "2", "3"].includes(event.key)) deploy(Number(event.key) - 1);
      if (event.code === "Space") {
        event.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [deploy, togglePause]);

  return {
    view,
    canvas,
    paused,
    speed,
    instructions,
    openHelp,
    closeHelp,
    togglePause,
    hasStarted,
    hintPending,
    rendererReady,
    message,
    hint,
    start,
    pause,
    deploy,
    requestHint,
    setInstructions,
    setSpeed,
    speedRef,
    manualPause,
    backgroundPause,
  };
}
