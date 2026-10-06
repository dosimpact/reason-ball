# 2026-10-06 — UI-PUSH-KWARGS-25

User requested explicit parameter names in push_ui_message calls. All five call sites now name name= and props=, with remaining arguments on separate lines. No payload or graph behavior changes. Python syntax parsed successfully; no tests or provider calls.
