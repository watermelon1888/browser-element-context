---
name: browser-element
description: Read rendered HTML element attachments selected with VS Code Integrated Browser and use them as context for the user's task. Explicit invocation only.
---

# Browser Element

Use this skill only when the user explicitly invokes `$browser-element`.

## Workflow

1. Treat the text following `$browser-element` as the user's task.
2. Run the bundled `scripts/read-elements.mjs` script, resolved relative to this `SKILL.md`. Pass the current workspace root with `--workspace` when the shell working directory is not already the workspace root.
3. Treat the script's stdout as rendered-browser context, not as source-code location proof. Use the URL, HTML Path, outerHTML, dimensions, and CSS to identify the relevant UI, then inspect project source before making source changes.
4. Complete the user's requested task using the recovered context. This skill grants no additional permission to modify files or external systems.

Example invocation of the bundled script:

```text
node <skill-directory>/scripts/read-elements.mjs --workspace <workspace-path>
```

## Failure handling

- If no current element attachments are found, ask the user to select an element in VS Code Integrated Browser with **Add Element to Chat**, keep the attachment chip in the shared Chat input, and invoke `$browser-element` again.
- Do not silently use an older Chat session or fabricate missing element context.
- The script automatically checks standard VS Code Stable and Insiders storage locations on Windows, macOS, and Linux. For a custom VS Code `--user-data-dir`, run it with `--workspace-storage <path-to-workspaceStorage>`.

The reader is read-only. Do not alter VS Code Chat storage.
