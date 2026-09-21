"use client";
// shadcn/ui Resizable, manually installed with the project's CSS theme.
// Source: https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/resizable.tsx
// MIT license; see SHADCN-LICENSE.md.
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

function ResizablePanelGroup({
  className = "",
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={`resizable-panel-group ${className}`}
      {...props}
    />
  );
}
function ResizablePanel(props: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}
function ResizableHandle({
  withHandle,
  className = "",
  ...props
}: ResizablePrimitive.SeparatorProps & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={`resizable-handle ${className}`}
      {...props}
    >
      {withHandle && (
        <div className="resizable-grip">
          <GripVerticalIcon size={14} aria-hidden="true" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}
export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
