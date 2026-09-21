"use client";
import { useId, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/shared/ui/button";
export function WorkspaceShell({
  navigation,
  children,
}: {
  navigation: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const navigationId = useId();
  const label = collapsed ? "사이드바 펼치기" : "사이드바 접기";
  return (
    <div className={"shell" + (collapsed ? " shell-sidebar-collapsed" : "")}>
      <aside className="sidebar" aria-label="프로젝트 탐색">
        <div className="sidebar-toggle-row">
          <Button
            variant="ghost"
            className="sidebar-toggle"
            aria-label={label}
            title={label}
            aria-expanded={!collapsed}
            aria-controls={navigationId}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            {!collapsed && <span>사이드바 접기</span>}
          </Button>
        </div>
        <div
          id={navigationId}
          className="sidebar-navigation"
          hidden={collapsed}
        >
          {navigation}
        </div>
      </aside>
      {children}
    </div>
  );
}
