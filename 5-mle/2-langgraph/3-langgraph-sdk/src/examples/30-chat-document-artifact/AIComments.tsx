import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "comments"
>;

export function AIComments({
  comments,
}: Props) {
  return (
    <div className="document-comments-panel" role="region" aria-label="AI Comments">
      <div className="panel-title">AI Comments</div>
      <div className="document-comment-list">
        {comments.length === 0 ? (
          <p className="muted">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className={`document-comment-row ${comment.severity}`}>
              <strong>{comment.sectionId}</strong>
              <span>{comment.severity}</span>
              <p>{comment.text}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
