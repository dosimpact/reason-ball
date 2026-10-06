import { percent } from "./model";

import type { useMultimodalVoiceOutput } from "./useMultimodalVoiceOutput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceOutput>,
  | "audioEvents"
>;

export function VoiceOutputEvents({
  audioEvents,
}: Props) {
  return (
    <div className="voice-output-events-panel" role="region" aria-label="Voice Output Events">
      <div className="panel-title">Voice Output Events</div>
      <div className="voice-output-event-list">
        {audioEvents.length === 0 ? (
          <p className="muted">Voice output events appear after the run.</p>
        ) : (
          audioEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="voice-output-event-row">
              <strong>{event.phase}</strong>
              <span>{event.status}</span>
              <p>{event.detail}</p>
              <code>{percent(event.progress)}%</code>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
