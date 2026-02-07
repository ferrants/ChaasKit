# Tool Enhancements

## Tool UI Bridge (Host Handler)
- Add/maintain a host-side handler at `window.chaaskitToolUiHandler` to receive tool UI iframe messages.
- Messages originate from `window.openai.*` calls inside tool UI iframes (via `postMessage`).
- Handler receives `{ type, payload }` and should return a result to the iframe.
- If no handler is present, tool UI calls return an error.

Potential follow-ups:
- Document the handler contract and payload/response shapes.
- Provide a default implementation in the client that forwards to API endpoints.
- Add tests for the host handler and iframe request/response round trip.

## Native Tool React Rendering (No Iframe)
- Allow native (non-MCP) tools to return structured output/content without requiring `outputTemplate`.
- Provide a registration API so tools can register a React renderer component (client-side) for a tool name/type.
- Rendering path:
  - Tool returns `structuredOutput` + `content` (plain result)
  - If a renderer is registered for the tool, the client renders it directly (no iframe)
  - Fallback to JSON/text rendering if no renderer exists
- Considerations:
  - Versioned renderer contract for stability across releases
  - Safe serialization for structured output (avoid large payloads)
  - SSR-safe registration for environments without `window`
  - Permission/confirmation UX should still apply for tool execution

## Tool Result Caching + Replay
- Cache tool results by `(toolName, argsHash, userId|teamId)` with TTL.
- Add “Replay last result” or “Use cached result” affordances to reduce repeated calls.

## Tool Schema Versioning + Migration Hooks
- Tool metadata exposes a `version`.
- Optional `migrateInput` / `migrateOutput` to keep old stored calls compatible.

## Tool Capability Flags
- Tools declare capabilities like `requiresAuth`, `requiresTeam`, `supportsStreaming`, `needsFiles`, `supportsUIRenderer`.
- Client UX adapts based on flags (progress UI, file inputs, etc.).

## Structured Tool Errors + Remediation
- Standardize error shape: `{ code, message, retryable, resolutionHint }`.
- Client can render actionable errors and offer retries.

## Streaming Tool Outputs
- Allow tools to emit incremental output/progress.
- Stream into chat UI with a progress indicator and partial updates.

## Tool Telemetry Hooks
- Record tool usage metrics: duration, success/failure, error codes.
- Export hooks for analytics/logging.

## Tool Permissions Policy DSL
- Extend beyond `allowedTools` with rules: pattern + scopes + conditions.
- Example: allow `native:search` only for `plan=pro` or `teamRole>=admin`.

## Tool File Outputs
- Standardize file results: `{ name, mimeType, size, downloadUrl }`.
- Client renders download buttons / previews.

## Tool UI Lifecycle Callbacks
- Add `onOpen`, `onClose`, `onError` hooks for embedded UI components.
- Useful for analytics and cleanup.

## Tool Sandboxing Profiles
- Declare per-tool runtime constraints (network, filesystem, timeouts).
- Surface to tool runners when sandboxing/external execution is added.
