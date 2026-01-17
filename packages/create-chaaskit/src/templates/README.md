# {{PROJECT_NAME}}

AI-powered chat application built with ChaasKit.

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database URL
   ```

3. **Setup database**
   ```bash
   pnpm db:push
   ```

4. **Start development**
   ```bash
   pnpm dev
   ```

## Configuration

Edit `config/app.config.ts` to customize:
- App name and branding
- Theme colors
- Authentication methods
- AI provider and model
- Payment plans
- And more...

## Extensions

Add custom functionality in the `extensions/` directory:

- `extensions/agents/` - Custom AI agents
- `extensions/payment-plans/` - Custom pricing plans
- `extensions/pages/` - Custom pages for the frontend

## Commands

- `pnpm dev` - Start development servers
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm db:push` - Push database schema
- `pnpm db:studio` - Open database GUI

## Using Local/Development Packages

To test unreleased features or contribute to the core packages:

```bash
# Clone the monorepo
git clone https://github.com/your-repo/chaaskit
cd chaaskit

# Build and link packages globally
pnpm build
pnpm -r exec pnpm link --global

# In your project directory, link the local packages
cd /path/to/your-project
pnpm link --global @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared
```

After making changes to the monorepo, rebuild to update linked packages:

```bash
cd /path/to/chaaskit
pnpm build
```

## Documentation

For full documentation, see the `docs/` directory or visit the [ChaasKit docs](https://github.com/your-repo/chat-saas).
