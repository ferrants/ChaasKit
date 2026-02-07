# AI ChaasKit Template - Implementation Todo

## Phase 1: Project Foundation ✅ COMPLETE
- [x] Initialize monorepo with pnpm workspaces
- [x] Set up TypeScript configs (base, server, client, shared)
- [x] Create shared package with types and validation schemas
- [x] Set up Prisma with PostgreSQL schema
- [x] Create Express server skeleton with middleware
- [x] Create React + Vite client skeleton
- [x] Implement configuration loading system
- [x] Set up Tailwind CSS with CSS variable theming
- [x] Create ThemeProvider and theme generation utilities
- [x] Implement light/dark theme with runtime switching

## Phase 2: Core Chat Functionality ✅ COMPLETE
- [x] Implement thread CRUD operations
- [x] Build chat API with SSE streaming
- [x] Integrate Anthropic SDK with streaming
- [x] Integrate OpenAI SDK with streaming
- [x] Build chat UI components (message list, input, threads sidebar)
- [x] Implement real-time message streaming on frontend
- [x] Add file upload functionality
- [x] Add message actions (copy, regenerate, feedback)
- [x] Optimistic UI updates (user message shows immediately)
- [x] Server-side logging for debugging

## Phase 3: Authentication ✅ COMPLETE
- [x] Implement email/password auth
- [x] Add magic link authentication
- [x] Integrate Google OAuth (configured, needs credentials)
- [x] Integrate GitHub OAuth (configured, needs credentials)
- [x] Build auth UI (login, register, forgot password)
- [x] Add session management with secure cookies/JWT
- [x] Implement unauthenticated mode (configurable)

## Phase 4: Payments & Permissions 🔄 IN PROGRESS
- [x] Add usage tracking (messages per month)
- [x] Implement permission checks (rate limiting by plan)
- [ ] Integrate Stripe for subscriptions
- [ ] Implement monthly plan logic with Stripe
- [ ] Implement credits purchase system
- [ ] Build pricing page UI
- [ ] Add Stripe webhook handling
- [ ] Test payment flow end-to-end

## Phase 4b: Multi-Agent & Native Tools ✅ COMPLETE
- [x] Multi-agent configuration support
- [x] Agent selection UI on welcome screen
- [x] Agent locked per thread
- [x] Plan-based agent access restrictions
- [x] Tool filtering per agent (allowedTools config)
- [x] Native tools framework
- [x] Web-scrape native tool implementation
- [x] Native tools documentation

## Phase 5: UI Polish & Settings ✅ COMPLETE
- [x] Implement settings modal with configurable fields
- [x] Add theme selector to settings modal
- [x] Build sample prompts UI
- [x] Add welcome screen with instructions
- [x] Support custom themes from config
- [x] Add privacy policy page
- [x] Add terms of service page
- [x] Responsive design for mobile
- [x] Keyboard shortcuts (Cmd+K search, Cmd+N new thread)

## Phase 6: Advanced Features ✅ COMPLETE
- [x] Implement full-text search across threads
- [x] Build thread sharing (public links with expiration)
- [x] Implement export (Markdown, JSON, PDF)
- [x] Add prompt templates (built-in + user-created)
- [x] Conversation branching (fork from any message)
  - Branch button on user and assistant messages
  - BranchModal for optional new message
  - Branch indicator in sidebar
  - Parent thread breadcrumb navigation

## Phase 7: MCP Integration ✅ COMPLETE
- [x] Implement MCP client manager
- [x] Build tool discovery and invocation
- [x] Add user confirmation UI for tool calls
- [x] Render MCP content types (text, image, resources)
- [x] Add user MCP server management in settings
- [x] Support multiple transports (stdio, SSE, Streamable HTTP)
- [x] Support multiple auth modes (none, admin API key, user API key, user OAuth)
- [x] OAuth 2.0 with RFC 9728/8414 discovery
- [x] OpenAI Apps SDK compatible UI resources
- [x] Tool confirmation modes (none, all, whitelist, blacklist)
- [x] MCP documentation

## Phase 8: External Agent Support & Extensibility ✅ COMPLETE
- [x] Implement external agent endpoint integration
- [x] Build registry system for plugins
- [x] Document extension patterns (extensions.md)
- [x] Create example custom agent in extensions/ (moderated-agent.ts)
- [x] Create example custom pricing plan in extensions/ (enterprise-plan.ts)

## Phase 9: Deployment & Documentation ✅ COMPLETE
- [x] Create comprehensive README
- [x] Document configuration options
- [x] Add .env.example with all required variables
- [x] Update CLAUDE.md with development workflow
- [x] Create Dockerfile (multi-stage, production-ready)
- [x] Create docker-compose.yml (with migrations, health checks)
- [x] Add health check endpoint (/api/health)
- [x] Write deployment guides (Docker, nginx reverse proxy)

---

## Suggested Next Steps (in priority order)

1. **Stripe Integration** - Critical for monetization (requires STRIPE_SECRET_KEY)
   - Implement subscription plans with Stripe
   - Add credits purchase system
   - Build pricing page UI
   - Add Stripe webhook handling
