import { percent } from "./model";

import type { useMultimodalVoiceInput } from "./useMultimodalVoiceInput";

type Props = Pick<
  ReturnType<typeof useMultimodalVoiceInput>,
  | "voiceEvents"
>;

export function VoiceEvents({
  voiceEvents,
}: Props) {
  return (
    <div className="voice-events-panel" role="region" aria-label="Voice Events">
      <div className="panel-title">Voice Events</div>
      <div className="voice-event-list">
        {voiceEvents.length === 0 ? (
          <p className="muted">Voice stream events appear after the run.</p>
        ) : (
          voiceEvents.map((event, index) => (
            <article key={`${event.phase}-${event.status}-${index}`} className="voice-event-row">
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
