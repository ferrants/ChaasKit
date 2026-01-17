# Deployment

This guide covers deploying ChaasKit applications to production.

## Deployment Options

- **[AWS Elastic Beanstalk](./deployment-aws.md)** - Full infrastructure via CDK with RDS PostgreSQL
- **Docker** - Container-based deployment (see below)
- **Platform Services** - Railway, Render, Fly.io, Heroku (see below)

## Build

```bash
pnpm build
```

This creates:
- `build/server/` - Server bundle for Node.js
- `build/client/` - Client assets (JS, CSS)

The production server serves both API routes and the React Router v7 application.

## Start Production Server

```bash
pnpm start
```

This runs `server.js` which starts the production server on port 3000 (or `PORT` env var).

## Production Requirements

- Node.js 18+
- PostgreSQL 14+
- Environment variables configured
- HTTPS for production

## Environment Variables

Production `.env`:

```bash
# Required
NODE_ENV=production
DATABASE_URL="postgresql://..."
SESSION_SECRET="production-secret-32-chars-min"
JWT_SECRET="production-jwt-secret-32-chars-min"
APP_URL="https://your-domain.com"
API_URL="https://your-domain.com"

# AI Provider (at least one required)
ANTHROPIC_API_KEY="sk-ant-..."
# or
OPENAI_API_KEY="sk-..."

# Optional - OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# Optional - Payments
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-slim

RUN corepack enable pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY config/ ./config/
COPY prisma/ ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY build/ ./build/
COPY server.js ./

# Generate Prisma client
RUN npx prisma generate --schema=./prisma/schema

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
```

### Build Steps

```bash
# 1. Build the application locally
pnpm build

# 2. Build Docker image
docker build -t my-chat-app .

# 3. Run container
docker run -p 3000:3000 --env-file .env.production my-chat-app
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/my_app
    env_file:
      - .env.production
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=my_app
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Platform Deployments

### Railway

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Railway auto-detects Node.js and deploys

Build settings (if needed):
- Build command: `pnpm install && pnpm build && pnpm db:generate`
- Start command: `pnpm start`

### Render

1. Create a Web Service
2. Connect your repository
3. Configure:
   - Build command: `pnpm install && pnpm build && npx prisma generate`
   - Start command: `node server.js`
4. Add environment variables

### Fly.io

Create `fly.toml`:

```toml
app = "my-chat-app"
primary_region = "iad"

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

Deploy:
```bash
fly launch
fly secrets set DATABASE_URL="..." JWT_SECRET="..." SESSION_SECRET="..."
fly deploy
```

### Heroku

Create `Procfile`:
```
web: node server.js
```

Deploy:
```bash
heroku create my-chat-app
heroku config:set DATABASE_URL="..." JWT_SECRET="..."
git push heroku main
```

## Database Migrations

### Development (Push)

```bash
pnpm db:push
```

### Production (Migrations)

```bash
# Create a migration
pnpm db:migrate

# Deploy migrations in production
DATABASE_URL="..." npx prisma migrate deploy
```

## Reverse Proxy (Nginx)

For running behind Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Proxy all requests to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE support for chat streaming
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## Health Checks

The app exposes a health endpoint:

```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Use this for load balancer health checks and uptime monitoring.

## Security Checklist

- [ ] HTTPS enabled
- [ ] Environment variables secured (not in code)
- [ ] Database credentials rotated regularly
- [ ] Strong, unique secrets for JWT and session
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Document upload limits set (`documents.maxFileSizeMB`)
- [ ] MCP servers scoped appropriately
- [ ] Admin access restricted

## Monitoring

### Logging

Server logs include:
- Request logs with timing
- Error stack traces
- Config loading status
- MCP connection status

### Error Tracking

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Datadog for metrics

## Scaling

### Horizontal Scaling

The app is stateless and can be horizontally scaled:

```bash
# Docker Compose
docker-compose up --scale app=3

# Kubernetes
kubectl scale deployment my-chat-app --replicas=3
```

### Database Connection Pooling

For production, use connection pooling:

```
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
```

Consider using PgBouncer or similar for high-traffic deployments.

### CDN

For static assets, consider a CDN:
- CloudFlare
- AWS CloudFront
- Vercel Edge Network

Static assets are served from `build/client/assets/` with cache headers.

## Updating in Production

When deploying updates:

1. Build the new version locally or in CI
2. Run database migrations if needed
3. Deploy the new build
4. Restart the server

```bash
# Example update script
pnpm build
pnpm db:migrate
# Deploy build/ to production
# Restart server
```

For zero-downtime deployments, use rolling updates with your platform's deployment strategy.
