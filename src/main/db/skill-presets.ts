/**
 * Preset skills — seeded on first launch and updated on app upgrades.
 * Auto-generated from ~/.claude/skills/ — do not edit manually.
 */

export interface PresetSkill {
  id: string
  name: string
  description: string
  instructions: string
  sortOrder: number
  refs: Array<{ id: string; name: string; content: string; sortOrder: number }>
}

export const PRESET_SKILLS: PresetSkill[] = [
  {
    id: 'builtin-agent-creator',
    name: 'Agent Creator',
    description: `Use when the user wants to create a new custom agent for Claude Code. Generates a properly formatted agent .md file in ~/.claude/agents/ following the user's established conventions.

Examples:
- "/agent-creator" → Launch skill to create a new agent
- "새 에이전트 만들어줘" → Launch skill
- "QA 테스터 에이전트 추가해" → Launch skill with context`,
    instructions: `# Create Agent Skill

Generate a new custom agent \`.md\` file in \`~/.claude/agents/\` that matches the user's existing agent conventions.

## Workflow

### 1. Gather Requirements

Ask the user for the following (skip any they already provided):

- **name**: kebab-case agent name (e.g., \`qa-tester\`, \`tech-writer\`)
- **role**: What this agent does (1-2 sentences)
- **model**: \`haiku\` (lightweight tasks), \`sonnet\` (development/analysis), or \`opus\` (complex reasoning/strategy)

### 2. Analyze Existing Agents

Read 2-3 existing agents from \`~/.claude/agents/\` to match the current conventions:
- Frontmatter format (name, description, model, memory, tools)
- Section structure (role intro → responsibilities → expertise → workflow → collaboration → communication)
- Tone and detail level

### 3. Generate Agent File

Create \`~/.claude/agents/{name}.md\` with this structure:

\`\`\`markdown
---
name: {name}
description: "{1-2 sentence description with 3-5 usage examples}"
model: {model}
memory: user
---

{Role introduction paragraph - 1-2 sentences, senior professional persona}

## Core Responsibilities

{4-6 numbered responsibilities}

## Technical Expertise (or domain-specific equivalent)

{Relevant skills, tools, frameworks organized by category}

## Workflow

{Step-by-step working process}

## Collaboration

- Work with relevant existing agents (ceo, cso, planner, frontend-dev, backend-dev, mobile-dev, ai-engineer, data-engineer, devops, researcher, reviewer, writer, doc-translator, git-master)
- Submit work to **reviewer** for quality gate (if applicable)
- Follow **planner**'s task assignments (if applicable)

## Communication

- Respond in user's language
- Use \`uv run python\` for Python execution

**Update your agent memory** as you discover {domain-specific learnings}.
\`\`\`

### 4. Configuration Decisions

- **tools**: Only restrict if the agent should NOT have full tool access (e.g., read-only agents). Default: omit (grants all tools).
- **model**: Match complexity to cost:
  - \`haiku\`: Translation, git ops, simple formatting (Haiku 4.5)
  - \`sonnet\`: Code writing, analysis, debugging (Sonnet 4.6)
  - \`opus\`: Strategy, complex reasoning, architecture decisions (Opus 4.6)

### 5. Verify

- Confirm the file was created at the correct path
- Show the user the complete agent file for review

## Rules

- Match the style and depth of existing agents — don't be more verbose or more terse
- Description examples in frontmatter should use the arrow format: \`"Do X" → Launch {name}\`
- Always include \`memory: user\` in frontmatter
- Korean persona descriptions are fine if user speaks Korean, but agent names must be English kebab-case
- Don't add unnecessary sections — keep it focused on the agent's actual domain`,
    sortOrder: -13,
    refs: [
    ]
  },
  {
    id: 'builtin-db-advisor',
    name: 'DB Advisor',
    description: `PostgreSQL database patterns for query optimization, schema design, indexing, and security. Based on Supabase best practices.`,
    instructions: `# PostgreSQL Patterns

Quick reference for PostgreSQL best practices. For detailed guidance, use the \`database-reviewer\` agent.

## When to Activate

- Writing SQL queries or migrations
- Designing database schemas
- Troubleshooting slow queries
- Implementing Row Level Security
- Setting up connection pooling

## Quick Reference

### Index Cheat Sheet

| Query Pattern | Index Type | Example |
|--------------|------------|---------|
| \`WHERE col = value\` | B-tree (default) | \`CREATE INDEX idx ON t (col)\` |
| \`WHERE col > value\` | B-tree | \`CREATE INDEX idx ON t (col)\` |
| \`WHERE a = x AND b > y\` | Composite | \`CREATE INDEX idx ON t (a, b)\` |
| \`WHERE jsonb @> '{}'\` | GIN | \`CREATE INDEX idx ON t USING gin (col)\` |
| \`WHERE tsv @@ query\` | GIN | \`CREATE INDEX idx ON t USING gin (col)\` |
| Time-series ranges | BRIN | \`CREATE INDEX idx ON t USING brin (col)\` |

### Data Type Quick Reference

| Use Case | Correct Type | Avoid |
|----------|-------------|-------|
| IDs | \`bigint\` | \`int\`, random UUID |
| Strings | \`text\` | \`varchar(255)\` |
| Timestamps | \`timestamptz\` | \`timestamp\` |
| Money | \`numeric(10,2)\` | \`float\` |
| Flags | \`boolean\` | \`varchar\`, \`int\` |

### Common Patterns

**Composite Index Order:**
\`\`\`sql
-- Equality columns first, then range columns
CREATE INDEX idx ON orders (status, created_at);
-- Works for: WHERE status = 'pending' AND created_at > '2024-01-01'
\`\`\`

**Covering Index:**
\`\`\`sql
CREATE INDEX idx ON users (email) INCLUDE (name, created_at);
-- Avoids table lookup for SELECT email, name, created_at
\`\`\`

**Partial Index:**
\`\`\`sql
CREATE INDEX idx ON users (email) WHERE deleted_at IS NULL;
-- Smaller index, only includes active users
\`\`\`

**RLS Policy (Optimized):**
\`\`\`sql
CREATE POLICY policy ON orders
  USING ((SELECT auth.uid()) = user_id);  -- Wrap in SELECT!
\`\`\`

**UPSERT:**
\`\`\`sql
INSERT INTO settings (user_id, key, value)
VALUES (123, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO UPDATE SET value = EXCLUDED.value;
\`\`\`

**Cursor Pagination:**
\`\`\`sql
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;
-- O(1) vs OFFSET which is O(n)
\`\`\`

**Queue Processing:**
\`\`\`sql
UPDATE jobs SET status = 'processing'
WHERE id = (
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at LIMIT 1
  FOR UPDATE SKIP LOCKED
) RETURNING *;
\`\`\`

### Anti-Pattern Detection

\`\`\`sql
-- Find unindexed foreign keys
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Check table bloat
SELECT relname, n_dead_tup, last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
\`\`\`

### Configuration Template

\`\`\`sql
-- Connection limits (adjust for RAM)
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET work_mem = '8MB';

-- Timeouts
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
ALTER SYSTEM SET statement_timeout = '30s';

-- Monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Security defaults
REVOKE ALL ON SCHEMA public FROM public;

SELECT pg_reload_conf();
\`\`\`

## Related

- Agent: \`database-reviewer\` - Full database review workflow
- Skill: \`migration-advisor\` - Database migration patterns

---

*Based on Supabase Agent Skills (credit: Supabase team) (MIT License)*`,
    sortOrder: -12,
    refs: [
    ]
  },
  {
    id: 'builtin-docker-advisor',
    name: 'Docker Advisor',
    description: `Docker and Docker Compose patterns for local development, container security, networking, volume strategies, and multi-service orchestration.`,
    instructions: `# Docker Patterns

Docker and Docker Compose best practices for containerized development.

## When to Activate

- Setting up Docker Compose for local development
- Designing multi-container architectures
- Troubleshooting container networking or volume issues
- Reviewing Dockerfiles for security and size
- Migrating from local dev to containerized workflow

## Docker Compose for Local Development

### Standard Web App Stack

\`\`\`yaml
# docker-compose.yml
services:
  app:
    build:
      context: .
      target: dev                     # Use dev stage of multi-stage Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - .:/app                        # Bind mount for hot reload
      - /app/node_modules             # Anonymous volume -- preserves container deps
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
      - REDIS_URL=redis://redis:6379/0
      - NODE_ENV=development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  mailpit:                            # Local email testing
    image: axllent/mailpit
    ports:
      - "8025:8025"                   # Web UI
      - "1025:1025"                   # SMTP

volumes:
  pgdata:
  redisdata:
\`\`\`

### Development vs Production Dockerfile

\`\`\`dockerfile
# Stage: dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage: dev (hot reload, debug tools)
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage: build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

# Stage: production (minimal image)
FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
\`\`\`

### Override Files

\`\`\`yaml
# docker-compose.override.yml (auto-loaded, dev-only settings)
services:
  app:
    environment:
      - DEBUG=app:*
      - LOG_LEVEL=debug
    ports:
      - "9229:9229"                   # Node.js debugger

# docker-compose.prod.yml (explicit for production)
services:
  app:
    build:
      target: production
    restart: always
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
\`\`\`

\`\`\`bash
# Development (auto-loads override)
docker compose up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
\`\`\`

## Networking

### Service Discovery

Services in the same Compose network resolve by service name:
\`\`\`
# From "app" container:
postgres://postgres:postgres@db:5432/app_dev    # "db" resolves to the db container
redis://redis:6379/0                             # "redis" resolves to the redis container
\`\`\`

### Custom Networks

\`\`\`yaml
services:
  frontend:
    networks:
      - frontend-net

  api:
    networks:
      - frontend-net
      - backend-net

  db:
    networks:
      - backend-net              # Only reachable from api, not frontend

networks:
  frontend-net:
  backend-net:
\`\`\`

### Exposing Only What's Needed

\`\`\`yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"   # Only accessible from host, not network
    # Omit ports entirely in production -- accessible only within Docker network
\`\`\`

## Volume Strategies

\`\`\`yaml
volumes:
  # Named volume: persists across container restarts, managed by Docker
  pgdata:

  # Bind mount: maps host directory into container (for development)
  # - ./src:/app/src

  # Anonymous volume: preserves container-generated content from bind mount override
  # - /app/node_modules
\`\`\`

### Common Patterns

\`\`\`yaml
services:
  app:
    volumes:
      - .:/app                   # Source code (bind mount for hot reload)
      - /app/node_modules        # Protect container's node_modules from host
      - /app/.next               # Protect build cache

  db:
    volumes:
      - pgdata:/var/lib/postgresql/data          # Persistent data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql  # Init scripts
\`\`\`

## Container Security

### Dockerfile Hardening

\`\`\`dockerfile
# 1. Use specific tags (never :latest)
FROM node:22.12-alpine3.20

# 2. Run as non-root
RUN addgroup -g 1001 -S app && adduser -S app -u 1001
USER app

# 3. Drop capabilities (in compose)
# 4. Read-only root filesystem where possible
# 5. No secrets in image layers
\`\`\`

### Compose Security

\`\`\`yaml
services:
  app:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.cache
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE          # Only if binding to ports < 1024
\`\`\`

### Secret Management

\`\`\`yaml
# GOOD: Use environment variables (injected at runtime)
services:
  app:
    env_file:
      - .env                     # Never commit .env to git
    environment:
      - API_KEY                  # Inherits from host environment

# GOOD: Docker secrets (Swarm mode)
secrets:
  db_password:
    file: ./secrets/db_password.txt

services:
  db:
    secrets:
      - db_password

# BAD: Hardcoded in image
# ENV API_KEY=sk-proj-xxxxx      # NEVER DO THIS
\`\`\`

## .dockerignore

\`\`\`
node_modules
.git
.env
.env.*
dist
coverage
*.log
.next
.cache
docker-compose*.yml
Dockerfile*
README.md
tests/
\`\`\`

## Debugging

### Common Commands

\`\`\`bash
# View logs
docker compose logs -f app           # Follow app logs
docker compose logs --tail=50 db     # Last 50 lines from db

# Execute commands in running container
docker compose exec app sh           # Shell into app
docker compose exec db psql -U postgres  # Connect to postgres

# Inspect
docker compose ps                     # Running services
docker compose top                    # Processes in each container
docker stats                          # Resource usage

# Rebuild
docker compose up --build             # Rebuild images
docker compose build --no-cache app   # Force full rebuild

# Clean up
docker compose down                   # Stop and remove containers
docker compose down -v                # Also remove volumes (DESTRUCTIVE)
docker system prune                   # Remove unused images/containers
\`\`\`

### Debugging Network Issues

\`\`\`bash
# Check DNS resolution inside container
docker compose exec app nslookup db

# Check connectivity
docker compose exec app wget -qO- http://api:3000/health

# Inspect network
docker network ls
docker network inspect <project>_default
\`\`\`

## Anti-Patterns

\`\`\`
# BAD: Using docker compose in production without orchestration
# Use Kubernetes, ECS, or Docker Swarm for production multi-container workloads

# BAD: Storing data in containers without volumes
# Containers are ephemeral -- all data lost on restart without volumes

# BAD: Running as root
# Always create and use a non-root user

# BAD: Using :latest tag
# Pin to specific versions for reproducible builds

# BAD: One giant container with all services
# Separate concerns: one process per container

# BAD: Putting secrets in docker-compose.yml
# Use .env files (gitignored) or Docker secrets
\`\`\``,
    sortOrder: -11,
    refs: [
    ]
  },
  {
    id: 'builtin-hook-builder',
    name: 'Hook Builder',
    description: `Creating and developing startup hooks for Claude Code on the web. Use when the user wants to set up a repository for Claude Code on the web, create a SessionStart hook to ensure their project can run tests and linters during web sessions.`,
    instructions: `# Startup Hook Skill for Claude Code on the web

Create SessionStart hooks that install dependencies so tests and linters work in Claude Code on the web sessions.

## Hook Basics

### Input (via stdin)
\`\`\`json
{
  "session_id": "abc123",
  "source": "startup|resume|clear|compact",
  "transcript_path": "/path/to/transcript.jsonl",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "cwd": "/workspace/repo"
}
\`\`\`

### Async Mode
\`\`\`bash
#!/bin/bash
set -euo pipefail

echo '{"async": true, "asyncTimeout": 300000}'

npm install
\`\`\`

The hook runs in background while the session starts. Using async mode reduces latency, but introduces a race condition where the agent loop might depend on something that is being done in the startup hook before it completed.

### Environment Variables

Available environment variables:
- \`$CLAUDE_PROJECT_DIR\` - Repository root path
- \`$CLAUDE_ENV_FILE\` - Path to write environment variables
- \`$CLAUDE_CODE_REMOTE\` - If running in a remote environment (i.e. Claude code on the web)

Use \`$CLAUDE_ENV_FILE\` to persist variables for the session:
\`\`\`bash
echo 'export PYTHONPATH="."' >> "$CLAUDE_ENV_FILE"
\`\`\`

Use \`$CLAUDE_CODE_REMOTE\` to only run a script in a remote env:
\`\`\`bash
if [ "\${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
\`\`\`

## Workflow

Make a todo list for all the tasks in this workflow and work on them one after another

### 1. Analyze Dependencies

Find dependency manifests and analyze them. Examples:
- \`package.json\` / \`package-lock.json\` → npm
- \`pyproject.toml\` / \`requirements.txt\` → pip/Poetry
- \`Cargo.toml\` → cargo
- \`go.mod\` → go
- \`Gemfile\` → bundler

Additionally, read though any documentation (i.e. README.md or similar) to see if you can get additional context on how the environment setup works

### 2. Design Hook

Create a script that installs dependencies.

**Key principles:**
- Don't use async mode in the first iteration. Only switch to it if the user asks for it
- Write the hook only for the web unless user asks otherwise (see $CLAUDE_CODE_REMOTE)
- The container state gets cached after the hook completes, prefer dependency install methods that take advantage of that (i.e. prefer npm install over npm ci)
- Be idempotent (safe to run multiple times)
- Non-interactive (no user input)

### 3. Create Hook File

\`\`\`bash
mkdir -p .claude/hooks
cat > .claude/hooks/session-start.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# Install dependencies here
EOF

chmod +x .claude/hooks/session-start.sh
\`\`\`

### 4. Register in Settings

Add to \`.claude/settings.json\` (create if doesn't exist):
\`\`\`json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"
          }
        ]
      }
    ]
  }
}
\`\`\`

If \`.claude/settings.json\` exists, merge the hooks configuration.

### 5. Validate Hook

Run the hook script directly:

\`\`\`bash
CLAUDE_CODE_REMOTE=true ./.claude/hooks/session-start.sh
\`\`\`

IMPORTANT: Verify dependencies are installed and script completes successfully.

### 6. Validate Linter

IMPORTANT: Figure out what the right command is to run the linters and run it for an example file. No need to lint the whole project. If there are any issues, update the startup script accordingly and re-test.

### 7. Validate Test

IMPORTANT: Figure out what the right command is to run the tests and run it for one test. No need to run the whole test suite. If there are any issues, update the startup script accordingly and re-test.

### 8. Commit

Make a commit with the changes. Do NOT push unless the user explicitly asks.

## Wrap up

We're all done. In your last message to the user, Provide a detailed summary to the user with the format below:

* Summary of the changes made
* Validation results
  1. ✅/‼️ Session hook execution (include details if it failed)
  2. ✅/‼️ linter execution (include details if it failed)
  3. ✅/‼️ test execution (include details if it failed)
* Hook execution mode: Synchronous
  * inform user that hook is running synchronous and the below trade-offs. Let them know that we can change it to async if they prefer faster session startup.
    * Pros: Guarantees dependencies are installed before your session starts, preventing race conditions where Claude might try to run tests or linters before they're ready
    * Cons: Your remote session will only start once the session start hook is completed
* inform user that once they merge the session start hook into their repo's default branch, all future sessions will use it.`,
    sortOrder: -10,
    refs: [
    ]
  },
  {
    id: 'builtin-mcp-builder',
    name: 'MCP Builder',
    description: `Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).`,
    instructions: `# MCP Server Development Guide

## Overview

Create MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. The quality of an MCP server is measured by how well it enables LLMs to accomplish real-world tasks.

---

# Process

## 🚀 High-Level Workflow

Creating a high-quality MCP server involves four main phases:

### Phase 1: Deep Research and Planning

#### 1.1 Understand Modern MCP Design

**API Coverage vs. Workflow Tools:**
Balance comprehensive API endpoint coverage with specialized workflow tools. Workflow tools can be more convenient for specific tasks, while comprehensive coverage gives agents flexibility to compose operations. Performance varies by client—some clients benefit from code execution that combines basic tools, while others work better with higher-level workflows. When uncertain, prioritize comprehensive API coverage.

**Tool Naming and Discoverability:**
Clear, descriptive tool names help agents find the right tools quickly. Use consistent prefixes (e.g., \`github_create_issue\`, \`github_list_repos\`) and action-oriented naming.

**Context Management:**
Agents benefit from concise tool descriptions and the ability to filter/paginate results. Design tools that return focused, relevant data. Some clients support code execution which can help agents filter and process data efficiently.

**Actionable Error Messages:**
Error messages should guide agents toward solutions with specific suggestions and next steps.

#### 1.2 Study MCP Protocol Documentation

**Navigate the MCP specification:**

Start with the sitemap to find relevant pages: \`https://modelcontextprotocol.io/sitemap.xml\`

Then fetch specific pages with \`.md\` suffix for markdown format (e.g., \`https://modelcontextprotocol.io/specification/draft.md\`).

Key pages to review:
- Specification overview and architecture
- Transport mechanisms (streamable HTTP, stdio)
- Tool, resource, and prompt definitions

#### 1.3 Study Framework Documentation

**Recommended stack:**
- **Language**: TypeScript (high-quality SDK support and good compatibility in many execution environments e.g. MCPB. Plus AI models are good at generating TypeScript code, benefiting from its broad usage, static typing and good linting tools)
- **Transport**: Streamable HTTP for remote servers, using stateless JSON (simpler to scale and maintain, as opposed to stateful sessions and streaming responses). stdio for local servers.

**Load framework documentation:**

- **MCP Best Practices**: [📋 View Best Practices](./reference/mcp_best_practices.md) - Core guidelines

**For TypeScript (recommended):**
- **TypeScript SDK**: Use WebFetch to load \`https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md\`
- [⚡ TypeScript Guide](./reference/node_mcp_server.md) - TypeScript patterns and examples

**For Python:**
- **Python SDK**: Use WebFetch to load \`https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md\`
- [🐍 Python Guide](./reference/python_mcp_server.md) - Python patterns and examples

#### 1.4 Plan Your Implementation

**Understand the API:**
Review the service's API documentation to identify key endpoints, authentication requirements, and data models. Use web search and WebFetch as needed.

**Tool Selection:**
Prioritize comprehensive API coverage. List endpoints to implement, starting with the most common operations.

---

### Phase 2: Implementation

#### 2.1 Set Up Project Structure

See language-specific guides for project setup:
- [⚡ TypeScript Guide](./reference/node_mcp_server.md) - Project structure, package.json, tsconfig.json
- [🐍 Python Guide](./reference/python_mcp_server.md) - Module organization, dependencies

#### 2.2 Implement Core Infrastructure

Create shared utilities:
- API client with authentication
- Error handling helpers
- Response formatting (JSON/Markdown)
- Pagination support

#### 2.3 Implement Tools

For each tool:

**Input Schema:**
- Use Zod (TypeScript) or Pydantic (Python)
- Include constraints and clear descriptions
- Add examples in field descriptions

**Output Schema:**
- Define \`outputSchema\` where possible for structured data
- Use \`structuredContent\` in tool responses (TypeScript SDK feature)
- Helps clients understand and process tool outputs

**Tool Description:**
- Concise summary of functionality
- Parameter descriptions
- Return type schema

**Implementation:**
- Async/await for I/O operations
- Proper error handling with actionable messages
- Support pagination where applicable
- Return both text content and structured data when using modern SDKs

**Annotations:**
- \`readOnlyHint\`: true/false
- \`destructiveHint\`: true/false
- \`idempotentHint\`: true/false
- \`openWorldHint\`: true/false

---

### Phase 3: Review and Test

#### 3.1 Code Quality

Review for:
- No duplicated code (DRY principle)
- Consistent error handling
- Full type coverage
- Clear tool descriptions

#### 3.2 Build and Test

**TypeScript:**
- Run \`npm run build\` to verify compilation
- Test with MCP Inspector: \`npx @modelcontextprotocol/inspector\`

**Python:**
- Verify syntax: \`python -m py_compile your_server.py\`
- Test with MCP Inspector

See language-specific guides for detailed testing approaches and quality checklists.

---

### Phase 4: Create Evaluations

After implementing your MCP server, create comprehensive evaluations to test its effectiveness.

**Load [✅ Evaluation Guide](./reference/evaluation.md) for complete evaluation guidelines.**

#### 4.1 Understand Evaluation Purpose

Use evaluations to test whether LLMs can effectively use your MCP server to answer realistic, complex questions.

#### 4.2 Create 10 Evaluation Questions

To create effective evaluations, follow the process outlined in the evaluation guide:

1. **Tool Inspection**: List available tools and understand their capabilities
2. **Content Exploration**: Use READ-ONLY operations to explore available data
3. **Question Generation**: Create 10 complex, realistic questions
4. **Answer Verification**: Solve each question yourself to verify answers

#### 4.3 Evaluation Requirements

Ensure each question is:
- **Independent**: Not dependent on other questions
- **Read-only**: Only non-destructive operations required
- **Complex**: Requiring multiple tool calls and deep exploration
- **Realistic**: Based on real use cases humans would care about
- **Verifiable**: Single, clear answer that can be verified by string comparison
- **Stable**: Answer won't change over time

#### 4.4 Output Format

Create an XML file with this structure:

\`\`\`xml
<evaluation>
  <qa_pair>
    <question>Find discussions about AI model launches with animal codenames. One model needed a specific safety designation that uses the format ASL-X. What number X was being determined for the model named after a spotted wild cat?</question>
    <answer>3</answer>
  </qa_pair>
<!-- More qa_pairs... -->
</evaluation>
\`\`\`

---

# Reference Files

## 📚 Documentation Library

Load these resources as needed during development:

### Core MCP Documentation (Load First)
- **MCP Protocol**: Start with sitemap at \`https://modelcontextprotocol.io/sitemap.xml\`, then fetch specific pages with \`.md\` suffix
- [📋 MCP Best Practices](./reference/mcp_best_practices.md) - Universal MCP guidelines including:
  - Server and tool naming conventions
  - Response format guidelines (JSON vs Markdown)
  - Pagination best practices
  - Transport selection (streamable HTTP vs stdio)
  - Security and error handling standards

### SDK Documentation (Load During Phase 1/2)
- **Python SDK**: Fetch from \`https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md\`
- **TypeScript SDK**: Fetch from \`https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md\`

### Language-Specific Implementation Guides (Load During Phase 2)
- [🐍 Python Implementation Guide](./reference/python_mcp_server.md) - Complete Python/FastMCP guide with:
  - Server initialization patterns
  - Pydantic model examples
  - Tool registration with \`@mcp.tool\`
  - Complete working examples
  - Quality checklist

- [⚡ TypeScript Implementation Guide](./reference/node_mcp_server.md) - Complete TypeScript guide with:
  - Project structure
  - Zod schema patterns
  - Tool registration with \`server.registerTool\`
  - Complete working examples
  - Quality checklist

### Evaluation Guide (Load During Phase 4)
- [✅ Evaluation Guide](./reference/evaluation.md) - Complete evaluation creation guide with:
  - Question creation guidelines
  - Answer verification strategies
  - XML format specifications
  - Example questions and answers
  - Running an evaluation with the provided scripts`,
    sortOrder: -9,
    refs: [
      { id: 'builtin-mcp-builder-ref-0', name: 'reference/evaluation.md', content: `# MCP Server Evaluation Guide

## Overview

This document provides guidance on creating comprehensive evaluations for MCP servers. Evaluations test whether LLMs can effectively use your MCP server to answer realistic, complex questions using only the tools provided.

---

## Quick Reference

### Evaluation Requirements
- Create 10 human-readable questions
- Questions must be READ-ONLY, INDEPENDENT, NON-DESTRUCTIVE
- Each question requires multiple tool calls (potentially dozens)
- Answers must be single, verifiable values
- Answers must be STABLE (won't change over time)

### Output Format
\`\`\`xml
<evaluation>
   <qa_pair>
      <question>Your question here</question>
      <answer>Single verifiable answer</answer>
   </qa_pair>
</evaluation>
\`\`\`

---

## Purpose of Evaluations

The measure of quality of an MCP server is NOT how well or comprehensively the server implements tools, but how well these implementations (input/output schemas, docstrings/descriptions, functionality) enable LLMs with no other context and access ONLY to the MCP servers to answer realistic and difficult questions.

## Evaluation Overview

Create 10 human-readable questions requiring ONLY READ-ONLY, INDEPENDENT, NON-DESTRUCTIVE, and IDEMPOTENT operations to answer. Each question should be:
- Realistic
- Clear and concise
- Unambiguous
- Complex, requiring potentially dozens of tool calls or steps
- Answerable with a single, verifiable value that you identify in advance

## Question Guidelines

### Core Requirements

1. **Questions MUST be independent**
   - Each question should NOT depend on the answer to any other question
   - Should not assume prior write operations from processing another question

2. **Questions MUST require ONLY NON-DESTRUCTIVE AND IDEMPOTENT tool use**
   - Should not instruct or require modifying state to arrive at the correct answer

3. **Questions must be REALISTIC, CLEAR, CONCISE, and COMPLEX**
   - Must require another LLM to use multiple (potentially dozens of) tools or steps to answer

### Complexity and Depth

4. **Questions must require deep exploration**
   - Consider multi-hop questions requiring multiple sub-questions and sequential tool calls
   - Each step should benefit from information found in previous questions

5. **Questions may require extensive paging**
   - May need paging through multiple pages of results
   - May require querying old data (1-2 years out-of-date) to find niche information
   - The questions must be DIFFICULT

6. **Questions must require deep understanding**
   - Rather than surface-level knowledge
   - May pose complex ideas as True/False questions requiring evidence
   - May use multiple-choice format where LLM must search different hypotheses

7. **Questions must not be solvable with straightforward keyword search**
   - Do not include specific keywords from the target content
   - Use synonyms, related concepts, or paraphrases
   - Require multiple searches, analyzing multiple related items, extracting context, then deriving the answer

### Tool Testing

8. **Questions should stress-test tool return values**
   - May elicit tools returning large JSON objects or lists, overwhelming the LLM
   - Should require understanding multiple modalities of data:
     - IDs and names
     - Timestamps and datetimes (months, days, years, seconds)
     - File IDs, names, extensions, and mimetypes
     - URLs, GIDs, etc.
   - Should probe the tool's ability to return all useful forms of data

9. **Questions should MOSTLY reflect real human use cases**
   - The kinds of information retrieval tasks that HUMANS assisted by an LLM would care about

10. **Questions may require dozens of tool calls**
    - This challenges LLMs with limited context
    - Encourages MCP server tools to reduce information returned

11. **Include ambiguous questions**
    - May be ambiguous OR require difficult decisions on which tools to call
    - Force the LLM to potentially make mistakes or misinterpret
    - Ensure that despite AMBIGUITY, there is STILL A SINGLE VERIFIABLE ANSWER

### Stability

12. **Questions must be designed so the answer DOES NOT CHANGE**
    - Do not ask questions that rely on "current state" which is dynamic
    - For example, do not count:
      - Number of reactions to a post
      - Number of replies to a thread
      - Number of members in a channel

13. **DO NOT let the MCP server RESTRICT the kinds of questions you create**
    - Create challenging and complex questions
    - Some may not be solvable with the available MCP server tools
    - Questions may require specific output formats (datetime vs. epoch time, JSON vs. MARKDOWN)
    - Questions may require dozens of tool calls to complete

## Answer Guidelines

### Verification

1. **Answers must be VERIFIABLE via direct string comparison**
   - If the answer can be re-written in many formats, clearly specify the output format in the QUESTION
   - Examples: "Use YYYY/MM/DD.", "Respond True or False.", "Answer A, B, C, or D and nothing else."
   - Answer should be a single VERIFIABLE value such as:
     - User ID, user name, display name, first name, last name
     - Channel ID, channel name
     - Message ID, string
     - URL, title
     - Numerical quantity
     - Timestamp, datetime
     - Boolean (for True/False questions)
     - Email address, phone number
     - File ID, file name, file extension
     - Multiple choice answer
   - Answers must not require special formatting or complex, structured output
   - Answer will be verified using DIRECT STRING COMPARISON

### Readability

2. **Answers should generally prefer HUMAN-READABLE formats**
   - Examples: names, first name, last name, datetime, file name, message string, URL, yes/no, true/false, a/b/c/d
   - Rather than opaque IDs (though IDs are acceptable)
   - The VAST MAJORITY of answers should be human-readable

### Stability

3. **Answers must be STABLE/STATIONARY**
   - Look at old content (e.g., conversations that have ended, projects that have launched, questions answered)
   - Create QUESTIONS based on "closed" concepts that will always return the same answer
   - Questions may ask to consider a fixed time window to insulate from non-stationary answers
   - Rely on context UNLIKELY to change
   - Example: if finding a paper name, be SPECIFIC enough so answer is not confused with papers published later

4. **Answers must be CLEAR and UNAMBIGUOUS**
   - Questions must be designed so there is a single, clear answer
   - Answer can be derived from using the MCP server tools

### Diversity

5. **Answers must be DIVERSE**
   - Answer should be a single VERIFIABLE value in diverse modalities and formats
   - User concept: user ID, user name, display name, first name, last name, email address, phone number
   - Channel concept: channel ID, channel name, channel topic
   - Message concept: message ID, message string, timestamp, month, day, year

6. **Answers must NOT be complex structures**
   - Not a list of values
   - Not a complex object
   - Not a list of IDs or strings
   - Not natural language text
   - UNLESS the answer can be straightforwardly verified using DIRECT STRING COMPARISON
   - And can be realistically reproduced
   - It should be unlikely that an LLM would return the same list in any other order or format

## Evaluation Process

### Step 1: Documentation Inspection

Read the documentation of the target API to understand:
- Available endpoints and functionality
- If ambiguity exists, fetch additional information from the web
- Parallelize this step AS MUCH AS POSSIBLE
- Ensure each subagent is ONLY examining documentation from the file system or on the web

### Step 2: Tool Inspection

List the tools available in the MCP server:
- Inspect the MCP server directly
- Understand input/output schemas, docstrings, and descriptions
- WITHOUT calling the tools themselves at this stage

### Step 3: Developing Understanding

Repeat steps 1 & 2 until you have a good understanding:
- Iterate multiple times
- Think about the kinds of tasks you want to create
- Refine your understanding
- At NO stage should you READ the code of the MCP server implementation itself
- Use your intuition and understanding to create reasonable, realistic, but VERY challenging tasks

### Step 4: Read-Only Content Inspection

After understanding the API and tools, USE the MCP server tools:
- Inspect content using READ-ONLY and NON-DESTRUCTIVE operations ONLY
- Goal: identify specific content (e.g., users, channels, messages, projects, tasks) for creating realistic questions
- Should NOT call any tools that modify state
- Will NOT read the code of the MCP server implementation itself
- Parallelize this step with individual sub-agents pursuing independent explorations
- Ensure each subagent is only performing READ-ONLY, NON-DESTRUCTIVE, and IDEMPOTENT operations
- BE CAREFUL: SOME TOOLS may return LOTS OF DATA which would cause you to run out of CONTEXT
- Make INCREMENTAL, SMALL, AND TARGETED tool calls for exploration
- In all tool call requests, use the \`limit\` parameter to limit results (<10)
- Use pagination

### Step 5: Task Generation

After inspecting the content, create 10 human-readable questions:
- An LLM should be able to answer these with the MCP server
- Follow all question and answer guidelines above

## Output Format

Each QA pair consists of a question and an answer. The output should be an XML file with this structure:

\`\`\`xml
<evaluation>
   <qa_pair>
      <question>Find the project created in Q2 2024 with the highest number of completed tasks. What is the project name?</question>
      <answer>Website Redesign</answer>
   </qa_pair>
   <qa_pair>
      <question>Search for issues labeled as "bug" that were closed in March 2024. Which user closed the most issues? Provide their username.</question>
      <answer>sarah_dev</answer>
   </qa_pair>
   <qa_pair>
      <question>Look for pull requests that modified files in the /api directory and were merged between January 1 and January 31, 2024. How many different contributors worked on these PRs?</question>
      <answer>7</answer>
   </qa_pair>
   <qa_pair>
      <question>Find the repository with the most stars that was created before 2023. What is the repository name?</question>
      <answer>data-pipeline</answer>
   </qa_pair>
</evaluation>
\`\`\`

## Evaluation Examples

### Good Questions

**Example 1: Multi-hop question requiring deep exploration (GitHub MCP)**
\`\`\`xml
<qa_pair>
   <question>Find the repository that was archived in Q3 2023 and had previously been the most forked project in the organization. What was the primary programming language used in that repository?</question>
   <answer>Python</answer>
</qa_pair>
\`\`\`

This question is good because:
- Requires multiple searches to find archived repositories
- Needs to identify which had the most forks before archival
- Requires examining repository details for the language
- Answer is a simple, verifiable value
- Based on historical (closed) data that won't change

**Example 2: Requires understanding context without keyword matching (Project Management MCP)**
\`\`\`xml
<qa_pair>
   <question>Locate the initiative focused on improving customer onboarding that was completed in late 2023. The project lead created a retrospective document after completion. What was the lead's role title at that time?</question>
   <answer>Product Manager</answer>
</qa_pair>
\`\`\`

This question is good because:
- Doesn't use specific project name ("initiative focused on improving customer onboarding")
- Requires finding completed projects from specific timeframe
- Needs to identify the project lead and their role
- Requires understanding context from retrospective documents
- Answer is human-readable and stable
- Based on completed work (won't change)

**Example 3: Complex aggregation requiring multiple steps (Issue Tracker MCP)**
\`\`\`xml
<qa_pair>
   <question>Among all bugs reported in January 2024 that were marked as critical priority, which assignee resolved the highest percentage of their assigned bugs within 48 hours? Provide the assignee's username.</question>
   <answer>alex_eng</answer>
</qa_pair>
\`\`\`

This question is good because:
- Requires filtering bugs by date, priority, and status
- Needs to group by assignee and calculate resolution rates
- Requires understanding timestamps to determine 48-hour windows
- Tests pagination (potentially many bugs to process)
- Answer is a single username
- Based on historical data from specific time period

**Example 4: Requires synthesis across multiple data types (CRM MCP)**
\`\`\`xml
<qa_pair>
   <question>Find the account that upgraded from the Starter to Enterprise plan in Q4 2023 and had the highest annual contract value. What industry does this account operate in?</question>
   <answer>Healthcare</answer>
</qa_pair>
\`\`\`

This question is good because:
- Requires understanding subscription tier changes
- Needs to identify upgrade events in specific timeframe
- Requires comparing contract values
- Must access account industry information
- Answer is simple and verifiable
- Based on completed historical transactions

### Poor Questions

**Example 1: Answer changes over time**
\`\`\`xml
<qa_pair>
   <question>How many open issues are currently assigned to the engineering team?</question>
   <answer>47</answer>
</qa_pair>
\`\`\`

This question is poor because:
- The answer will change as issues are created, closed, or reassigned
- Not based on stable/stationary data
- Relies on "current state" which is dynamic

**Example 2: Too easy with keyword search**
\`\`\`xml
<qa_pair>
   <question>Find the pull request with title "Add authentication feature" and tell me who created it.</question>
   <answer>developer123</answer>
</qa_pair>
\`\`\`

This question is poor because:
- Can be solved with a straightforward keyword search for exact title
- Doesn't require deep exploration or understanding
- No synthesis or analysis needed

**Example 3: Ambiguous answer format**
\`\`\`xml
<qa_pair>
   <question>List all the repositories that have Python as their primary language.</question>
   <answer>repo1, repo2, repo3, data-pipeline, ml-tools</answer>
</qa_pair>
\`\`\`

This question is poor because:
- Answer is a list that could be returned in any order
- Difficult to verify with direct string comparison
- LLM might format differently (JSON array, comma-separated, newline-separated)
- Better to ask for a specific aggregate (count) or superlative (most stars)

## Verification Process

After creating evaluations:

1. **Examine the XML file** to understand the schema
2. **Load each task instruction** and in parallel using the MCP server and tools, identify the correct answer by attempting to solve the task YOURSELF
3. **Flag any operations** that require WRITE or DESTRUCTIVE operations
4. **Accumulate all CORRECT answers** and replace any incorrect answers in the document
5. **Remove any \`<qa_pair>\`** that require WRITE or DESTRUCTIVE operations

Remember to parallelize solving tasks to avoid running out of context, then accumulate all answers and make changes to the file at the end.

## Tips for Creating Quality Evaluations

1. **Think Hard and Plan Ahead** before generating tasks
2. **Parallelize Where Opportunity Arises** to speed up the process and manage context
3. **Focus on Realistic Use Cases** that humans would actually want to accomplish
4. **Create Challenging Questions** that test the limits of the MCP server's capabilities
5. **Ensure Stability** by using historical data and closed concepts
6. **Verify Answers** by solving the questions yourself using the MCP server tools
7. **Iterate and Refine** based on what you learn during the process

---

# Running Evaluations

After creating your evaluation file, you can use the provided evaluation harness to test your MCP server.

## Setup

1. **Install Dependencies**

   \`\`\`bash
   pip install -r scripts/requirements.txt
   \`\`\`

   Or install manually:
   \`\`\`bash
   pip install anthropic mcp
   \`\`\`

2. **Set API Key**

   \`\`\`bash
   export ANTHROPIC_API_KEY=your_api_key_here
   \`\`\`

## Evaluation File Format

Evaluation files use XML format with \`<qa_pair>\` elements:

\`\`\`xml
<evaluation>
   <qa_pair>
      <question>Find the project created in Q2 2024 with the highest number of completed tasks. What is the project name?</question>
      <answer>Website Redesign</answer>
   </qa_pair>
   <qa_pair>
      <question>Search for issues labeled as "bug" that were closed in March 2024. Which user closed the most issues? Provide their username.</question>
      <answer>sarah_dev</answer>
   </qa_pair>
</evaluation>
\`\`\`

## Running Evaluations

The evaluation script (\`scripts/evaluation.py\`) supports three transport types:

**Important:**
- **stdio transport**: The evaluation script automatically launches and manages the MCP server process for you. Do not run the server manually.
- **sse/http transports**: You must start the MCP server separately before running the evaluation. The script connects to the already-running server at the specified URL.

### 1. Local STDIO Server

For locally-run MCP servers (script launches the server automatically):

\`\`\`bash
python scripts/evaluation.py \\
  -t stdio \\
  -c python \\
  -a my_mcp_server.py \\
  evaluation.xml
\`\`\`

With environment variables:
\`\`\`bash
python scripts/evaluation.py \\
  -t stdio \\
  -c python \\
  -a my_mcp_server.py \\
  -e API_KEY=abc123 \\
  -e DEBUG=true \\
  evaluation.xml
\`\`\`

### 2. Server-Sent Events (SSE)

For SSE-based MCP servers (you must start the server first):

\`\`\`bash
python scripts/evaluation.py \\
  -t sse \\
  -u https://example.com/mcp \\
  -H "Authorization: Bearer token123" \\
  -H "X-Custom-Header: value" \\
  evaluation.xml
\`\`\`

### 3. HTTP (Streamable HTTP)

For HTTP-based MCP servers (you must start the server first):

\`\`\`bash
python scripts/evaluation.py \\
  -t http \\
  -u https://example.com/mcp \\
  -H "Authorization: Bearer token123" \\
  evaluation.xml
\`\`\`

## Command-Line Options

\`\`\`
usage: evaluation.py [-h] [-t {stdio,sse,http}] [-m MODEL] [-c COMMAND]
                     [-a ARGS [ARGS ...]] [-e ENV [ENV ...]] [-u URL]
                     [-H HEADERS [HEADERS ...]] [-o OUTPUT]
                     eval_file

positional arguments:
  eval_file             Path to evaluation XML file

optional arguments:
  -h, --help            Show help message
  -t, --transport       Transport type: stdio, sse, or http (default: stdio)
  -m, --model           Claude model to use (default: claude-3-7-sonnet-20250219)
  -o, --output          Output file for report (default: print to stdout)

stdio options:
  -c, --command         Command to run MCP server (e.g., python, node)
  -a, --args            Arguments for the command (e.g., server.py)
  -e, --env             Environment variables in KEY=VALUE format

sse/http options:
  -u, --url             MCP server URL
  -H, --header          HTTP headers in 'Key: Value' format
\`\`\`

## Output

The evaluation script generates a detailed report including:

- **Summary Statistics**:
  - Accuracy (correct/total)
  - Average task duration
  - Average tool calls per task
  - Total tool calls

- **Per-Task Results**:
  - Prompt and expected response
  - Actual response from the agent
  - Whether the answer was correct (✅/❌)
  - Duration and tool call details
  - Agent's summary of its approach
  - Agent's feedback on the tools

### Save Report to File

\`\`\`bash
python scripts/evaluation.py \\
  -t stdio \\
  -c python \\
  -a my_server.py \\
  -o evaluation_report.md \\
  evaluation.xml
\`\`\`

## Complete Example Workflow

Here's a complete example of creating and running an evaluation:

1. **Create your evaluation file** (\`my_evaluation.xml\`):

\`\`\`xml
<evaluation>
   <qa_pair>
      <question>Find the user who created the most issues in January 2024. What is their username?</question>
      <answer>alice_developer</answer>
   </qa_pair>
   <qa_pair>
      <question>Among all pull requests merged in Q1 2024, which repository had the highest number? Provide the repository name.</question>
      <answer>backend-api</answer>
   </qa_pair>
   <qa_pair>
      <question>Find the project that was completed in December 2023 and had the longest duration from start to finish. How many days did it take?</question>
      <answer>127</answer>
   </qa_pair>
</evaluation>
\`\`\`

2. **Install dependencies**:

\`\`\`bash
pip install -r scripts/requirements.txt
export ANTHROPIC_API_KEY=your_api_key
\`\`\`

3. **Run evaluation**:

\`\`\`bash
python scripts/evaluation.py \\
  -t stdio \\
  -c python \\
  -a github_mcp_server.py \\
  -e GITHUB_TOKEN=ghp_xxx \\
  -o github_eval_report.md \\
  my_evaluation.xml
\`\`\`

4. **Review the report** in \`github_eval_report.md\` to:
   - See which questions passed/failed
   - Read the agent's feedback on your tools
   - Identify areas for improvement
   - Iterate on your MCP server design

## Troubleshooting

### Connection Errors

If you get connection errors:
- **STDIO**: Verify the command and arguments are correct
- **SSE/HTTP**: Check the URL is accessible and headers are correct
- Ensure any required API keys are set in environment variables or headers

### Low Accuracy

If many evaluations fail:
- Review the agent's feedback for each task
- Check if tool descriptions are clear and comprehensive
- Verify input parameters are well-documented
- Consider whether tools return too much or too little data
- Ensure error messages are actionable

### Timeout Issues

If tasks are timing out:
- Use a more capable model (e.g., \`claude-3-7-sonnet-20250219\`)
- Check if tools are returning too much data
- Verify pagination is working correctly
- Consider simplifying complex questions`, sortOrder: 0 },
      { id: 'builtin-mcp-builder-ref-1', name: 'reference/mcp_best_practices.md', content: `# MCP Server Best Practices

## Quick Reference

### Server Naming
- **Python**: \`{service}_mcp\` (e.g., \`slack_mcp\`)
- **Node/TypeScript**: \`{service}-mcp-server\` (e.g., \`slack-mcp-server\`)

### Tool Naming
- Use snake_case with service prefix
- Format: \`{service}_{action}_{resource}\`
- Example: \`slack_send_message\`, \`github_create_issue\`

### Response Formats
- Support both JSON and Markdown formats
- JSON for programmatic processing
- Markdown for human readability

### Pagination
- Always respect \`limit\` parameter
- Return \`has_more\`, \`next_offset\`, \`total_count\`
- Default to 20-50 items

### Transport
- **Streamable HTTP**: For remote servers, multi-client scenarios
- **stdio**: For local integrations, command-line tools
- Avoid SSE (deprecated in favor of streamable HTTP)

---

## Server Naming Conventions

Follow these standardized naming patterns:

**Python**: Use format \`{service}_mcp\` (lowercase with underscores)
- Examples: \`slack_mcp\`, \`github_mcp\`, \`jira_mcp\`

**Node/TypeScript**: Use format \`{service}-mcp-server\` (lowercase with hyphens)
- Examples: \`slack-mcp-server\`, \`github-mcp-server\`, \`jira-mcp-server\`

The name should be general, descriptive of the service being integrated, easy to infer from the task description, and without version numbers.

---

## Tool Naming and Design

### Tool Naming

1. **Use snake_case**: \`search_users\`, \`create_project\`, \`get_channel_info\`
2. **Include service prefix**: Anticipate that your MCP server may be used alongside other MCP servers
   - Use \`slack_send_message\` instead of just \`send_message\`
   - Use \`github_create_issue\` instead of just \`create_issue\`
3. **Be action-oriented**: Start with verbs (get, list, search, create, etc.)
4. **Be specific**: Avoid generic names that could conflict with other servers

### Tool Design

- Tool descriptions must narrowly and unambiguously describe functionality
- Descriptions must precisely match actual functionality
- Provide tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Keep tool operations focused and atomic

---

## Response Formats

All tools that return data should support multiple formats:

### JSON Format (\`response_format="json"\`)
- Machine-readable structured data
- Include all available fields and metadata
- Consistent field names and types
- Use for programmatic processing

### Markdown Format (\`response_format="markdown"\`, typically default)
- Human-readable formatted text
- Use headers, lists, and formatting for clarity
- Convert timestamps to human-readable format
- Show display names with IDs in parentheses
- Omit verbose metadata

---

## Pagination

For tools that list resources:

- **Always respect the \`limit\` parameter**
- **Implement pagination**: Use \`offset\` or cursor-based pagination
- **Return pagination metadata**: Include \`has_more\`, \`next_offset\`/\`next_cursor\`, \`total_count\`
- **Never load all results into memory**: Especially important for large datasets
- **Default to reasonable limits**: 20-50 items is typical

Example pagination response:
\`\`\`json
{
  "total": 150,
  "count": 20,
  "offset": 0,
  "items": [...],
  "has_more": true,
  "next_offset": 20
}
\`\`\`

---

## Transport Options

### Streamable HTTP

**Best for**: Remote servers, web services, multi-client scenarios

**Characteristics**:
- Bidirectional communication over HTTP
- Supports multiple simultaneous clients
- Can be deployed as a web service
- Enables server-to-client notifications

**Use when**:
- Serving multiple clients simultaneously
- Deploying as a cloud service
- Integration with web applications

### stdio

**Best for**: Local integrations, command-line tools

**Characteristics**:
- Standard input/output stream communication
- Simple setup, no network configuration needed
- Runs as a subprocess of the client

**Use when**:
- Building tools for local development environments
- Integrating with desktop applications
- Single-user, single-session scenarios

**Note**: stdio servers should NOT log to stdout (use stderr for logging)

### Transport Selection

| Criterion | stdio | Streamable HTTP |
|-----------|-------|-----------------|
| **Deployment** | Local | Remote |
| **Clients** | Single | Multiple |
| **Complexity** | Low | Medium |
| **Real-time** | No | Yes |

---

## Security Best Practices

### Authentication and Authorization

**OAuth 2.1**:
- Use secure OAuth 2.1 with certificates from recognized authorities
- Validate access tokens before processing requests
- Only accept tokens specifically intended for your server

**API Keys**:
- Store API keys in environment variables, never in code
- Validate keys on server startup
- Provide clear error messages when authentication fails

### Input Validation

- Sanitize file paths to prevent directory traversal
- Validate URLs and external identifiers
- Check parameter sizes and ranges
- Prevent command injection in system calls
- Use schema validation (Pydantic/Zod) for all inputs

### Error Handling

- Don't expose internal errors to clients
- Log security-relevant errors server-side
- Provide helpful but not revealing error messages
- Clean up resources after errors

### DNS Rebinding Protection

For streamable HTTP servers running locally:
- Enable DNS rebinding protection
- Validate the \`Origin\` header on all incoming connections
- Bind to \`127.0.0.1\` rather than \`0.0.0.0\`

---

## Tool Annotations

Provide annotations to help clients understand tool behavior:

| Annotation | Type | Default | Description |
|-----------|------|---------|-------------|
| \`readOnlyHint\` | boolean | false | Tool does not modify its environment |
| \`destructiveHint\` | boolean | true | Tool may perform destructive updates |
| \`idempotentHint\` | boolean | false | Repeated calls with same args have no additional effect |
| \`openWorldHint\` | boolean | true | Tool interacts with external entities |

**Important**: Annotations are hints, not security guarantees. Clients should not make security-critical decisions based solely on annotations.

---

## Error Handling

- Use standard JSON-RPC error codes
- Report tool errors within result objects (not protocol-level errors)
- Provide helpful, specific error messages with suggested next steps
- Don't expose internal implementation details
- Clean up resources properly on errors

Example error handling:
\`\`\`typescript
try {
  const result = performOperation();
  return { content: [{ type: "text", text: result }] };
} catch (error) {
  return {
    isError: true,
    content: [{
      type: "text",
      text: \`Error: \${error.message}. Try using filter='active_only' to reduce results.\`
    }]
  };
}
\`\`\`

---

## Testing Requirements

Comprehensive testing should cover:

- **Functional testing**: Verify correct execution with valid/invalid inputs
- **Integration testing**: Test interaction with external systems
- **Security testing**: Validate auth, input sanitization, rate limiting
- **Performance testing**: Check behavior under load, timeouts
- **Error handling**: Ensure proper error reporting and cleanup

---

## Documentation Requirements

- Provide clear documentation of all tools and capabilities
- Include working examples (at least 3 per major feature)
- Document security considerations
- Specify required permissions and access levels
- Document rate limits and performance characteristics
`, sortOrder: 1 },
      { id: 'builtin-mcp-builder-ref-2', name: 'reference/node_mcp_server.md', content: `# Node/TypeScript MCP Server Implementation Guide

## Overview

This document provides Node/TypeScript-specific best practices and examples for implementing MCP servers using the MCP TypeScript SDK. It covers project structure, server setup, tool registration patterns, input validation with Zod, error handling, and complete working examples.

---

## Quick Reference

### Key Imports
\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";
\`\`\`

### Server Initialization
\`\`\`typescript
const server = new McpServer({
  name: "service-mcp-server",
  version: "1.0.0"
});
\`\`\`

### Tool Registration Pattern
\`\`\`typescript
server.registerTool(
  "tool_name",
  {
    title: "Tool Display Name",
    description: "What the tool does",
    inputSchema: { param: z.string() },
    outputSchema: { result: z.string() }
  },
  async ({ param }) => {
    const output = { result: \`Processed: \${param}\` };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output // Modern pattern for structured data
    };
  }
);
\`\`\`

---

## MCP TypeScript SDK

The official MCP TypeScript SDK provides:
- \`McpServer\` class for server initialization
- \`registerTool\` method for tool registration
- Zod schema integration for runtime input validation
- Type-safe tool handler implementations

**IMPORTANT - Use Modern APIs Only:**
- **DO use**: \`server.registerTool()\`, \`server.registerResource()\`, \`server.registerPrompt()\`
- **DO NOT use**: Old deprecated APIs such as \`server.tool()\`, \`server.setRequestHandler(ListToolsRequestSchema, ...)\`, or manual handler registration
- The \`register*\` methods provide better type safety, automatic schema handling, and are the recommended approach

See the MCP SDK documentation in the references for complete details.

## Server Naming Convention

Node/TypeScript MCP servers must follow this naming pattern:
- **Format**: \`{service}-mcp-server\` (lowercase with hyphens)
- **Examples**: \`github-mcp-server\`, \`jira-mcp-server\`, \`stripe-mcp-server\`

The name should be:
- General (not tied to specific features)
- Descriptive of the service/API being integrated
- Easy to infer from the task description
- Without version numbers or dates

## Project Structure

Create the following structure for Node/TypeScript MCP servers:

\`\`\`
{service}-mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts          # Main entry point with McpServer initialization
│   ├── types.ts          # TypeScript type definitions and interfaces
│   ├── tools/            # Tool implementations (one file per domain)
│   ├── services/         # API clients and shared utilities
│   ├── schemas/          # Zod validation schemas
│   └── constants.ts      # Shared constants (API_URL, CHARACTER_LIMIT, etc.)
└── dist/                 # Built JavaScript files (entry point: dist/index.js)
\`\`\`

## Tool Implementation

### Tool Naming

Use snake_case for tool names (e.g., "search_users", "create_project", "get_channel_info") with clear, action-oriented names.

**Avoid Naming Conflicts**: Include the service context to prevent overlaps:
- Use "slack_send_message" instead of just "send_message"
- Use "github_create_issue" instead of just "create_issue"
- Use "asana_list_tasks" instead of just "list_tasks"

### Tool Structure

Tools are registered using the \`registerTool\` method with the following requirements:
- Use Zod schemas for runtime input validation and type safety
- The \`description\` field must be explicitly provided - JSDoc comments are NOT automatically extracted
- Explicitly provide \`title\`, \`description\`, \`inputSchema\`, and \`annotations\`
- The \`inputSchema\` must be a Zod schema object (not a JSON schema)
- Type all parameters and return values explicitly

\`\`\`typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "example-mcp",
  version: "1.0.0"
});

// Zod schema for input validation
const UserSearchInputSchema = z.object({
  query: z.string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search string to match against names/emails"),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

// Type definition from Zod schema
type UserSearchInput = z.infer<typeof UserSearchInputSchema>;

server.registerTool(
  "example_search_users",
  {
    title: "Search Example Users",
    description: \`Search for users in the Example system by name, email, or team.

This tool searches across all user profiles in the Example platform, supporting partial matches and various search filters. It does NOT create or modify users, only searches existing ones.

Args:
  - query (string): Search string to match against names/emails
  - limit (number): Maximum results to return, between 1-100 (default: 20)
  - offset (number): Number of results to skip for pagination (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "total": number,           // Total number of matches found
    "count": number,           // Number of results in this response
    "offset": number,          // Current pagination offset
    "users": [
      {
        "id": string,          // User ID (e.g., "U123456789")
        "name": string,        // Full name (e.g., "John Doe")
        "email": string,       // Email address
        "team": string,        // Team name (optional)
        "active": boolean      // Whether user is active
      }
    ],
    "has_more": boolean,       // Whether more results are available
    "next_offset": number      // Offset for next page (if has_more is true)
  }

Examples:
  - Use when: "Find all marketing team members" -> params with query="team:marketing"
  - Use when: "Search for John's account" -> params with query="john"
  - Don't use when: You need to create a user (use example_create_user instead)

Error Handling:
  - Returns "Error: Rate limit exceeded" if too many requests (429 status)
  - Returns "No users found matching '<query>'" if search returns empty\`,
    inputSchema: UserSearchInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: UserSearchInput) => {
    try {
      // Input validation is handled by Zod schema
      // Make API request using validated parameters
      const data = await makeApiRequest<any>(
        "users/search",
        "GET",
        undefined,
        {
          q: params.query,
          limit: params.limit,
          offset: params.offset
        }
      );

      const users = data.users || [];
      const total = data.total || 0;

      if (!users.length) {
        return {
          content: [{
            type: "text",
            text: \`No users found matching '\${params.query}'\`
          }]
        };
      }

      // Prepare structured output
      const output = {
        total,
        count: users.length,
        offset: params.offset,
        users: users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          ...(user.team ? { team: user.team } : {}),
          active: user.active ?? true
        })),
        has_more: total > params.offset + users.length,
        ...(total > params.offset + users.length ? {
          next_offset: params.offset + users.length
        } : {})
      };

      // Format text representation based on requested format
      let textContent: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        const lines = [\`# User Search Results: '\${params.query}'\`, "",
          \`Found \${total} users (showing \${users.length})\`, ""];
        for (const user of users) {
          lines.push(\`## \${user.name} (\${user.id})\`);
          lines.push(\`- **Email**: \${user.email}\`);
          if (user.team) lines.push(\`- **Team**: \${user.team}\`);
          lines.push("");
        }
        textContent = lines.join("\\n");
      } else {
        textContent = JSON.stringify(output, null, 2);
      }

      return {
        content: [{ type: "text", text: textContent }],
        structuredContent: output // Modern pattern for structured data
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: handleApiError(error)
        }]
      };
    }
  }
);
\`\`\`

## Zod Schemas for Input Validation

Zod provides runtime type validation:

\`\`\`typescript
import { z } from "zod";

// Basic schema with validation
const CreateUserSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters"),
  email: z.string()
    .email("Invalid email format"),
  age: z.number()
    .int("Age must be a whole number")
    .min(0, "Age cannot be negative")
    .max(150, "Age cannot be greater than 150")
}).strict();  // Use .strict() to forbid extra fields

// Enums
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

const SearchSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format")
});

// Optional fields with defaults
const PaginationSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip")
});
\`\`\`

## Response Format Options

Support multiple output formats for flexibility:

\`\`\`typescript
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

const inputSchema = z.object({
  query: z.string(),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
});
\`\`\`

**Markdown format**:
- Use headers, lists, and formatting for clarity
- Convert timestamps to human-readable format
- Show display names with IDs in parentheses
- Omit verbose metadata
- Group related information logically

**JSON format**:
- Return complete, structured data suitable for programmatic processing
- Include all available fields and metadata
- Use consistent field names and types

## Pagination Implementation

For tools that list resources:

\`\`\`typescript
const ListSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

async function listItems(params: z.infer<typeof ListSchema>) {
  const data = await apiRequest(params.limit, params.offset);

  const response = {
    total: data.total,
    count: data.items.length,
    offset: params.offset,
    items: data.items,
    has_more: data.total > params.offset + data.items.length,
    next_offset: data.total > params.offset + data.items.length
      ? params.offset + data.items.length
      : undefined
  };

  return JSON.stringify(response, null, 2);
}
\`\`\`

## Character Limits and Truncation

Add a CHARACTER_LIMIT constant to prevent overwhelming responses:

\`\`\`typescript
// At module level in constants.ts
export const CHARACTER_LIMIT = 25000;  // Maximum response size in characters

async function searchTool(params: SearchInput) {
  let result = generateResponse(data);

  // Check character limit and truncate if needed
  if (result.length > CHARACTER_LIMIT) {
    const truncatedData = data.slice(0, Math.max(1, data.length / 2));
    response.data = truncatedData;
    response.truncated = true;
    response.truncation_message =
      \`Response truncated from \${data.length} to \${truncatedData.length} items. \` +
      \`Use 'offset' parameter or add filters to see more results.\`;
    result = JSON.stringify(response, null, 2);
  }

  return result;
}
\`\`\`

## Error Handling

Provide clear, actionable error messages:

\`\`\`typescript
import axios, { AxiosError } from "axios";

function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      switch (error.response.status) {
        case 404:
          return "Error: Resource not found. Please check the ID is correct.";
        case 403:
          return "Error: Permission denied. You don't have access to this resource.";
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return \`Error: API request failed with status \${error.response.status}\`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    }
  }
  return \`Error: Unexpected error occurred: \${error instanceof Error ? error.message : String(error)}\`;
}
\`\`\`

## Shared Utilities

Extract common functionality into reusable functions:

\`\`\`typescript
// Shared API request function
async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  data?: any,
  params?: any
): Promise<T> {
  try {
    const response = await axios({
      method,
      url: \`\${API_BASE_URL}/\${endpoint}\`,
      data,
      params,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}
\`\`\`

## Async/Await Best Practices

Always use async/await for network requests and I/O operations:

\`\`\`typescript
// Good: Async network request
async function fetchData(resourceId: string): Promise<ResourceData> {
  const response = await axios.get(\`\${API_URL}/resource/\${resourceId}\`);
  return response.data;
}

// Bad: Promise chains
function fetchData(resourceId: string): Promise<ResourceData> {
  return axios.get(\`\${API_URL}/resource/\${resourceId}\`)
    .then(response => response.data);  // Harder to read and maintain
}
\`\`\`

## TypeScript Best Practices

1. **Use Strict TypeScript**: Enable strict mode in tsconfig.json
2. **Define Interfaces**: Create clear interface definitions for all data structures
3. **Avoid \`any\`**: Use proper types or \`unknown\` instead of \`any\`
4. **Zod for Runtime Validation**: Use Zod schemas to validate external data
5. **Type Guards**: Create type guard functions for complex type checking
6. **Error Handling**: Always use try-catch with proper error type checking
7. **Null Safety**: Use optional chaining (\`?.\`) and nullish coalescing (\`??\`)

\`\`\`typescript
// Good: Type-safe with Zod and interfaces
interface UserResponse {
  id: string;
  name: string;
  email: string;
  team?: string;
  active: boolean;
}

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  team: z.string().optional(),
  active: z.boolean()
});

type User = z.infer<typeof UserSchema>;

async function getUser(id: string): Promise<User> {
  const data = await apiCall(\`/users/\${id}\`);
  return UserSchema.parse(data);  // Runtime validation
}

// Bad: Using any
async function getUser(id: string): Promise<any> {
  return await apiCall(\`/users/\${id}\`);  // No type safety
}
\`\`\`

## Package Configuration

### package.json

\`\`\`json
{
  "name": "{service}-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for {Service} API integration",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "axios": "^1.7.9",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
\`\`\`

### tsconfig.json

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
\`\`\`

## Complete Example

\`\`\`typescript
#!/usr/bin/env node
/**
 * MCP Server for Example Service.
 *
 * This server provides tools to interact with Example API, including user search,
 * project management, and data export capabilities.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios, { AxiosError } from "axios";

// Constants
const API_BASE_URL = "https://api.example.com/v1";
const CHARACTER_LIMIT = 25000;

// Enums
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Zod schemas
const UserSearchInputSchema = z.object({
  query: z.string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search string to match against names/emails"),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

type UserSearchInput = z.infer<typeof UserSearchInputSchema>;

// Shared utility functions
async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  data?: any,
  params?: any
): Promise<T> {
  try {
    const response = await axios({
      method,
      url: \`\${API_BASE_URL}/\${endpoint}\`,
      data,
      params,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      switch (error.response.status) {
        case 404:
          return "Error: Resource not found. Please check the ID is correct.";
        case 403:
          return "Error: Permission denied. You don't have access to this resource.";
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return \`Error: API request failed with status \${error.response.status}\`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    }
  }
  return \`Error: Unexpected error occurred: \${error instanceof Error ? error.message : String(error)}\`;
}

// Create MCP server instance
const server = new McpServer({
  name: "example-mcp",
  version: "1.0.0"
});

// Register tools
server.registerTool(
  "example_search_users",
  {
    title: "Search Example Users",
    description: \`[Full description as shown above]\`,
    inputSchema: UserSearchInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: UserSearchInput) => {
    // Implementation as shown above
  }
);

// Main function
// For stdio (local):
async function runStdio() {
  if (!process.env.EXAMPLE_API_KEY) {
    console.error("ERROR: EXAMPLE_API_KEY environment variable is required");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running via stdio");
}

// For streamable HTTP (remote):
async function runHTTP() {
  if (!process.env.EXAMPLE_API_KEY) {
    console.error("ERROR: EXAMPLE_API_KEY environment variable is required");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.error(\`MCP server running on http://localhost:\${port}/mcp\`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || 'stdio';
if (transport === 'http') {
  runHTTP().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
\`\`\`

---

## Advanced MCP Features

### Resource Registration

Expose data as resources for efficient, URI-based access:

\`\`\`typescript
import { ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";

// Register a resource with URI template
server.registerResource(
  {
    uri: "file://documents/{name}",
    name: "Document Resource",
    description: "Access documents by name",
    mimeType: "text/plain"
  },
  async (uri: string) => {
    // Extract parameter from URI
    const match = uri.match(/^file:\\/\\/documents\\/(.+)$/);
    if (!match) {
      throw new Error("Invalid URI format");
    }

    const documentName = match[1];
    const content = await loadDocument(documentName);

    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: content
      }]
    };
  }
);

// List available resources dynamically
server.registerResourceList(async () => {
  const documents = await getAvailableDocuments();
  return {
    resources: documents.map(doc => ({
      uri: \`file://documents/\${doc.name}\`,
      name: doc.name,
      mimeType: "text/plain",
      description: doc.description
    }))
  };
});
\`\`\`

**When to use Resources vs Tools:**
- **Resources**: For data access with simple URI-based parameters
- **Tools**: For complex operations requiring validation and business logic
- **Resources**: When data is relatively static or template-based
- **Tools**: When operations have side effects or complex workflows

### Transport Options

The TypeScript SDK supports two main transport mechanisms:

#### Streamable HTTP (Recommended for Remote Servers)

\`\`\`typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  // Create new transport for each request (stateless, prevents request ID collisions)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on('close', () => transport.close());

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000);
\`\`\`

#### stdio (For Local Integrations)

\`\`\`typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
\`\`\`

**Transport selection:**
- **Streamable HTTP**: Web services, remote access, multiple clients
- **stdio**: Command-line tools, local development, subprocess integration

### Notification Support

Notify clients when server state changes:

\`\`\`typescript
// Notify when tools list changes
server.notification({
  method: "notifications/tools/list_changed"
});

// Notify when resources change
server.notification({
  method: "notifications/resources/list_changed"
});
\`\`\`

Use notifications sparingly - only when server capabilities genuinely change.

---

## Code Best Practices

### Code Composability and Reusability

Your implementation MUST prioritize composability and code reuse:

1. **Extract Common Functionality**:
   - Create reusable helper functions for operations used across multiple tools
   - Build shared API clients for HTTP requests instead of duplicating code
   - Centralize error handling logic in utility functions
   - Extract business logic into dedicated functions that can be composed
   - Extract shared markdown or JSON field selection & formatting functionality

2. **Avoid Duplication**:
   - NEVER copy-paste similar code between tools
   - If you find yourself writing similar logic twice, extract it into a function
   - Common operations like pagination, filtering, field selection, and formatting should be shared
   - Authentication/authorization logic should be centralized

## Building and Running

Always build your TypeScript code before running:

\`\`\`bash
# Build the project
npm run build

# Run the server
npm start

# Development with auto-reload
npm run dev
\`\`\`

Always ensure \`npm run build\` completes successfully before considering the implementation complete.

## Quality Checklist

Before finalizing your Node/TypeScript MCP server implementation, ensure:

### Strategic Design
- [ ] Tools enable complete workflows, not just API endpoint wrappers
- [ ] Tool names reflect natural task subdivisions
- [ ] Response formats optimize for agent context efficiency
- [ ] Human-readable identifiers used where appropriate
- [ ] Error messages guide agents toward correct usage

### Implementation Quality
- [ ] FOCUSED IMPLEMENTATION: Most important and valuable tools implemented
- [ ] All tools registered using \`registerTool\` with complete configuration
- [ ] All tools include \`title\`, \`description\`, \`inputSchema\`, and \`annotations\`
- [ ] Annotations correctly set (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- [ ] All tools use Zod schemas for runtime input validation with \`.strict()\` enforcement
- [ ] All Zod schemas have proper constraints and descriptive error messages
- [ ] All tools have comprehensive descriptions with explicit input/output types
- [ ] Descriptions include return value examples and complete schema documentation
- [ ] Error messages are clear, actionable, and educational

### TypeScript Quality
- [ ] TypeScript interfaces are defined for all data structures
- [ ] Strict TypeScript is enabled in tsconfig.json
- [ ] No use of \`any\` type - use \`unknown\` or proper types instead
- [ ] All async functions have explicit Promise<T> return types
- [ ] Error handling uses proper type guards (e.g., \`axios.isAxiosError\`, \`z.ZodError\`)

### Advanced Features (where applicable)
- [ ] Resources registered for appropriate data endpoints
- [ ] Appropriate transport configured (stdio or streamable HTTP)
- [ ] Notifications implemented for dynamic server capabilities
- [ ] Type-safe with SDK interfaces

### Project Configuration
- [ ] Package.json includes all necessary dependencies
- [ ] Build script produces working JavaScript in dist/ directory
- [ ] Main entry point is properly configured as dist/index.js
- [ ] Server name follows format: \`{service}-mcp-server\`
- [ ] tsconfig.json properly configured with strict mode

### Code Quality
- [ ] Pagination is properly implemented where applicable
- [ ] Large responses check CHARACTER_LIMIT constant and truncate with clear messages
- [ ] Filtering options are provided for potentially large result sets
- [ ] All network operations handle timeouts and connection errors gracefully
- [ ] Common functionality is extracted into reusable functions
- [ ] Return types are consistent across similar operations

### Testing and Build
- [ ] \`npm run build\` completes successfully without errors
- [ ] dist/index.js created and executable
- [ ] Server runs: \`node dist/index.js --help\`
- [ ] All imports resolve correctly
- [ ] Sample tool calls work as expected`, sortOrder: 2 },
      { id: 'builtin-mcp-builder-ref-3', name: 'reference/python_mcp_server.md', content: `# Python MCP Server Implementation Guide

## Overview

This document provides Python-specific best practices and examples for implementing MCP servers using the MCP Python SDK. It covers server setup, tool registration patterns, input validation with Pydantic, error handling, and complete working examples.

---

## Quick Reference

### Key Imports
\`\`\`python
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Dict, Any
from enum import Enum
import httpx
\`\`\`

### Server Initialization
\`\`\`python
mcp = FastMCP("service_mcp")
\`\`\`

### Tool Registration Pattern
\`\`\`python
@mcp.tool(name="tool_name", annotations={...})
async def tool_function(params: InputModel) -> str:
    # Implementation
    pass
\`\`\`

---

## MCP Python SDK and FastMCP

The official MCP Python SDK provides FastMCP, a high-level framework for building MCP servers. It provides:
- Automatic description and inputSchema generation from function signatures and docstrings
- Pydantic model integration for input validation
- Decorator-based tool registration with \`@mcp.tool\`

**For complete SDK documentation, use WebFetch to load:**
\`https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md\`

## Server Naming Convention

Python MCP servers must follow this naming pattern:
- **Format**: \`{service}_mcp\` (lowercase with underscores)
- **Examples**: \`github_mcp\`, \`jira_mcp\`, \`stripe_mcp\`

The name should be:
- General (not tied to specific features)
- Descriptive of the service/API being integrated
- Easy to infer from the task description
- Without version numbers or dates

## Tool Implementation

### Tool Naming

Use snake_case for tool names (e.g., "search_users", "create_project", "get_channel_info") with clear, action-oriented names.

**Avoid Naming Conflicts**: Include the service context to prevent overlaps:
- Use "slack_send_message" instead of just "send_message"
- Use "github_create_issue" instead of just "create_issue"
- Use "asana_list_tasks" instead of just "list_tasks"

### Tool Structure with FastMCP

Tools are defined using the \`@mcp.tool\` decorator with Pydantic models for input validation:

\`\`\`python
from pydantic import BaseModel, Field, ConfigDict
from mcp.server.fastmcp import FastMCP

# Initialize the MCP server
mcp = FastMCP("example_mcp")

# Define Pydantic model for input validation
class ServiceToolInput(BaseModel):
    '''Input model for service tool operation.'''
    model_config = ConfigDict(
        str_strip_whitespace=True,  # Auto-strip whitespace from strings
        validate_assignment=True,    # Validate on assignment
        extra='forbid'              # Forbid extra fields
    )

    param1: str = Field(..., description="First parameter description (e.g., 'user123', 'project-abc')", min_length=1, max_length=100)
    param2: Optional[int] = Field(default=None, description="Optional integer parameter with constraints", ge=0, le=1000)
    tags: Optional[List[str]] = Field(default_factory=list, description="List of tags to apply", max_items=10)

@mcp.tool(
    name="service_tool_name",
    annotations={
        "title": "Human-Readable Tool Title",
        "readOnlyHint": True,     # Tool does not modify environment
        "destructiveHint": False,  # Tool does not perform destructive operations
        "idempotentHint": True,    # Repeated calls have no additional effect
        "openWorldHint": False     # Tool does not interact with external entities
    }
)
async def service_tool_name(params: ServiceToolInput) -> str:
    '''Tool description automatically becomes the 'description' field.

    This tool performs a specific operation on the service. It validates all inputs
    using the ServiceToolInput Pydantic model before processing.

    Args:
        params (ServiceToolInput): Validated input parameters containing:
            - param1 (str): First parameter description
            - param2 (Optional[int]): Optional parameter with default
            - tags (Optional[List[str]]): List of tags

    Returns:
        str: JSON-formatted response containing operation results
    '''
    # Implementation here
    pass
\`\`\`

## Pydantic v2 Key Features

- Use \`model_config\` instead of nested \`Config\` class
- Use \`field_validator\` instead of deprecated \`validator\`
- Use \`model_dump()\` instead of deprecated \`dict()\`
- Validators require \`@classmethod\` decorator
- Type hints are required for validator methods

\`\`\`python
from pydantic import BaseModel, Field, field_validator, ConfigDict

class CreateUserInput(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True
    )

    name: str = Field(..., description="User's full name", min_length=1, max_length=100)
    email: str = Field(..., description="User's email address", pattern=r'^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$')
    age: int = Field(..., description="User's age", ge=0, le=150)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Email cannot be empty")
        return v.lower()
\`\`\`

## Response Format Options

Support multiple output formats for flexibility:

\`\`\`python
from enum import Enum

class ResponseFormat(str, Enum):
    '''Output format for tool responses.'''
    MARKDOWN = "markdown"
    JSON = "json"

class UserSearchInput(BaseModel):
    query: str = Field(..., description="Search query")
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="Output format: 'markdown' for human-readable or 'json' for machine-readable"
    )
\`\`\`

**Markdown format**:
- Use headers, lists, and formatting for clarity
- Convert timestamps to human-readable format (e.g., "2024-01-15 10:30:00 UTC" instead of epoch)
- Show display names with IDs in parentheses (e.g., "@john.doe (U123456)")
- Omit verbose metadata (e.g., show only one profile image URL, not all sizes)
- Group related information logically

**JSON format**:
- Return complete, structured data suitable for programmatic processing
- Include all available fields and metadata
- Use consistent field names and types

## Pagination Implementation

For tools that list resources:

\`\`\`python
class ListInput(BaseModel):
    limit: Optional[int] = Field(default=20, description="Maximum results to return", ge=1, le=100)
    offset: Optional[int] = Field(default=0, description="Number of results to skip for pagination", ge=0)

async def list_items(params: ListInput) -> str:
    # Make API request with pagination
    data = await api_request(limit=params.limit, offset=params.offset)

    # Return pagination info
    response = {
        "total": data["total"],
        "count": len(data["items"]),
        "offset": params.offset,
        "items": data["items"],
        "has_more": data["total"] > params.offset + len(data["items"]),
        "next_offset": params.offset + len(data["items"]) if data["total"] > params.offset + len(data["items"]) else None
    }
    return json.dumps(response, indent=2)
\`\`\`

## Error Handling

Provide clear, actionable error messages:

\`\`\`python
def _handle_api_error(e: Exception) -> str:
    '''Consistent error formatting across all tools.'''
    if isinstance(e, httpx.HTTPStatusError):
        if e.response.status_code == 404:
            return "Error: Resource not found. Please check the ID is correct."
        elif e.response.status_code == 403:
            return "Error: Permission denied. You don't have access to this resource."
        elif e.response.status_code == 429:
            return "Error: Rate limit exceeded. Please wait before making more requests."
        return f"Error: API request failed with status {e.response.status_code}"
    elif isinstance(e, httpx.TimeoutException):
        return "Error: Request timed out. Please try again."
    return f"Error: Unexpected error occurred: {type(e).__name__}"
\`\`\`

## Shared Utilities

Extract common functionality into reusable functions:

\`\`\`python
# Shared API request function
async def _make_api_request(endpoint: str, method: str = "GET", **kwargs) -> dict:
    '''Reusable function for all API calls.'''
    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            f"{API_BASE_URL}/{endpoint}",
            timeout=30.0,
            **kwargs
        )
        response.raise_for_status()
        return response.json()
\`\`\`

## Async/Await Best Practices

Always use async/await for network requests and I/O operations:

\`\`\`python
# Good: Async network request
async def fetch_data(resource_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_URL}/resource/{resource_id}")
        response.raise_for_status()
        return response.json()

# Bad: Synchronous request
def fetch_data(resource_id: str) -> dict:
    response = requests.get(f"{API_URL}/resource/{resource_id}")  # Blocks
    return response.json()
\`\`\`

## Type Hints

Use type hints throughout:

\`\`\`python
from typing import Optional, List, Dict, Any

async def get_user(user_id: str) -> Dict[str, Any]:
    data = await fetch_user(user_id)
    return {"id": data["id"], "name": data["name"]}
\`\`\`

## Tool Docstrings

Every tool must have comprehensive docstrings with explicit type information:

\`\`\`python
async def search_users(params: UserSearchInput) -> str:
    '''
    Search for users in the Example system by name, email, or team.

    This tool searches across all user profiles in the Example platform,
    supporting partial matches and various search filters. It does NOT
    create or modify users, only searches existing ones.

    Args:
        params (UserSearchInput): Validated input parameters containing:
            - query (str): Search string to match against names/emails (e.g., "john", "@example.com", "team:marketing")
            - limit (Optional[int]): Maximum results to return, between 1-100 (default: 20)
            - offset (Optional[int]): Number of results to skip for pagination (default: 0)

    Returns:
        str: JSON-formatted string containing search results with the following schema:

        Success response:
        {
            "total": int,           # Total number of matches found
            "count": int,           # Number of results in this response
            "offset": int,          # Current pagination offset
            "users": [
                {
                    "id": str,      # User ID (e.g., "U123456789")
                    "name": str,    # Full name (e.g., "John Doe")
                    "email": str,   # Email address (e.g., "john@example.com")
                    "team": str     # Team name (e.g., "Marketing") - optional
                }
            ]
        }

        Error response:
        "Error: <error message>" or "No users found matching '<query>'"

    Examples:
        - Use when: "Find all marketing team members" -> params with query="team:marketing"
        - Use when: "Search for John's account" -> params with query="john"
        - Don't use when: You need to create a user (use example_create_user instead)
        - Don't use when: You have a user ID and need full details (use example_get_user instead)

    Error Handling:
        - Input validation errors are handled by Pydantic model
        - Returns "Error: Rate limit exceeded" if too many requests (429 status)
        - Returns "Error: Invalid API authentication" if API key is invalid (401 status)
        - Returns formatted list of results or "No users found matching 'query'"
    '''
\`\`\`

## Complete Example

See below for a complete Python MCP server example:

\`\`\`python
#!/usr/bin/env python3
'''
MCP Server for Example Service.

This server provides tools to interact with Example API, including user search,
project management, and data export capabilities.
'''

from typing import Optional, List, Dict, Any
from enum import Enum
import httpx
from pydantic import BaseModel, Field, field_validator, ConfigDict
from mcp.server.fastmcp import FastMCP

# Initialize the MCP server
mcp = FastMCP("example_mcp")

# Constants
API_BASE_URL = "https://api.example.com/v1"

# Enums
class ResponseFormat(str, Enum):
    '''Output format for tool responses.'''
    MARKDOWN = "markdown"
    JSON = "json"

# Pydantic Models for Input Validation
class UserSearchInput(BaseModel):
    '''Input model for user search operations.'''
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True
    )

    query: str = Field(..., description="Search string to match against names/emails", min_length=2, max_length=200)
    limit: Optional[int] = Field(default=20, description="Maximum results to return", ge=1, le=100)
    offset: Optional[int] = Field(default=0, description="Number of results to skip for pagination", ge=0)
    response_format: ResponseFormat = Field(default=ResponseFormat.MARKDOWN, description="Output format")

    @field_validator('query')
    @classmethod
    def validate_query(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Query cannot be empty or whitespace only")
        return v.strip()

# Shared utility functions
async def _make_api_request(endpoint: str, method: str = "GET", **kwargs) -> dict:
    '''Reusable function for all API calls.'''
    async with httpx.AsyncClient() as client:
        response = await client.request(
            method,
            f"{API_BASE_URL}/{endpoint}",
            timeout=30.0,
            **kwargs
        )
        response.raise_for_status()
        return response.json()

def _handle_api_error(e: Exception) -> str:
    '''Consistent error formatting across all tools.'''
    if isinstance(e, httpx.HTTPStatusError):
        if e.response.status_code == 404:
            return "Error: Resource not found. Please check the ID is correct."
        elif e.response.status_code == 403:
            return "Error: Permission denied. You don't have access to this resource."
        elif e.response.status_code == 429:
            return "Error: Rate limit exceeded. Please wait before making more requests."
        return f"Error: API request failed with status {e.response.status_code}"
    elif isinstance(e, httpx.TimeoutException):
        return "Error: Request timed out. Please try again."
    return f"Error: Unexpected error occurred: {type(e).__name__}"

# Tool definitions
@mcp.tool(
    name="example_search_users",
    annotations={
        "title": "Search Example Users",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True
    }
)
async def example_search_users(params: UserSearchInput) -> str:
    '''Search for users in the Example system by name, email, or team.

    [Full docstring as shown above]
    '''
    try:
        # Make API request using validated parameters
        data = await _make_api_request(
            "users/search",
            params={
                "q": params.query,
                "limit": params.limit,
                "offset": params.offset
            }
        )

        users = data.get("users", [])
        total = data.get("total", 0)

        if not users:
            return f"No users found matching '{params.query}'"

        # Format response based on requested format
        if params.response_format == ResponseFormat.MARKDOWN:
            lines = [f"# User Search Results: '{params.query}'", ""]
            lines.append(f"Found {total} users (showing {len(users)})")
            lines.append("")

            for user in users:
                lines.append(f"## {user['name']} ({user['id']})")
                lines.append(f"- **Email**: {user['email']}")
                if user.get('team'):
                    lines.append(f"- **Team**: {user['team']}")
                lines.append("")

            return "\\n".join(lines)

        else:
            # Machine-readable JSON format
            import json
            response = {
                "total": total,
                "count": len(users),
                "offset": params.offset,
                "users": users
            }
            return json.dumps(response, indent=2)

    except Exception as e:
        return _handle_api_error(e)

if __name__ == "__main__":
    mcp.run()
\`\`\`

---

## Advanced FastMCP Features

### Context Parameter Injection

FastMCP can automatically inject a \`Context\` parameter into tools for advanced capabilities like logging, progress reporting, resource reading, and user interaction:

\`\`\`python
from mcp.server.fastmcp import FastMCP, Context

mcp = FastMCP("example_mcp")

@mcp.tool()
async def advanced_search(query: str, ctx: Context) -> str:
    '''Advanced tool with context access for logging and progress.'''

    # Report progress for long operations
    await ctx.report_progress(0.25, "Starting search...")

    # Log information for debugging
    await ctx.log_info("Processing query", {"query": query, "timestamp": datetime.now()})

    # Perform search
    results = await search_api(query)
    await ctx.report_progress(0.75, "Formatting results...")

    # Access server configuration
    server_name = ctx.fastmcp.name

    return format_results(results)

@mcp.tool()
async def interactive_tool(resource_id: str, ctx: Context) -> str:
    '''Tool that can request additional input from users.'''

    # Request sensitive information when needed
    api_key = await ctx.elicit(
        prompt="Please provide your API key:",
        input_type="password"
    )

    # Use the provided key
    return await api_call(resource_id, api_key)
\`\`\`

**Context capabilities:**
- \`ctx.report_progress(progress, message)\` - Report progress for long operations
- \`ctx.log_info(message, data)\` / \`ctx.log_error()\` / \`ctx.log_debug()\` - Logging
- \`ctx.elicit(prompt, input_type)\` - Request input from users
- \`ctx.fastmcp.name\` - Access server configuration
- \`ctx.read_resource(uri)\` - Read MCP resources

### Resource Registration

Expose data as resources for efficient, template-based access:

\`\`\`python
@mcp.resource("file://documents/{name}")
async def get_document(name: str) -> str:
    '''Expose documents as MCP resources.

    Resources are useful for static or semi-static data that doesn't
    require complex parameters. They use URI templates for flexible access.
    '''
    document_path = f"./docs/{name}"
    with open(document_path, "r") as f:
        return f.read()

@mcp.resource("config://settings/{key}")
async def get_setting(key: str, ctx: Context) -> str:
    '''Expose configuration as resources with context.'''
    settings = await load_settings()
    return json.dumps(settings.get(key, {}))
\`\`\`

**When to use Resources vs Tools:**
- **Resources**: For data access with simple parameters (URI templates)
- **Tools**: For complex operations with validation and business logic

### Structured Output Types

FastMCP supports multiple return types beyond strings:

\`\`\`python
from typing import TypedDict
from dataclasses import dataclass
from pydantic import BaseModel

# TypedDict for structured returns
class UserData(TypedDict):
    id: str
    name: str
    email: str

@mcp.tool()
async def get_user_typed(user_id: str) -> UserData:
    '''Returns structured data - FastMCP handles serialization.'''
    return {"id": user_id, "name": "John Doe", "email": "john@example.com"}

# Pydantic models for complex validation
class DetailedUser(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime
    metadata: Dict[str, Any]

@mcp.tool()
async def get_user_detailed(user_id: str) -> DetailedUser:
    '''Returns Pydantic model - automatically generates schema.'''
    user = await fetch_user(user_id)
    return DetailedUser(**user)
\`\`\`

### Lifespan Management

Initialize resources that persist across requests:

\`\`\`python
from contextlib import asynccontextmanager

@asynccontextmanager
async def app_lifespan():
    '''Manage resources that live for the server's lifetime.'''
    # Initialize connections, load config, etc.
    db = await connect_to_database()
    config = load_configuration()

    # Make available to all tools
    yield {"db": db, "config": config}

    # Cleanup on shutdown
    await db.close()

mcp = FastMCP("example_mcp", lifespan=app_lifespan)

@mcp.tool()
async def query_data(query: str, ctx: Context) -> str:
    '''Access lifespan resources through context.'''
    db = ctx.request_context.lifespan_state["db"]
    results = await db.query(query)
    return format_results(results)
\`\`\`

### Transport Options

FastMCP supports two main transport mechanisms:

\`\`\`python
# stdio transport (for local tools) - default
if __name__ == "__main__":
    mcp.run()

# Streamable HTTP transport (for remote servers)
if __name__ == "__main__":
    mcp.run(transport="streamable_http", port=8000)
\`\`\`

**Transport selection:**
- **stdio**: Command-line tools, local integrations, subprocess execution
- **Streamable HTTP**: Web services, remote access, multiple clients

---

## Code Best Practices

### Code Composability and Reusability

Your implementation MUST prioritize composability and code reuse:

1. **Extract Common Functionality**:
   - Create reusable helper functions for operations used across multiple tools
   - Build shared API clients for HTTP requests instead of duplicating code
   - Centralize error handling logic in utility functions
   - Extract business logic into dedicated functions that can be composed
   - Extract shared markdown or JSON field selection & formatting functionality

2. **Avoid Duplication**:
   - NEVER copy-paste similar code between tools
   - If you find yourself writing similar logic twice, extract it into a function
   - Common operations like pagination, filtering, field selection, and formatting should be shared
   - Authentication/authorization logic should be centralized

### Python-Specific Best Practices

1. **Use Type Hints**: Always include type annotations for function parameters and return values
2. **Pydantic Models**: Define clear Pydantic models for all input validation
3. **Avoid Manual Validation**: Let Pydantic handle input validation with constraints
4. **Proper Imports**: Group imports (standard library, third-party, local)
5. **Error Handling**: Use specific exception types (httpx.HTTPStatusError, not generic Exception)
6. **Async Context Managers**: Use \`async with\` for resources that need cleanup
7. **Constants**: Define module-level constants in UPPER_CASE

## Quality Checklist

Before finalizing your Python MCP server implementation, ensure:

### Strategic Design
- [ ] Tools enable complete workflows, not just API endpoint wrappers
- [ ] Tool names reflect natural task subdivisions
- [ ] Response formats optimize for agent context efficiency
- [ ] Human-readable identifiers used where appropriate
- [ ] Error messages guide agents toward correct usage

### Implementation Quality
- [ ] FOCUSED IMPLEMENTATION: Most important and valuable tools implemented
- [ ] All tools have descriptive names and documentation
- [ ] Return types are consistent across similar operations
- [ ] Error handling is implemented for all external calls
- [ ] Server name follows format: \`{service}_mcp\`
- [ ] All network operations use async/await
- [ ] Common functionality is extracted into reusable functions
- [ ] Error messages are clear, actionable, and educational
- [ ] Outputs are properly validated and formatted

### Tool Configuration
- [ ] All tools implement 'name' and 'annotations' in the decorator
- [ ] Annotations correctly set (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- [ ] All tools use Pydantic BaseModel for input validation with Field() definitions
- [ ] All Pydantic Fields have explicit types and descriptions with constraints
- [ ] All tools have comprehensive docstrings with explicit input/output types
- [ ] Docstrings include complete schema structure for dict/JSON returns
- [ ] Pydantic models handle input validation (no manual validation needed)

### Advanced Features (where applicable)
- [ ] Context injection used for logging, progress, or elicitation
- [ ] Resources registered for appropriate data endpoints
- [ ] Lifespan management implemented for persistent connections
- [ ] Structured output types used (TypedDict, Pydantic models)
- [ ] Appropriate transport configured (stdio or streamable HTTP)

### Code Quality
- [ ] File includes proper imports including Pydantic imports
- [ ] Pagination is properly implemented where applicable
- [ ] Filtering options are provided for potentially large result sets
- [ ] All async functions are properly defined with \`async def\`
- [ ] HTTP client usage follows async patterns with proper context managers
- [ ] Type hints are used throughout the code
- [ ] Constants are defined at module level in UPPER_CASE

### Testing
- [ ] Server runs successfully: \`python your_server.py --help\`
- [ ] All imports resolve correctly
- [ ] Sample tool calls work as expected
- [ ] Error scenarios handled gracefully`, sortOrder: 3 }
    ]
  },
  {
    id: 'builtin-migration-advisor',
    name: 'Migration Advisor',
    description: `Database migration best practices for schema changes, data migrations, rollbacks, and zero-downtime deployments across PostgreSQL, MySQL, and common ORMs (Prisma, Drizzle, Django, TypeORM, golang-migrate).`,
    instructions: `# Database Migration Patterns

Safe, reversible database schema changes for production systems.

## When to Activate

- Creating or altering database tables
- Adding/removing columns or indexes
- Running data migrations (backfill, transform)
- Planning zero-downtime schema changes
- Setting up migration tooling for a new project

## Core Principles

1. **Every change is a migration** — never alter production databases manually
2. **Migrations are forward-only in production** — rollbacks use new forward migrations
3. **Schema and data migrations are separate** — never mix DDL and DML in one migration
4. **Test migrations against production-sized data** — a migration that works on 100 rows may lock on 10M
5. **Migrations are immutable once deployed** — never edit a migration that has run in production

## Migration Safety Checklist

Before applying any migration:

- [ ] Migration has both UP and DOWN (or is explicitly marked irreversible)
- [ ] No full table locks on large tables (use concurrent operations)
- [ ] New columns have defaults or are nullable (never add NOT NULL without default)
- [ ] Indexes created concurrently (not inline with CREATE TABLE for existing tables)
- [ ] Data backfill is a separate migration from schema change
- [ ] Tested against a copy of production data
- [ ] Rollback plan documented

## PostgreSQL Patterns

### Adding a Column Safely

\`\`\`sql
-- GOOD: Nullable column, no lock
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- GOOD: Column with default (Postgres 11+ is instant, no rewrite)
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- BAD: NOT NULL without default on existing table (requires full rewrite)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL;
-- This locks the table and rewrites every row
\`\`\`

### Adding an Index Without Downtime

\`\`\`sql
-- BAD: Blocks writes on large tables
CREATE INDEX idx_users_email ON users (email);

-- GOOD: Non-blocking, allows concurrent writes
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Note: CONCURRENTLY cannot run inside a transaction block
-- Most migration tools need special handling for this
\`\`\`

### Renaming a Column (Zero-Downtime)

Never rename directly in production. Use the expand-contract pattern:

\`\`\`sql
-- Step 1: Add new column (migration 001)
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Step 2: Backfill data (migration 002, data migration)
UPDATE users SET display_name = username WHERE display_name IS NULL;

-- Step 3: Update application code to read/write both columns
-- Deploy application changes

-- Step 4: Stop writing to old column, drop it (migration 003)
ALTER TABLE users DROP COLUMN username;
\`\`\`

### Removing a Column Safely

\`\`\`sql
-- Step 1: Remove all application references to the column
-- Step 2: Deploy application without the column reference
-- Step 3: Drop column in next migration
ALTER TABLE orders DROP COLUMN legacy_status;

-- For Django: use SeparateDatabaseAndState to remove from model
-- without generating DROP COLUMN (then drop in next migration)
\`\`\`

### Large Data Migrations

\`\`\`sql
-- BAD: Updates all rows in one transaction (locks table)
UPDATE users SET normalized_email = LOWER(email);

-- GOOD: Batch update with progress
DO $$
DECLARE
  batch_size INT := 10000;
  rows_updated INT;
BEGIN
  LOOP
    UPDATE users
    SET normalized_email = LOWER(email)
    WHERE id IN (
      SELECT id FROM users
      WHERE normalized_email IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    );
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows', rows_updated;
    EXIT WHEN rows_updated = 0;
    COMMIT;
  END LOOP;
END $$;
\`\`\`

## Prisma (TypeScript/Node.js)

### Workflow

\`\`\`bash
# Create migration from schema changes
npx prisma migrate dev --name add_user_avatar

# Apply pending migrations in production
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
\`\`\`

### Schema Example

\`\`\`prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  orders    Order[]

  @@map("users")
  @@index([email])
}
\`\`\`

### Custom SQL Migration

For operations Prisma cannot express (concurrent indexes, data backfills):

\`\`\`bash
# Create empty migration, then edit the SQL manually
npx prisma migrate dev --create-only --name add_email_index
\`\`\`

\`\`\`sql
-- migrations/20240115_add_email_index/migration.sql
-- Prisma cannot generate CONCURRENTLY, so we write it manually
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
\`\`\`

## Drizzle (TypeScript/Node.js)

### Workflow

\`\`\`bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (dev only, no migration file)
npx drizzle-kit push
\`\`\`

### Schema Example

\`\`\`typescript
import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
\`\`\`

## Django (Python)

### Workflow

\`\`\`bash
# Generate migration from model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Show migration status
python manage.py showmigrations

# Generate empty migration for custom SQL
python manage.py makemigrations --empty app_name -n description
\`\`\`

### Data Migration

\`\`\`python
from django.db import migrations

def backfill_display_names(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    batch_size = 5000
    users = User.objects.filter(display_name="")
    while users.exists():
        batch = list(users[:batch_size])
        for user in batch:
            user.display_name = user.username
        User.objects.bulk_update(batch, ["display_name"], batch_size=batch_size)

def reverse_backfill(apps, schema_editor):
    pass  # Data migration, no reverse needed

class Migration(migrations.Migration):
    dependencies = [("accounts", "0015_add_display_name")]

    operations = [
        migrations.RunPython(backfill_display_names, reverse_backfill),
    ]
\`\`\`

### SeparateDatabaseAndState

Remove a column from the Django model without dropping it from the database immediately:

\`\`\`python
class Migration(migrations.Migration):
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name="user", name="legacy_field"),
            ],
            database_operations=[],  # Don't touch the DB yet
        ),
    ]
\`\`\`

## golang-migrate (Go)

### Workflow

\`\`\`bash
# Create migration pair
migrate create -ext sql -dir migrations -seq add_user_avatar

# Apply all pending migrations
migrate -path migrations -database "$DATABASE_URL" up

# Rollback last migration
migrate -path migrations -database "$DATABASE_URL" down 1

# Force version (fix dirty state)
migrate -path migrations -database "$DATABASE_URL" force VERSION
\`\`\`

### Migration Files

\`\`\`sql
-- migrations/000003_add_user_avatar.up.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
CREATE INDEX CONCURRENTLY idx_users_avatar ON users (avatar_url) WHERE avatar_url IS NOT NULL;

-- migrations/000003_add_user_avatar.down.sql
DROP INDEX IF EXISTS idx_users_avatar;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
\`\`\`

## Zero-Downtime Migration Strategy

For critical production changes, follow the expand-contract pattern:

\`\`\`
Phase 1: EXPAND
  - Add new column/table (nullable or with default)
  - Deploy: app writes to BOTH old and new
  - Backfill existing data

Phase 2: MIGRATE
  - Deploy: app reads from NEW, writes to BOTH
  - Verify data consistency

Phase 3: CONTRACT
  - Deploy: app only uses NEW
  - Drop old column/table in separate migration
\`\`\`

### Timeline Example

\`\`\`
Day 1: Migration adds new_status column (nullable)
Day 1: Deploy app v2 — writes to both status and new_status
Day 2: Run backfill migration for existing rows
Day 3: Deploy app v3 — reads from new_status only
Day 7: Migration drops old status column
\`\`\`

## Anti-Patterns

| Anti-Pattern | Why It Fails | Better Approach |
|-------------|-------------|-----------------|
| Manual SQL in production | No audit trail, unrepeatable | Always use migration files |
| Editing deployed migrations | Causes drift between environments | Create new migration instead |
| NOT NULL without default | Locks table, rewrites all rows | Add nullable, backfill, then add constraint |
| Inline index on large table | Blocks writes during build | CREATE INDEX CONCURRENTLY |
| Schema + data in one migration | Hard to rollback, long transactions | Separate migrations |
| Dropping column before removing code | Application errors on missing column | Remove code first, drop column next deploy |`,
    sortOrder: -8,
    refs: [
    ]
  },
  {
    id: 'builtin-pdf-handler',
    name: 'PDF Handler',
    description: `Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.`,
    instructions: `# PDF Processing Guide

## Overview

This guide covers essential PDF processing operations using Python libraries and command-line tools. For advanced features, JavaScript libraries, and detailed examples, see REFERENCE.md. If you need to fill out a PDF form, read FORMS.md and follow its instructions.

## Quick Start

\`\`\`python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
\`\`\`

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
\`\`\`python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
\`\`\`

#### Split PDF
\`\`\`python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
\`\`\`

#### Extract Metadata
\`\`\`python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
\`\`\`

#### Rotate Pages
\`\`\`python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
\`\`\`

### pdfplumber - Text and Table Extraction

#### Extract Text with Layout
\`\`\`python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
\`\`\`

#### Extract Tables
\`\`\`python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
\`\`\`

#### Advanced Table Extraction
\`\`\`python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # Check if table is not empty
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# Combine all tables
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
\`\`\`

### reportlab - Create PDFs

#### Basic PDF Creation
\`\`\`python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# Add text
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# Add a line
c.line(100, height - 140, 400, height - 140)

# Save
c.save()
\`\`\`

#### Create PDF with Multiple Pages
\`\`\`python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add content
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# Page 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# Build PDF
doc.build(story)
\`\`\`

#### Subscripts and Superscripts

**IMPORTANT**: Never use Unicode subscript/superscript characters (₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹) in ReportLab PDFs. The built-in fonts do not include these glyphs, causing them to render as solid black boxes.

Instead, use ReportLab's XML markup tags in Paragraph objects:
\`\`\`python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()

# Subscripts: use <sub> tag
chemical = Paragraph("H<sub>2</sub>O", styles['Normal'])

# Superscripts: use <super> tag
squared = Paragraph("x<super>2</super> + y<super>2</super>", styles['Normal'])
\`\`\`

For canvas-drawn text (not Paragraph objects), manually adjust font the size and position rather than using Unicode subscripts/superscripts.

## Command-Line Tools

### pdftotext (poppler-utils)
\`\`\`bash
# Extract text
pdftotext input.pdf output.txt

# Extract text preserving layout
pdftotext -layout input.pdf output.txt

# Extract specific pages
pdftotext -f 1 -l 5 input.pdf output.txt  # Pages 1-5
\`\`\`

### qpdf
\`\`\`bash
# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Split pages
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1  # Rotate page 1 by 90 degrees

# Remove password
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
\`\`\`

### pdftk (if available)
\`\`\`bash
# Merge
pdftk file1.pdf file2.pdf cat output merged.pdf

# Split
pdftk input.pdf burst

# Rotate
pdftk input.pdf rotate 1east output rotated.pdf
\`\`\`

## Common Tasks

### Extract Text from Scanned PDFs
\`\`\`python
# Requires: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# Convert PDF to images
images = convert_from_path('scanned.pdf')

# OCR each page
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\\n"
    text += pytesseract.image_to_string(image)
    text += "\\n\\n"

print(text)
\`\`\`

### Add Watermark
\`\`\`python
from pypdf import PdfReader, PdfWriter

# Create watermark (or load existing)
watermark = PdfReader("watermark.pdf").pages[0]

# Apply to all pages
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
\`\`\`

### Extract Images
\`\`\`bash
# Using pdfimages (poppler-utils)
pdfimages -j input.pdf output_prefix

# This extracts all images as output_prefix-000.jpg, output_prefix-001.jpg, etc.
\`\`\`

### Password Protection
\`\`\`python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Add password
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
\`\`\`

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | \`writer.add_page(page)\` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | \`page.extract_text()\` |
| Extract tables | pdfplumber | \`page.extract_tables()\` |
| Create PDFs | reportlab | Canvas or Platypus |
| Command line merge | qpdf | \`qpdf --empty --pages ...\` |
| OCR scanned PDFs | pytesseract | Convert to image first |
| Fill PDF forms | pdf-lib or pypdf (see FORMS.md) | See FORMS.md |

## Next Steps

- For advanced pypdfium2 usage, see REFERENCE.md
- For JavaScript libraries (pdf-lib), see REFERENCE.md
- If you need to fill out a PDF form, follow the instructions in FORMS.md
- For troubleshooting guides, see REFERENCE.md`,
    sortOrder: -7,
    refs: [
      { id: 'builtin-pdf-handler-ref-0', name: 'reference.md', content: `# PDF Processing Advanced Reference

This document contains advanced PDF processing features, detailed examples, and additional libraries not covered in the main skill instructions.

## pypdfium2 Library (Apache/BSD License)

### Overview
pypdfium2 is a Python binding for PDFium (Chromium's PDF library). It's excellent for fast PDF rendering, image generation, and serves as a PyMuPDF replacement.

### Render PDF to Images
\`\`\`python
import pypdfium2 as pdfium
from PIL import Image

# Load PDF
pdf = pdfium.PdfDocument("document.pdf")

# Render page to image
page = pdf[0]  # First page
bitmap = page.render(
    scale=2.0,  # Higher resolution
    rotation=0  # No rotation
)

# Convert to PIL Image
img = bitmap.to_pil()
img.save("page_1.png", "PNG")

# Process multiple pages
for i, page in enumerate(pdf):
    bitmap = page.render(scale=1.5)
    img = bitmap.to_pil()
    img.save(f"page_{i+1}.jpg", "JPEG", quality=90)
\`\`\`

### Extract Text with pypdfium2
\`\`\`python
import pypdfium2 as pdfium

pdf = pdfium.PdfDocument("document.pdf")
for i, page in enumerate(pdf):
    text = page.get_text()
    print(f"Page {i+1} text length: {len(text)} chars")
\`\`\`

## JavaScript Libraries

### pdf-lib (MIT License)

pdf-lib is a powerful JavaScript library for creating and modifying PDF documents in any JavaScript environment.

#### Load and Manipulate Existing PDF
\`\`\`javascript
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function manipulatePDF() {
    // Load existing PDF
    const existingPdfBytes = fs.readFileSync('input.pdf');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get page count
    const pageCount = pdfDoc.getPageCount();
    console.log(\`Document has \${pageCount} pages\`);

    // Add new page
    const newPage = pdfDoc.addPage([600, 400]);
    newPage.drawText('Added by pdf-lib', {
        x: 100,
        y: 300,
        size: 16
    });

    // Save modified PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('modified.pdf', pdfBytes);
}
\`\`\`

#### Create Complex PDFs from Scratch
\`\`\`javascript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

async function createPDF() {
    const pdfDoc = await PDFDocument.create();

    // Add fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add page
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    // Add text with styling
    page.drawText('Invoice #12345', {
        x: 50,
        y: height - 50,
        size: 18,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.8)
    });

    // Add rectangle (header background)
    page.drawRectangle({
        x: 40,
        y: height - 100,
        width: width - 80,
        height: 30,
        color: rgb(0.9, 0.9, 0.9)
    });

    // Add table-like content
    const items = [
        ['Item', 'Qty', 'Price', 'Total'],
        ['Widget', '2', '$50', '$100'],
        ['Gadget', '1', '$75', '$75']
    ];

    let yPos = height - 150;
    items.forEach(row => {
        let xPos = 50;
        row.forEach(cell => {
            page.drawText(cell, {
                x: xPos,
                y: yPos,
                size: 12,
                font: helveticaFont
            });
            xPos += 120;
        });
        yPos -= 25;
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('created.pdf', pdfBytes);
}
\`\`\`

#### Advanced Merge and Split Operations
\`\`\`javascript
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function mergePDFs() {
    // Create new document
    const mergedPdf = await PDFDocument.create();

    // Load source PDFs
    const pdf1Bytes = fs.readFileSync('doc1.pdf');
    const pdf2Bytes = fs.readFileSync('doc2.pdf');

    const pdf1 = await PDFDocument.load(pdf1Bytes);
    const pdf2 = await PDFDocument.load(pdf2Bytes);

    // Copy pages from first PDF
    const pdf1Pages = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
    pdf1Pages.forEach(page => mergedPdf.addPage(page));

    // Copy specific pages from second PDF (pages 0, 2, 4)
    const pdf2Pages = await mergedPdf.copyPages(pdf2, [0, 2, 4]);
    pdf2Pages.forEach(page => mergedPdf.addPage(page));

    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync('merged.pdf', mergedPdfBytes);
}
\`\`\`

### pdfjs-dist (Apache License)

PDF.js is Mozilla's JavaScript library for rendering PDFs in the browser.

#### Basic PDF Loading and Rendering
\`\`\`javascript
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker (important for performance)
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.js';

async function renderPDF() {
    // Load PDF
    const loadingTask = pdfjsLib.getDocument('document.pdf');
    const pdf = await loadingTask.promise;

    console.log(\`Loaded PDF with \${pdf.numPages} pages\`);

    // Get first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    // Render to canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;
    document.body.appendChild(canvas);
}
\`\`\`

#### Extract Text with Coordinates
\`\`\`javascript
import * as pdfjsLib from 'pdfjs-dist';

async function extractText() {
    const loadingTask = pdfjsLib.getDocument('document.pdf');
    const pdf = await loadingTask.promise;

    let fullText = '';

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map(item => item.str)
            .join(' ');

        fullText += \`\\n--- Page \${i} ---\\n\${pageText}\`;

        // Get text with coordinates for advanced processing
        const textWithCoords = textContent.items.map(item => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height
        }));
    }

    console.log(fullText);
    return fullText;
}
\`\`\`

#### Extract Annotations and Forms
\`\`\`javascript
import * as pdfjsLib from 'pdfjs-dist';

async function extractAnnotations() {
    const loadingTask = pdfjsLib.getDocument('annotated.pdf');
    const pdf = await loadingTask.promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const annotations = await page.getAnnotations();

        annotations.forEach(annotation => {
            console.log(\`Annotation type: \${annotation.subtype}\`);
            console.log(\`Content: \${annotation.contents}\`);
            console.log(\`Coordinates: \${JSON.stringify(annotation.rect)}\`);
        });
    }
}
\`\`\`

## Advanced Command-Line Operations

### poppler-utils Advanced Features

#### Extract Text with Bounding Box Coordinates
\`\`\`bash
# Extract text with bounding box coordinates (essential for structured data)
pdftotext -bbox-layout document.pdf output.xml

# The XML output contains precise coordinates for each text element
\`\`\`

#### Advanced Image Conversion
\`\`\`bash
# Convert to PNG images with specific resolution
pdftoppm -png -r 300 document.pdf output_prefix

# Convert specific page range with high resolution
pdftoppm -png -r 600 -f 1 -l 3 document.pdf high_res_pages

# Convert to JPEG with quality setting
pdftoppm -jpeg -jpegopt quality=85 -r 200 document.pdf jpeg_output
\`\`\`

#### Extract Embedded Images
\`\`\`bash
# Extract all embedded images with metadata
pdfimages -j -p document.pdf page_images

# List image info without extracting
pdfimages -list document.pdf

# Extract images in their original format
pdfimages -all document.pdf images/img
\`\`\`

### qpdf Advanced Features

#### Complex Page Manipulation
\`\`\`bash
# Split PDF into groups of pages
qpdf --split-pages=3 input.pdf output_group_%02d.pdf

# Extract specific pages with complex ranges
qpdf input.pdf --pages input.pdf 1,3-5,8,10-end -- extracted.pdf

# Merge specific pages from multiple PDFs
qpdf --empty --pages doc1.pdf 1-3 doc2.pdf 5-7 doc3.pdf 2,4 -- combined.pdf
\`\`\`

#### PDF Optimization and Repair
\`\`\`bash
# Optimize PDF for web (linearize for streaming)
qpdf --linearize input.pdf optimized.pdf

# Remove unused objects and compress
qpdf --optimize-level=all input.pdf compressed.pdf

# Attempt to repair corrupted PDF structure
qpdf --check input.pdf
qpdf --fix-qdf damaged.pdf repaired.pdf

# Show detailed PDF structure for debugging
qpdf --show-all-pages input.pdf > structure.txt
\`\`\`

#### Advanced Encryption
\`\`\`bash
# Add password protection with specific permissions
qpdf --encrypt user_pass owner_pass 256 --print=none --modify=none -- input.pdf encrypted.pdf

# Check encryption status
qpdf --show-encryption encrypted.pdf

# Remove password protection (requires password)
qpdf --password=secret123 --decrypt encrypted.pdf decrypted.pdf
\`\`\`

## Advanced Python Techniques

### pdfplumber Advanced Features

#### Extract Text with Precise Coordinates
\`\`\`python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    page = pdf.pages[0]
    
    # Extract all text with coordinates
    chars = page.chars
    for char in chars[:10]:  # First 10 characters
        print(f"Char: '{char['text']}' at x:{char['x0']:.1f} y:{char['y0']:.1f}")
    
    # Extract text by bounding box (left, top, right, bottom)
    bbox_text = page.within_bbox((100, 100, 400, 200)).extract_text()
\`\`\`

#### Advanced Table Extraction with Custom Settings
\`\`\`python
import pdfplumber
import pandas as pd

with pdfplumber.open("complex_table.pdf") as pdf:
    page = pdf.pages[0]
    
    # Extract tables with custom settings for complex layouts
    table_settings = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
        "snap_tolerance": 3,
        "intersection_tolerance": 15
    }
    tables = page.extract_tables(table_settings)
    
    # Visual debugging for table extraction
    img = page.to_image(resolution=150)
    img.save("debug_layout.png")
\`\`\`

### reportlab Advanced Features

#### Create Professional Reports with Tables
\`\`\`python
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

# Sample data
data = [
    ['Product', 'Q1', 'Q2', 'Q3', 'Q4'],
    ['Widgets', '120', '135', '142', '158'],
    ['Gadgets', '85', '92', '98', '105']
]

# Create PDF with table
doc = SimpleDocTemplate("report.pdf")
elements = []

# Add title
styles = getSampleStyleSheet()
title = Paragraph("Quarterly Sales Report", styles['Title'])
elements.append(title)

# Add table with advanced styling
table = Table(data)
table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 14),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
    ('GRID', (0, 0), (-1, -1), 1, colors.black)
]))
elements.append(table)

doc.build(elements)
\`\`\`

## Complex Workflows

### Extract Figures/Images from PDF

#### Method 1: Using pdfimages (fastest)
\`\`\`bash
# Extract all images with original quality
pdfimages -all document.pdf images/img
\`\`\`

#### Method 2: Using pypdfium2 + Image Processing
\`\`\`python
import pypdfium2 as pdfium
from PIL import Image
import numpy as np

def extract_figures(pdf_path, output_dir):
    pdf = pdfium.PdfDocument(pdf_path)
    
    for page_num, page in enumerate(pdf):
        # Render high-resolution page
        bitmap = page.render(scale=3.0)
        img = bitmap.to_pil()
        
        # Convert to numpy for processing
        img_array = np.array(img)
        
        # Simple figure detection (non-white regions)
        mask = np.any(img_array != [255, 255, 255], axis=2)
        
        # Find contours and extract bounding boxes
        # (This is simplified - real implementation would need more sophisticated detection)
        
        # Save detected figures
        # ... implementation depends on specific needs
\`\`\`

### Batch PDF Processing with Error Handling
\`\`\`python
import os
import glob
from pypdf import PdfReader, PdfWriter
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def batch_process_pdfs(input_dir, operation='merge'):
    pdf_files = glob.glob(os.path.join(input_dir, "*.pdf"))
    
    if operation == 'merge':
        writer = PdfWriter()
        for pdf_file in pdf_files:
            try:
                reader = PdfReader(pdf_file)
                for page in reader.pages:
                    writer.add_page(page)
                logger.info(f"Processed: {pdf_file}")
            except Exception as e:
                logger.error(f"Failed to process {pdf_file}: {e}")
                continue
        
        with open("batch_merged.pdf", "wb") as output:
            writer.write(output)
    
    elif operation == 'extract_text':
        for pdf_file in pdf_files:
            try:
                reader = PdfReader(pdf_file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                
                output_file = pdf_file.replace('.pdf', '.txt')
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(text)
                logger.info(f"Extracted text from: {pdf_file}")
                
            except Exception as e:
                logger.error(f"Failed to extract text from {pdf_file}: {e}")
                continue
\`\`\`

### Advanced PDF Cropping
\`\`\`python
from pypdf import PdfWriter, PdfReader

reader = PdfReader("input.pdf")
writer = PdfWriter()

# Crop page (left, bottom, right, top in points)
page = reader.pages[0]
page.mediabox.left = 50
page.mediabox.bottom = 50
page.mediabox.right = 550
page.mediabox.top = 750

writer.add_page(page)
with open("cropped.pdf", "wb") as output:
    writer.write(output)
\`\`\`

## Performance Optimization Tips

### 1. For Large PDFs
- Use streaming approaches instead of loading entire PDF in memory
- Use \`qpdf --split-pages\` for splitting large files
- Process pages individually with pypdfium2

### 2. For Text Extraction
- \`pdftotext -bbox-layout\` is fastest for plain text extraction
- Use pdfplumber for structured data and tables
- Avoid \`pypdf.extract_text()\` for very large documents

### 3. For Image Extraction
- \`pdfimages\` is much faster than rendering pages
- Use low resolution for previews, high resolution for final output

### 4. For Form Filling
- pdf-lib maintains form structure better than most alternatives
- Pre-validate form fields before processing

### 5. Memory Management
\`\`\`python
# Process PDFs in chunks
def process_large_pdf(pdf_path, chunk_size=10):
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    
    for start_idx in range(0, total_pages, chunk_size):
        end_idx = min(start_idx + chunk_size, total_pages)
        writer = PdfWriter()
        
        for i in range(start_idx, end_idx):
            writer.add_page(reader.pages[i])
        
        # Process chunk
        with open(f"chunk_{start_idx//chunk_size}.pdf", "wb") as output:
            writer.write(output)
\`\`\`

## Troubleshooting Common Issues

### Encrypted PDFs
\`\`\`python
# Handle password-protected PDFs
from pypdf import PdfReader

try:
    reader = PdfReader("encrypted.pdf")
    if reader.is_encrypted:
        reader.decrypt("password")
except Exception as e:
    print(f"Failed to decrypt: {e}")
\`\`\`

### Corrupted PDFs
\`\`\`bash
# Use qpdf to repair
qpdf --check corrupted.pdf
qpdf --replace-input corrupted.pdf
\`\`\`

### Text Extraction Issues
\`\`\`python
# Fallback to OCR for scanned PDFs
import pytesseract
from pdf2image import convert_from_path

def extract_text_with_ocr(pdf_path):
    images = convert_from_path(pdf_path)
    text = ""
    for i, image in enumerate(images):
        text += pytesseract.image_to_string(image)
    return text
\`\`\`

## License Information

- **pypdf**: BSD License
- **pdfplumber**: MIT License
- **pypdfium2**: Apache/BSD License
- **reportlab**: BSD License
- **poppler-utils**: GPL-2 License
- **qpdf**: Apache License
- **pdf-lib**: MIT License
- **pdfjs-dist**: Apache License`, sortOrder: 0 },
      { id: 'builtin-pdf-handler-ref-1', name: 'forms.md', content: `**CRITICAL: You MUST complete these steps in order. Do not skip ahead to writing code.**

If you need to fill out a PDF form, first check to see if the PDF has fillable form fields. Run this script from this file's directory:
 \`python scripts/check_fillable_fields <file.pdf>\`, and depending on the result go to either the "Fillable fields" or "Non-fillable fields" and follow those instructions.

# Fillable fields
If the PDF has fillable form fields:
- Run this script from this file's directory: \`python scripts/extract_form_field_info.py <input.pdf> <field_info.json>\`. It will create a JSON file with a list of fields in this format:
\`\`\`
[
  {
    "field_id": (unique ID for the field),
    "page": (page number, 1-based),
    "rect": ([left, bottom, right, top] bounding box in PDF coordinates, y=0 is the bottom of the page),
    "type": ("text", "checkbox", "radio_group", or "choice"),
  },
  // Checkboxes have "checked_value" and "unchecked_value" properties:
  {
    "field_id": (unique ID for the field),
    "page": (page number, 1-based),
    "type": "checkbox",
    "checked_value": (Set the field to this value to check the checkbox),
    "unchecked_value": (Set the field to this value to uncheck the checkbox),
  },
  // Radio groups have a "radio_options" list with the possible choices.
  {
    "field_id": (unique ID for the field),
    "page": (page number, 1-based),
    "type": "radio_group",
    "radio_options": [
      {
        "value": (set the field to this value to select this radio option),
        "rect": (bounding box for the radio button for this option)
      },
      // Other radio options
    ]
  },
  // Multiple choice fields have a "choice_options" list with the possible choices:
  {
    "field_id": (unique ID for the field),
    "page": (page number, 1-based),
    "type": "choice",
    "choice_options": [
      {
        "value": (set the field to this value to select this option),
        "text": (display text of the option)
      },
      // Other choice options
    ],
  }
]
\`\`\`
- Convert the PDF to PNGs (one image for each page) with this script (run from this file's directory):
\`python scripts/convert_pdf_to_images.py <file.pdf> <output_directory>\`
Then analyze the images to determine the purpose of each form field (make sure to convert the bounding box PDF coordinates to image coordinates).
- Create a \`field_values.json\` file in this format with the values to be entered for each field:
\`\`\`
[
  {
    "field_id": "last_name", // Must match the field_id from \`extract_form_field_info.py\`
    "description": "The user's last name",
    "page": 1, // Must match the "page" value in field_info.json
    "value": "Simpson"
  },
  {
    "field_id": "Checkbox12",
    "description": "Checkbox to be checked if the user is 18 or over",
    "page": 1,
    "value": "/On" // If this is a checkbox, use its "checked_value" value to check it. If it's a radio button group, use one of the "value" values in "radio_options".
  },
  // more fields
]
\`\`\`
- Run the \`fill_fillable_fields.py\` script from this file's directory to create a filled-in PDF:
\`python scripts/fill_fillable_fields.py <input pdf> <field_values.json> <output pdf>\`
This script will verify that the field IDs and values you provide are valid; if it prints error messages, correct the appropriate fields and try again.

# Non-fillable fields
If the PDF doesn't have fillable form fields, you'll add text annotations. First try to extract coordinates from the PDF structure (more accurate), then fall back to visual estimation if needed.

## Step 1: Try Structure Extraction First

Run this script to extract text labels, lines, and checkboxes with their exact PDF coordinates:
\`python scripts/extract_form_structure.py <input.pdf> form_structure.json\`

This creates a JSON file containing:
- **labels**: Every text element with exact coordinates (x0, top, x1, bottom in PDF points)
- **lines**: Horizontal lines that define row boundaries
- **checkboxes**: Small square rectangles that are checkboxes (with center coordinates)
- **row_boundaries**: Row top/bottom positions calculated from horizontal lines

**Check the results**: If \`form_structure.json\` has meaningful labels (text elements that correspond to form fields), use **Approach A: Structure-Based Coordinates**. If the PDF is scanned/image-based and has few or no labels, use **Approach B: Visual Estimation**.

---

## Approach A: Structure-Based Coordinates (Preferred)

Use this when \`extract_form_structure.py\` found text labels in the PDF.

### A.1: Analyze the Structure

Read form_structure.json and identify:

1. **Label groups**: Adjacent text elements that form a single label (e.g., "Last" + "Name")
2. **Row structure**: Labels with similar \`top\` values are in the same row
3. **Field columns**: Entry areas start after label ends (x0 = label.x1 + gap)
4. **Checkboxes**: Use the checkbox coordinates directly from the structure

**Coordinate system**: PDF coordinates where y=0 is at TOP of page, y increases downward.

### A.2: Check for Missing Elements

The structure extraction may not detect all form elements. Common cases:
- **Circular checkboxes**: Only square rectangles are detected as checkboxes
- **Complex graphics**: Decorative elements or non-standard form controls
- **Faded or light-colored elements**: May not be extracted

If you see form fields in the PDF images that aren't in form_structure.json, you'll need to use **visual analysis** for those specific fields (see "Hybrid Approach" below).

### A.3: Create fields.json with PDF Coordinates

For each field, calculate entry coordinates from the extracted structure:

**Text fields:**
- entry x0 = label x1 + 5 (small gap after label)
- entry x1 = next label's x0, or row boundary
- entry top = same as label top
- entry bottom = row boundary line below, or label bottom + row_height

**Checkboxes:**
- Use the checkbox rectangle coordinates directly from form_structure.json
- entry_bounding_box = [checkbox.x0, checkbox.top, checkbox.x1, checkbox.bottom]

Create fields.json using \`pdf_width\` and \`pdf_height\` (signals PDF coordinates):
\`\`\`json
{
  "pages": [
    {"page_number": 1, "pdf_width": 612, "pdf_height": 792}
  ],
  "form_fields": [
    {
      "page_number": 1,
      "description": "Last name entry field",
      "field_label": "Last Name",
      "label_bounding_box": [43, 63, 87, 73],
      "entry_bounding_box": [92, 63, 260, 79],
      "entry_text": {"text": "Smith", "font_size": 10}
    },
    {
      "page_number": 1,
      "description": "US Citizen Yes checkbox",
      "field_label": "Yes",
      "label_bounding_box": [260, 200, 280, 210],
      "entry_bounding_box": [285, 197, 292, 205],
      "entry_text": {"text": "X"}
    }
  ]
}
\`\`\`

**Important**: Use \`pdf_width\`/\`pdf_height\` and coordinates directly from form_structure.json.

### A.4: Validate Bounding Boxes

Before filling, check your bounding boxes for errors:
\`python scripts/check_bounding_boxes.py fields.json\`

This checks for intersecting bounding boxes and entry boxes that are too small for the font size. Fix any reported errors before filling.

---

## Approach B: Visual Estimation (Fallback)

Use this when the PDF is scanned/image-based and structure extraction found no usable text labels (e.g., all text shows as "(cid:X)" patterns).

### B.1: Convert PDF to Images

\`python scripts/convert_pdf_to_images.py <input.pdf> <images_dir/>\`

### B.2: Initial Field Identification

Examine each page image to identify form sections and get **rough estimates** of field locations:
- Form field labels and their approximate positions
- Entry areas (lines, boxes, or blank spaces for text input)
- Checkboxes and their approximate locations

For each field, note approximate pixel coordinates (they don't need to be precise yet).

### B.3: Zoom Refinement (CRITICAL for accuracy)

For each field, crop a region around the estimated position to refine coordinates precisely.

**Create a zoomed crop using ImageMagick:**
\`\`\`bash
magick <page_image> -crop <width>x<height>+<x>+<y> +repage <crop_output.png>
\`\`\`

Where:
- \`<x>, <y>\` = top-left corner of crop region (use your rough estimate minus padding)
- \`<width>, <height>\` = size of crop region (field area plus ~50px padding on each side)

**Example:** To refine a "Name" field estimated around (100, 150):
\`\`\`bash
magick images_dir/page_1.png -crop 300x80+50+120 +repage crops/name_field.png
\`\`\`

(Note: if the \`magick\` command isn't available, try \`convert\` with the same arguments).

**Examine the cropped image** to determine precise coordinates:
1. Identify the exact pixel where the entry area begins (after the label)
2. Identify where the entry area ends (before next field or edge)
3. Identify the top and bottom of the entry line/box

**Convert crop coordinates back to full image coordinates:**
- full_x = crop_x + crop_offset_x
- full_y = crop_y + crop_offset_y

Example: If the crop started at (50, 120) and the entry box starts at (52, 18) within the crop:
- entry_x0 = 52 + 50 = 102
- entry_top = 18 + 120 = 138

**Repeat for each field**, grouping nearby fields into single crops when possible.

### B.4: Create fields.json with Refined Coordinates

Create fields.json using \`image_width\` and \`image_height\` (signals image coordinates):
\`\`\`json
{
  "pages": [
    {"page_number": 1, "image_width": 1700, "image_height": 2200}
  ],
  "form_fields": [
    {
      "page_number": 1,
      "description": "Last name entry field",
      "field_label": "Last Name",
      "label_bounding_box": [120, 175, 242, 198],
      "entry_bounding_box": [255, 175, 720, 218],
      "entry_text": {"text": "Smith", "font_size": 10}
    }
  ]
}
\`\`\`

**Important**: Use \`image_width\`/\`image_height\` and the refined pixel coordinates from the zoom analysis.

### B.5: Validate Bounding Boxes

Before filling, check your bounding boxes for errors:
\`python scripts/check_bounding_boxes.py fields.json\`

This checks for intersecting bounding boxes and entry boxes that are too small for the font size. Fix any reported errors before filling.

---

## Hybrid Approach: Structure + Visual

Use this when structure extraction works for most fields but misses some elements (e.g., circular checkboxes, unusual form controls).

1. **Use Approach A** for fields that were detected in form_structure.json
2. **Convert PDF to images** for visual analysis of missing fields
3. **Use zoom refinement** (from Approach B) for the missing fields
4. **Combine coordinates**: For fields from structure extraction, use \`pdf_width\`/\`pdf_height\`. For visually-estimated fields, you must convert image coordinates to PDF coordinates:
   - pdf_x = image_x * (pdf_width / image_width)
   - pdf_y = image_y * (pdf_height / image_height)
5. **Use a single coordinate system** in fields.json - convert all to PDF coordinates with \`pdf_width\`/\`pdf_height\`

---

## Step 2: Validate Before Filling

**Always validate bounding boxes before filling:**
\`python scripts/check_bounding_boxes.py fields.json\`

This checks for:
- Intersecting bounding boxes (which would cause overlapping text)
- Entry boxes that are too small for the specified font size

Fix any reported errors in fields.json before proceeding.

## Step 3: Fill the Form

The fill script auto-detects the coordinate system and handles conversion:
\`python scripts/fill_pdf_form_with_annotations.py <input.pdf> fields.json <output.pdf>\`

## Step 4: Verify Output

Convert the filled PDF to images and verify text placement:
\`python scripts/convert_pdf_to_images.py <output.pdf> <verify_images/>\`

If text is mispositioned:
- **Approach A**: Check that you're using PDF coordinates from form_structure.json with \`pdf_width\`/\`pdf_height\`
- **Approach B**: Check that image dimensions match and coordinates are accurate pixels
- **Hybrid**: Ensure coordinate conversions are correct for visually-estimated fields
`, sortOrder: 1 }
    ]
  },
  {
    id: 'builtin-researcher',
    name: 'Researcher',
    description: `Use when the user needs thorough research on a topic — technology comparisons, trend analysis, competitor research, best practices survey, or any question requiring multiple sources. Produces a structured report with citations.

Examples:
- "/researcher React vs Vue 2025" → Launch research on framework comparison
- "이 기술 스택 조사해줘" → Launch researcher
- "경쟁사 분석 해줘" → Launch researcher`,
    instructions: `# Researcher

Conduct multi-source web research on a given topic and produce a structured, citation-backed report.

## Workflow

### 1. Clarify Scope

If the topic is vague, ask the user to narrow down:
- What specific aspect? (기술 비교, 트렌드, 경쟁사, 도입 사례, etc.)
- Target audience or context? (스타트업, 대기업, 개인 프로젝트, etc.)
- Depth? (quick overview vs deep dive)

If the topic is clear enough, proceed directly.

### 2. Research Plan

Before searching, outline 3-5 research angles to cover. For example, a tech comparison might cover:
1. Core features & philosophy
2. Performance benchmarks
3. Ecosystem & community
4. Learning curve & DX
5. Production adoption & case studies

### 3. Multi-Source Search

Execute **5-10 WebSearch queries** from different angles:
- Direct topic searches
- "vs" comparisons
- "{topic} pros cons {current year}"
- "{topic} production experience"
- Reddit/HN discussions for real-world opinions
- Korean sources via Naver/Korean keywords when relevant

For each promising result, use **WebFetch** to extract key details.

### 4. Synthesize

Compile findings into a structured report:

\`\`\`markdown
# Research Report: {Topic}
> Researched: {date}

## TL;DR
{3-5 bullet executive summary}

## {Section 1 — varies by topic}
{Analysis with specific data points}

## {Section 2}
...

## {Section N}
...

## Comparison Table (if applicable)
| Criteria | Option A | Option B | ... |
|---|---|---|---|

## Recommendation
{Clear recommendation with reasoning}
{Conditions or caveats}

## Sources
- [Title](URL) — {1-line summary of what was extracted}
- ...
\`\`\`

### 5. Deliver

- Present the report directly in chat
- If the user wants it saved, write to a file (suggest \`research/{topic-slug}.md\`)

## Research Quality Rules

- **Recency**: Prefer sources from the last 12 months. Flag outdated information.
- **Diversity**: Mix official docs, blog posts, community discussions, benchmarks. Don't rely on a single source.
- **Specificity**: Include concrete numbers (stars, downloads, benchmark results, adoption stats) over vague claims.
- **Honesty**: If information is conflicting or uncertain, say so. Don't present opinions as facts.
- **Attribution**: Every claim should trace back to a source in the Sources section.

## Language

- Write the report in the user's language (Korean if they asked in Korean)
- Keep technical terms in English with Korean explanation where helpful
- Source titles can remain in their original language`,
    sortOrder: -6,
    refs: [
    ]
  },
  {
    id: 'builtin-slide-maker',
    name: 'Slide Maker',
    description: `Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file (even if the extracted content will be used elsewhere, like in an email or summary); editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions "deck," "slides," "presentation," or references a .pptx filename, regardless of what they plan to do with the content afterward. If a .pptx file needs to be opened, created, or touched, use this skill.`,
    instructions: `# PPTX Skill

## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | \`python -m markitdown presentation.pptx\` |
| Edit or create from template | Read [editing.md](editing.md) |
| Create from scratch | Read [pptxgenjs.md](pptxgenjs.md) |

---

## Reading Content

\`\`\`bash
# Text extraction
python -m markitdown presentation.pptx

# Visual overview
python scripts/thumbnail.py presentation.pptx

# Raw XML
python scripts/office/unpack.py presentation.pptx unpacked/
\`\`\`

---

## Editing Workflow

**Read [editing.md](editing.md) for full details.**

1. Analyze template with \`thumbnail.py\`
2. Unpack → manipulate slides → edit content → clean → pack

---

## Creating from Scratch

**Read [pptxgenjs.md](pptxgenjs.md) for full details.**

Use when no template or reference presentation is available.

---

## Design Ideas

**Don't create boring slides.** Plain bullets on a white background won't impress anyone. Consider ideas from this list for each slide.

### Before Starting

- **Pick a bold, content-informed color palette**: The palette should feel designed for THIS topic. If swapping your colors into a completely different presentation would still "work," you haven't made specific enough choices.
- **Dominance over equality**: One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight.
- **Dark/light contrast**: Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure). Or commit to dark throughout for a premium feel.
- **Commit to a visual motif**: Pick ONE distinctive element and repeat it — rounded image frames, icons in colored circles, thick single-side borders. Carry it across every slide.

### Color Palettes

Choose colors that match your topic — don't default to generic blue. Use these palettes as inspiration:

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| **Midnight Executive** | \`1E2761\` (navy) | \`CADCFC\` (ice blue) | \`FFFFFF\` (white) |
| **Forest & Moss** | \`2C5F2D\` (forest) | \`97BC62\` (moss) | \`F5F5F5\` (cream) |
| **Coral Energy** | \`F96167\` (coral) | \`F9E795\` (gold) | \`2F3C7E\` (navy) |
| **Warm Terracotta** | \`B85042\` (terracotta) | \`E7E8D1\` (sand) | \`A7BEAE\` (sage) |
| **Ocean Gradient** | \`065A82\` (deep blue) | \`1C7293\` (teal) | \`21295C\` (midnight) |
| **Charcoal Minimal** | \`36454F\` (charcoal) | \`F2F2F2\` (off-white) | \`212121\` (black) |
| **Teal Trust** | \`028090\` (teal) | \`00A896\` (seafoam) | \`02C39A\` (mint) |
| **Berry & Cream** | \`6D2E46\` (berry) | \`A26769\` (dusty rose) | \`ECE2D0\` (cream) |
| **Sage Calm** | \`84B59F\` (sage) | \`69A297\` (eucalyptus) | \`50808E\` (slate) |
| **Cherry Bold** | \`990011\` (cherry) | \`FCF6F5\` (off-white) | \`2F3C7E\` (navy) |

### For Each Slide

**Every slide needs a visual element** — image, chart, icon, or shape. Text-only slides are forgettable.

**Layout options:**
- Two-column (text left, illustration on right)
- Icon + text rows (icon in colored circle, bold header, description below)
- 2x2 or 2x3 grid (image on one side, grid of content blocks on other)
- Half-bleed image (full left or right side) with content overlay

**Data display:**
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons, side-by-side options)
- Timeline or process flow (numbered steps, arrows)

**Visual polish:**
- Icons in small colored circles next to section headers
- Italic accent text for key stats or taglines

### Typography

**Choose an interesting font pairing** — don't default to Arial. Pick a header font with personality and pair it with a clean body font.

| Header Font | Body Font |
|-------------|-----------|
| Georgia | Calibri |
| Arial Black | Arial |
| Calibri | Calibri Light |
| Cambria | Calibri |
| Trebuchet MS | Calibri |
| Impact | Arial |
| Palatino | Garamond |
| Consolas | Calibri |

| Element | Size |
|---------|------|
| Slide title | 36-44pt bold |
| Section header | 20-24pt bold |
| Body text | 14-16pt |
| Captions | 10-12pt muted |

### Spacing

- 0.5" minimum margins
- 0.3-0.5" between content blocks
- Leave breathing room—don't fill every inch

### Avoid (Common Mistakes)

- **Don't repeat the same layout** — vary columns, cards, and callouts across slides
- **Don't center body text** — left-align paragraphs and lists; center only titles
- **Don't skimp on size contrast** — titles need 36pt+ to stand out from 14-16pt body
- **Don't default to blue** — pick colors that reflect the specific topic
- **Don't mix spacing randomly** — choose 0.3" or 0.5" gaps and use consistently
- **Don't style one slide and leave the rest plain** — commit fully or keep it simple throughout
- **Don't create text-only slides** — add images, icons, charts, or visual elements; avoid plain title + bullets
- **Don't forget text box padding** — when aligning lines or shapes with text edges, set \`margin: 0\` on the text box or offset the shape to account for padding
- **Don't use low-contrast elements** — icons AND text need strong contrast against the background; avoid light text on light backgrounds or dark text on dark backgrounds
- **NEVER use accent lines under titles** — these are a hallmark of AI-generated slides; use whitespace or background color instead

---

## QA (Required)

**Assume there are problems. Your job is to find them.**

Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough.

### Content QA

\`\`\`bash
python -m markitdown output.pptx
\`\`\`

Check for missing content, typos, wrong order.

**When using templates, check for leftover placeholder text:**

\`\`\`bash
python -m markitdown output.pptx | grep -iE "xxxx|lorem|ipsum|this.*(page|slide).*layout"
\`\`\`

If grep returns results, fix them before declaring success.

### Visual QA

**⚠️ USE SUBAGENTS** — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there. Subagents have fresh eyes.

Convert slides to images (see [Converting to Images](#converting-to-images)), then use this prompt:

\`\`\`
Visually inspect these slides. Assume there are issues — find them.

Look for:
- Overlapping elements (text through shapes, lines through words, stacked elements)
- Text overflow or cut off at edges/box boundaries
- Decorative lines positioned for single-line text but title wrapped to two lines
- Source citations or footers colliding with content above
- Elements too close (< 0.3" gaps) or cards/sections nearly touching
- Uneven gaps (large empty area in one place, cramped in another)
- Insufficient margin from slide edges (< 0.5")
- Columns or similar elements not aligned consistently
- Low-contrast text (e.g., light gray text on cream-colored background)
- Low-contrast icons (e.g., dark icons on dark backgrounds without a contrasting circle)
- Text boxes too narrow causing excessive wrapping
- Leftover placeholder content

For each slide, list issues or areas of concern, even if minor.

Read and analyze these images:
1. /path/to/slide-01.jpg (Expected: [brief description])
2. /path/to/slide-02.jpg (Expected: [brief description])

Report ALL issues found, including minor ones.
\`\`\`

### Verification Loop

1. Generate slides → Convert to images → Inspect
2. **List issues found** (if none found, look again more critically)
3. Fix issues
4. **Re-verify affected slides** — one fix often creates another problem
5. Repeat until a full pass reveals no new issues

**Do not declare success until you've completed at least one fix-and-verify cycle.**

---

## Converting to Images

Convert presentations to individual slide images for visual inspection:

\`\`\`bash
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
pdftoppm -jpeg -r 150 output.pdf slide
\`\`\`

This creates \`slide-01.jpg\`, \`slide-02.jpg\`, etc.

To re-render specific slides after fixes:

\`\`\`bash
pdftoppm -jpeg -r 150 -f N -l N output.pdf slide-fixed
\`\`\`

---

## Dependencies

- \`pip install "markitdown[pptx]"\` - text extraction
- \`pip install Pillow\` - thumbnail grids
- \`npm install -g pptxgenjs\` - creating from scratch
- LibreOffice (\`soffice\`) - PDF conversion (auto-configured for sandboxed environments via \`scripts/office/soffice.py\`)
- Poppler (\`pdftoppm\`) - PDF to images`,
    sortOrder: -5,
    refs: [
      { id: 'builtin-slide-maker-ref-0', name: 'editing.md', content: `# Editing Presentations

## Template-Based Workflow

When using an existing presentation as a template:

1. **Analyze existing slides**:
   \`\`\`bash
   python scripts/thumbnail.py template.pptx
   python -m markitdown template.pptx
   \`\`\`
   Review \`thumbnails.jpg\` to see layouts, and markitdown output to see placeholder text.

2. **Plan slide mapping**: For each content section, choose a template slide.

   ⚠️ **USE VARIED LAYOUTS** — monotonous presentations are a common failure mode. Don't default to basic title + bullet slides. Actively seek out:
   - Multi-column layouts (2-column, 3-column)
   - Image + text combinations
   - Full-bleed images with text overlay
   - Quote or callout slides
   - Section dividers
   - Stat/number callouts
   - Icon grids or icon + text rows

   **Avoid:** Repeating the same text-heavy layout for every slide.

   Match content type to layout style (e.g., key points → bullet slide, team info → multi-column, testimonials → quote slide).

3. **Unpack**: \`python scripts/office/unpack.py template.pptx unpacked/\`

4. **Build presentation** (do this yourself, not with subagents):
   - Delete unwanted slides (remove from \`<p:sldIdLst>\`)
   - Duplicate slides you want to reuse (\`add_slide.py\`)
   - Reorder slides in \`<p:sldIdLst>\`
   - **Complete all structural changes before step 5**

5. **Edit content**: Update text in each \`slide{N}.xml\`.
   **Use subagents here if available** — slides are separate XML files, so subagents can edit in parallel.

6. **Clean**: \`python scripts/clean.py unpacked/\`

7. **Pack**: \`python scripts/office/pack.py unpacked/ output.pptx --original template.pptx\`

---

## Scripts

| Script | Purpose |
|--------|---------|
| \`unpack.py\` | Extract and pretty-print PPTX |
| \`add_slide.py\` | Duplicate slide or create from layout |
| \`clean.py\` | Remove orphaned files |
| \`pack.py\` | Repack with validation |
| \`thumbnail.py\` | Create visual grid of slides |

### unpack.py

\`\`\`bash
python scripts/office/unpack.py input.pptx unpacked/
\`\`\`

Extracts PPTX, pretty-prints XML, escapes smart quotes.

### add_slide.py

\`\`\`bash
python scripts/add_slide.py unpacked/ slide2.xml      # Duplicate slide
python scripts/add_slide.py unpacked/ slideLayout2.xml # From layout
\`\`\`

Prints \`<p:sldId>\` to add to \`<p:sldIdLst>\` at desired position.

### clean.py

\`\`\`bash
python scripts/clean.py unpacked/
\`\`\`

Removes slides not in \`<p:sldIdLst>\`, unreferenced media, orphaned rels.

### pack.py

\`\`\`bash
python scripts/office/pack.py unpacked/ output.pptx --original input.pptx
\`\`\`

Validates, repairs, condenses XML, re-encodes smart quotes.

### thumbnail.py

\`\`\`bash
python scripts/thumbnail.py input.pptx [output_prefix] [--cols N]
\`\`\`

Creates \`thumbnails.jpg\` with slide filenames as labels. Default 3 columns, max 12 per grid.

**Use for template analysis only** (choosing layouts). For visual QA, use \`soffice\` + \`pdftoppm\` to create full-resolution individual slide images—see SKILL.md.

---

## Slide Operations

Slide order is in \`ppt/presentation.xml\` → \`<p:sldIdLst>\`.

**Reorder**: Rearrange \`<p:sldId>\` elements.

**Delete**: Remove \`<p:sldId>\`, then run \`clean.py\`.

**Add**: Use \`add_slide.py\`. Never manually copy slide files—the script handles notes references, Content_Types.xml, and relationship IDs that manual copying misses.

---

## Editing Content

**Subagents:** If available, use them here (after completing step 4). Each slide is a separate XML file, so subagents can edit in parallel. In your prompt to subagents, include:
- The slide file path(s) to edit
- **"Use the Edit tool for all changes"**
- The formatting rules and common pitfalls below

For each slide:
1. Read the slide's XML
2. Identify ALL placeholder content—text, images, charts, icons, captions
3. Replace each placeholder with final content

**Use the Edit tool, not sed or Python scripts.** The Edit tool forces specificity about what to replace and where, yielding better reliability.

### Formatting Rules

- **Bold all headers, subheadings, and inline labels**: Use \`b="1"\` on \`<a:rPr>\`. This includes:
  - Slide titles
  - Section headers within a slide
  - Inline labels like (e.g.: "Status:", "Description:") at the start of a line
- **Never use unicode bullets (•)**: Use proper list formatting with \`<a:buChar>\` or \`<a:buAutoNum>\`
- **Bullet consistency**: Let bullets inherit from the layout. Only specify \`<a:buChar>\` or \`<a:buNone>\`.

---

## Common Pitfalls

### Template Adaptation

When source content has fewer items than the template:
- **Remove excess elements entirely** (images, shapes, text boxes), don't just clear text
- Check for orphaned visuals after clearing text content
- Run visual QA to catch mismatched counts

When replacing text with different length content:
- **Shorter replacements**: Usually safe
- **Longer replacements**: May overflow or wrap unexpectedly
- Test with visual QA after text changes
- Consider truncating or splitting content to fit the template's design constraints

**Template slots ≠ Source items**: If template has 4 team members but source has 3 users, delete the 4th member's entire group (image + text boxes), not just the text.

### Multi-Item Content

If source has multiple items (numbered lists, multiple sections), create separate \`<a:p>\` elements for each — **never concatenate into one string**.

**❌ WRONG** — all items in one paragraph:
\`\`\`xml
<a:p>
  <a:r><a:rPr .../><a:t>Step 1: Do the first thing. Step 2: Do the second thing.</a:t></a:r>
</a:p>
\`\`\`

**✅ CORRECT** — separate paragraphs with bold headers:
\`\`\`xml
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="en-US" sz="2799" b="1" .../><a:t>Step 1</a:t></a:r>
</a:p>
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="en-US" sz="2799" .../><a:t>Do the first thing.</a:t></a:r>
</a:p>
<a:p>
  <a:pPr algn="l"><a:lnSpc><a:spcPts val="3919"/></a:lnSpc></a:pPr>
  <a:r><a:rPr lang="en-US" sz="2799" b="1" .../><a:t>Step 2</a:t></a:r>
</a:p>
<!-- continue pattern -->
\`\`\`

Copy \`<a:pPr>\` from the original paragraph to preserve line spacing. Use \`b="1"\` on headers.

### Smart Quotes

Handled automatically by unpack/pack. But the Edit tool converts smart quotes to ASCII.

**When adding new text with quotes, use XML entities:**

\`\`\`xml
<a:t>the &#x201C;Agreement&#x201D;</a:t>
\`\`\`

| Character | Name | Unicode | XML Entity |
|-----------|------|---------|------------|
| \`“\` | Left double quote | U+201C | \`&#x201C;\` |
| \`”\` | Right double quote | U+201D | \`&#x201D;\` |
| \`‘\` | Left single quote | U+2018 | \`&#x2018;\` |
| \`’\` | Right single quote | U+2019 | \`&#x2019;\` |

### Other

- **Whitespace**: Use \`xml:space="preserve"\` on \`<a:t>\` with leading/trailing spaces
- **XML parsing**: Use \`defusedxml.minidom\`, not \`xml.etree.ElementTree\` (corrupts namespaces)
`, sortOrder: 0 },
      { id: 'builtin-slide-maker-ref-1', name: 'pptxgenjs.md', content: `# PptxGenJS Tutorial

## Setup & Basic Structure

\`\`\`javascript
const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';  // or 'LAYOUT_16x10', 'LAYOUT_4x3', 'LAYOUT_WIDE'
pres.author = 'Your Name';
pres.title = 'Presentation Title';

let slide = pres.addSlide();
slide.addText("Hello World!", { x: 0.5, y: 0.5, fontSize: 36, color: "363636" });

pres.writeFile({ fileName: "Presentation.pptx" });
\`\`\`

## Layout Dimensions

Slide dimensions (coordinates in inches):
- \`LAYOUT_16x9\`: 10" × 5.625" (default)
- \`LAYOUT_16x10\`: 10" × 6.25"
- \`LAYOUT_4x3\`: 10" × 7.5"
- \`LAYOUT_WIDE\`: 13.3" × 7.5"

---

## Text & Formatting

\`\`\`javascript
// Basic text
slide.addText("Simple Text", {
  x: 1, y: 1, w: 8, h: 2, fontSize: 24, fontFace: "Arial",
  color: "363636", bold: true, align: "center", valign: "middle"
});

// Character spacing (use charSpacing, not letterSpacing which is silently ignored)
slide.addText("SPACED TEXT", { x: 1, y: 1, w: 8, h: 1, charSpacing: 6 });

// Rich text arrays
slide.addText([
  { text: "Bold ", options: { bold: true } },
  { text: "Italic ", options: { italic: true } }
], { x: 1, y: 3, w: 8, h: 1 });

// Multi-line text (requires breakLine: true)
slide.addText([
  { text: "Line 1", options: { breakLine: true } },
  { text: "Line 2", options: { breakLine: true } },
  { text: "Line 3" }  // Last item doesn't need breakLine
], { x: 0.5, y: 0.5, w: 8, h: 2 });

// Text box margin (internal padding)
slide.addText("Title", {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  margin: 0  // Use 0 when aligning text with other elements like shapes or icons
});
\`\`\`

**Tip:** Text boxes have internal margin by default. Set \`margin: 0\` when you need text to align precisely with shapes, lines, or icons at the same x-position.

---

## Lists & Bullets

\`\`\`javascript
// ✅ CORRECT: Multiple bullets
slide.addText([
  { text: "First item", options: { bullet: true, breakLine: true } },
  { text: "Second item", options: { bullet: true, breakLine: true } },
  { text: "Third item", options: { bullet: true } }
], { x: 0.5, y: 0.5, w: 8, h: 3 });

// ❌ WRONG: Never use unicode bullets
slide.addText("• First item", { ... });  // Creates double bullets

// Sub-items and numbered lists
{ text: "Sub-item", options: { bullet: true, indentLevel: 1 } }
{ text: "First", options: { bullet: { type: "number" }, breakLine: true } }
\`\`\`

---

## Shapes

\`\`\`javascript
slide.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 0.8, w: 1.5, h: 3.0,
  fill: { color: "FF0000" }, line: { color: "000000", width: 2 }
});

slide.addShape(pres.shapes.OVAL, { x: 4, y: 1, w: 2, h: 2, fill: { color: "0000FF" } });

slide.addShape(pres.shapes.LINE, {
  x: 1, y: 3, w: 5, h: 0, line: { color: "FF0000", width: 3, dashType: "dash" }
});

// With transparency
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "0088CC", transparency: 50 }
});

// Rounded rectangle (rectRadius only works with ROUNDED_RECTANGLE, not RECTANGLE)
// ⚠️ Don't pair with rectangular accent overlays — they won't cover rounded corners. Use RECTANGLE instead.
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" }, rectRadius: 0.1
});

// With shadow
slide.addShape(pres.shapes.RECTANGLE, {
  x: 1, y: 1, w: 3, h: 2,
  fill: { color: "FFFFFF" },
  shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.15 }
});
\`\`\`

Shadow options:

| Property | Type | Range | Notes |
|----------|------|-------|-------|
| \`type\` | string | \`"outer"\`, \`"inner"\` | |
| \`color\` | string | 6-char hex (e.g. \`"000000"\`) | No \`#\` prefix, no 8-char hex — see Common Pitfalls |
| \`blur\` | number | 0-100 pt | |
| \`offset\` | number | 0-200 pt | **Must be non-negative** — negative values corrupt the file |
| \`angle\` | number | 0-359 degrees | Direction the shadow falls (135 = bottom-right, 270 = upward) |
| \`opacity\` | number | 0.0-1.0 | Use this for transparency, never encode in color string |

To cast a shadow upward (e.g. on a footer bar), use \`angle: 270\` with a positive offset — do **not** use a negative offset.

**Note**: Gradient fills are not natively supported. Use a gradient image as a background instead.

---

## Images

### Image Sources

\`\`\`javascript
// From file path
slide.addImage({ path: "images/chart.png", x: 1, y: 1, w: 5, h: 3 });

// From URL
slide.addImage({ path: "https://example.com/image.jpg", x: 1, y: 1, w: 5, h: 3 });

// From base64 (faster, no file I/O)
slide.addImage({ data: "image/png;base64,iVBORw0KGgo...", x: 1, y: 1, w: 5, h: 3 });
\`\`\`

### Image Options

\`\`\`javascript
slide.addImage({
  path: "image.png",
  x: 1, y: 1, w: 5, h: 3,
  rotate: 45,              // 0-359 degrees
  rounding: true,          // Circular crop
  transparency: 50,        // 0-100
  flipH: true,             // Horizontal flip
  flipV: false,            // Vertical flip
  altText: "Description",  // Accessibility
  hyperlink: { url: "https://example.com" }
});
\`\`\`

### Image Sizing Modes

\`\`\`javascript
// Contain - fit inside, preserve ratio
{ sizing: { type: 'contain', w: 4, h: 3 } }

// Cover - fill area, preserve ratio (may crop)
{ sizing: { type: 'cover', w: 4, h: 3 } }

// Crop - cut specific portion
{ sizing: { type: 'crop', x: 0.5, y: 0.5, w: 2, h: 2 } }
\`\`\`

### Calculate Dimensions (preserve aspect ratio)

\`\`\`javascript
const origWidth = 1978, origHeight = 923, maxHeight = 3.0;
const calcWidth = maxHeight * (origWidth / origHeight);
const centerX = (10 - calcWidth) / 2;

slide.addImage({ path: "image.png", x: centerX, y: 1.2, w: calcWidth, h: maxHeight });
\`\`\`

### Supported Formats

- **Standard**: PNG, JPG, GIF (animated GIFs work in Microsoft 365)
- **SVG**: Works in modern PowerPoint/Microsoft 365

---

## Icons

Use react-icons to generate SVG icons, then rasterize to PNG for universal compatibility.

### Setup

\`\`\`javascript
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaCheckCircle, FaChartLine } = require("react-icons/fa");

function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}
\`\`\`

### Add Icon to Slide

\`\`\`javascript
const iconData = await iconToBase64Png(FaCheckCircle, "#4472C4", 256);

slide.addImage({
  data: iconData,
  x: 1, y: 1, w: 0.5, h: 0.5  // Size in inches
});
\`\`\`

**Note**: Use size 256 or higher for crisp icons. The size parameter controls the rasterization resolution, not the display size on the slide (which is set by \`w\` and \`h\` in inches).

### Icon Libraries

Install: \`npm install -g react-icons react react-dom sharp\`

Popular icon sets in react-icons:
- \`react-icons/fa\` - Font Awesome
- \`react-icons/md\` - Material Design
- \`react-icons/hi\` - Heroicons
- \`react-icons/bi\` - Bootstrap Icons

---

## Slide Backgrounds

\`\`\`javascript
// Solid color
slide.background = { color: "F1F1F1" };

// Color with transparency
slide.background = { color: "FF3399", transparency: 50 };

// Image from URL
slide.background = { path: "https://example.com/bg.jpg" };

// Image from base64
slide.background = { data: "image/png;base64,iVBORw0KGgo..." };
\`\`\`

---

## Tables

\`\`\`javascript
slide.addTable([
  ["Header 1", "Header 2"],
  ["Cell 1", "Cell 2"]
], {
  x: 1, y: 1, w: 8, h: 2,
  border: { pt: 1, color: "999999" }, fill: { color: "F1F1F1" }
});

// Advanced with merged cells
let tableData = [
  [{ text: "Header", options: { fill: { color: "6699CC" }, color: "FFFFFF", bold: true } }, "Cell"],
  [{ text: "Merged", options: { colspan: 2 } }]
];
slide.addTable(tableData, { x: 1, y: 3.5, w: 8, colW: [4, 4] });
\`\`\`

---

## Charts

\`\`\`javascript
// Bar chart
slide.addChart(pres.charts.BAR, [{
  name: "Sales", labels: ["Q1", "Q2", "Q3", "Q4"], values: [4500, 5500, 6200, 7100]
}], {
  x: 0.5, y: 0.6, w: 6, h: 3, barDir: 'col',
  showTitle: true, title: 'Quarterly Sales'
});

// Line chart
slide.addChart(pres.charts.LINE, [{
  name: "Temp", labels: ["Jan", "Feb", "Mar"], values: [32, 35, 42]
}], { x: 0.5, y: 4, w: 6, h: 3, lineSize: 3, lineSmooth: true });

// Pie chart
slide.addChart(pres.charts.PIE, [{
  name: "Share", labels: ["A", "B", "Other"], values: [35, 45, 20]
}], { x: 7, y: 1, w: 5, h: 4, showPercent: true });
\`\`\`

### Better-Looking Charts

Default charts look dated. Apply these options for a modern, clean appearance:

\`\`\`javascript
slide.addChart(pres.charts.BAR, chartData, {
  x: 0.5, y: 1, w: 9, h: 4, barDir: "col",

  // Custom colors (match your presentation palette)
  chartColors: ["0D9488", "14B8A6", "5EEAD4"],

  // Clean background
  chartArea: { fill: { color: "FFFFFF" }, roundedCorners: true },

  // Muted axis labels
  catAxisLabelColor: "64748B",
  valAxisLabelColor: "64748B",

  // Subtle grid (value axis only)
  valGridLine: { color: "E2E8F0", size: 0.5 },
  catGridLine: { style: "none" },

  // Data labels on bars
  showValue: true,
  dataLabelPosition: "outEnd",
  dataLabelColor: "1E293B",

  // Hide legend for single series
  showLegend: false,
});
\`\`\`

**Key styling options:**
- \`chartColors: [...]\` - hex colors for series/segments
- \`chartArea: { fill, border, roundedCorners }\` - chart background
- \`catGridLine/valGridLine: { color, style, size }\` - grid lines (\`style: "none"\` to hide)
- \`lineSmooth: true\` - curved lines (line charts)
- \`legendPos: "r"\` - legend position: "b", "t", "l", "r", "tr"

---

## Slide Masters

\`\`\`javascript
pres.defineSlideMaster({
  title: 'TITLE_SLIDE', background: { color: '283A5E' },
  objects: [{
    placeholder: { options: { name: 'title', type: 'title', x: 1, y: 2, w: 8, h: 2 } }
  }]
});

let titleSlide = pres.addSlide({ masterName: "TITLE_SLIDE" });
titleSlide.addText("My Title", { placeholder: "title" });
\`\`\`

---

## Common Pitfalls

⚠️ These issues cause file corruption, visual bugs, or broken output. Avoid them.

1. **NEVER use "#" with hex colors** - causes file corruption
   \`\`\`javascript
   color: "FF0000"      // ✅ CORRECT
   color: "#FF0000"     // ❌ WRONG
   \`\`\`

2. **NEVER encode opacity in hex color strings** - 8-char colors (e.g., \`"00000020"\`) corrupt the file. Use the \`opacity\` property instead.
   \`\`\`javascript
   shadow: { type: "outer", blur: 6, offset: 2, color: "00000020" }          // ❌ CORRUPTS FILE
   shadow: { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.12 }  // ✅ CORRECT
   \`\`\`

3. **Use \`bullet: true\`** - NEVER unicode symbols like "•" (creates double bullets)

4. **Use \`breakLine: true\`** between array items or text runs together

5. **Avoid \`lineSpacing\` with bullets** - causes excessive gaps; use \`paraSpaceAfter\` instead

6. **Each presentation needs fresh instance** - don't reuse \`pptxgen()\` objects

7. **NEVER reuse option objects across calls** - PptxGenJS mutates objects in-place (e.g. converting shadow values to EMU). Sharing one object between multiple calls corrupts the second shape.
   \`\`\`javascript
   const shadow = { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 };
   slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });  // ❌ second call gets already-converted values
   slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });

   const makeShadow = () => ({ type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 });
   slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });  // ✅ fresh object each time
   slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });
   \`\`\`

8. **Don't use \`ROUNDED_RECTANGLE\` with accent borders** - rectangular overlay bars won't cover rounded corners. Use \`RECTANGLE\` instead.
   \`\`\`javascript
   // ❌ WRONG: Accent bar doesn't cover rounded corners
   slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1, y: 1, w: 3, h: 1.5, fill: { color: "FFFFFF" } });
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 0.08, h: 1.5, fill: { color: "0891B2" } });

   // ✅ CORRECT: Use RECTANGLE for clean alignment
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 3, h: 1.5, fill: { color: "FFFFFF" } });
   slide.addShape(pres.shapes.RECTANGLE, { x: 1, y: 1, w: 0.08, h: 1.5, fill: { color: "0891B2" } });
   \`\`\`

---

## Quick Reference

- **Shapes**: RECTANGLE, OVAL, LINE, ROUNDED_RECTANGLE
- **Charts**: BAR, LINE, PIE, DOUGHNUT, SCATTER, BUBBLE, RADAR
- **Layouts**: LAYOUT_16x9 (10"×5.625"), LAYOUT_16x10, LAYOUT_4x3, LAYOUT_WIDE
- **Alignment**: "left", "center", "right"
- **Chart data labels**: "outEnd", "inEnd", "center"
`, sortOrder: 1 }
    ]
  },
  {
    id: 'builtin-transport-search',
    name: 'Transport Search',
    description: `브라우저를 직접 열어 항공권, 기차, 고속버스, 배편 등 모든 교통편을 실시간 검색하고 스크린샷으로 결과를 확인하는 스킬. 출발지/목적지/날짜/인원을 받아 최적 교통편을 찾을 때 사용. 항공권 가격 비교, 열차 시간표, 고속버스 예약, 페리 운항 조회 등 모든 교통 관련 검색에 트리거. "비행기 찾아줘", "기차편 알아봐", "배편 있어?", "이동 방법 검색해줘" 등의 요청에 사용.`,
    instructions: `# Transport Search

브라우저 자동화로 실시간 교통편을 검색한다. 모든 결과는 스크린샷으로 확인.

## 공통 워크플로우

1. 출발지 / 목적지 / 날짜 / 인원 확인 (없으면 물어보기)
2. 교통편 유형 판단 → 해당 사이트 열기
3. 페이지 로딩 기다린 후 스크린샷
4. 결과 읽어서 가격/시간/항공사 등 요약 전달
5. 필요시 날짜 바꿔 재검색 비교

## 교통편별 검색 사이트

### ✈️ 항공권

**국제선 (스카이스캐너)**
\`\`\`
https://www.skyscanner.co.kr/transport/flights/{출발IATA}/{도착IATA}/{YYMMDD출발}/{YYMMDD귀국}/?adults={인원}&cabinclass=economy
\`\`\`
예: ICN→OKA, 2인, 4/17 출발 4/20 귀국
→ \`https://www.skyscanner.co.kr/transport/flights/ICN/OKA/260417/260420/?adults=2&cabinclass=economy\`

**국내선 (네이버 항공)**
\`\`\`
https://flight.naver.com/flights/domestic/{출발공항}-{도착공항}-{YYYYMMDD}?adult={인원}
\`\`\`

**주요 IATA 코드 참고:** → \`references/iata-codes.md\`

### 🚄 기차 (KTX/ITX/무궁화)

**코레일 승차권 조회**
\`\`\`
https://www.korail.com/ticket/main
\`\`\`
- 검색창에 출발역 / 도착역 / 날짜 입력 필요 → 브라우저 \`fill\`, \`click\` 사용
- 또는 레츠코레일 앱이 더 빠를 수 있음

**네이버 기차 조회 (더 간편)**
\`\`\`
https://search.naver.com/search.naver?query={출발역}+{도착역}+기차+{날짜}
\`\`\`

### 🚌 고속버스/시외버스

**고속버스 통합예매**
\`\`\`
https://www.kobus.co.kr/web/reservation/step1.do
\`\`\`

**네이버 버스 조회**
\`\`\`
https://search.naver.com/search.naver?query={출발지}+{도착지}+고속버스+{날짜}
\`\`\`

### ⛴️ 배편 (페리)

**국내 여객선**
\`\`\`
https://www.ferry.or.kr (한국해운조합)
\`\`\`

**일본 페리 (부산→후쿠오카 등)**
\`\`\`
https://www.camellia-line.co.kr (카멜리아라인)
https://www.panstarline.co.kr (팬스타라인)
\`\`\`

**제주 배편**
\`\`\`
https://search.naver.com/search.naver?query=제주+배편+{날짜}
\`\`\`

## 브라우저 사용 요령

- \`profile: openclaw\` 사용
- 페이지 로딩 후 **2~3초 대기** 후 screenshot
- 로그인 팝업 뜨면 \`click\`으로 닫기 또는 무시하고 뒤 결과 읽기
- 캡챠 막히면 → 네이버 항공이나 다른 사이트로 전환
- 결과가 JS 렌더링이라 \`web_fetch\` 안됨 → 반드시 브라우저 사용

## 결과 전달 형식

검색 후 아래 형식으로 요약:

\`\`\`
[항공사/교통사] 출발시간 → 도착시간 (소요시간)
가격: ₩XXX,XXX (1인 / 왕복)
경유: 있음/없음
\`\`\`

여러 옵션이 있으면 **최저가 3개** 위주로 정리.  
날짜별 가격 차이가 있으면 비교표도 제공.

## 주의사항

- 스카이스캐너는 **성인 수(adults)** URL 파라미터로 제어 가능
- 코레일/고속버스는 직접 폼 조작 필요 → \`act\` 사용
- 가격은 실시간 변동 → 캡처 시점 기준임을 고지
- 국제운전면허 필요 여부 등 부가정보도 함께 안내`,
    sortOrder: -4,
    refs: [
      { id: 'builtin-transport-search-ref-0', name: 'references/iata-codes.md', content: `# 주요 IATA 공항 코드

## 한국
| 공항 | 코드 |
|------|------|
| 인천국제공항 | ICN |
| 김포국제공항 | GMP |
| 김해국제공항 | PUS |
| 제주국제공항 | CJU |
| 청주국제공항 | CJJ |
| 대구국제공항 | TAE |

## 일본
| 공항 | 코드 |
|------|------|
| 도쿄 나리타 | NRT |
| 도쿄 하네다 | HND |
| 오사카 간사이 | KIX |
| 오사카 이타미 | ITM |
| 후쿠오카 | FUK |
| 삿포로 신치토세 | CTS |
| 오키나와 나하 | OKA |
| 미야코지마 | MMY |
| 이시가키 | ISG |
| 나고야 주부 | NGO |
| 히로시마 | HIJ |
| 오이타 | OIT |

## 동남아
| 공항 | 코드 |
|------|------|
| 방콕 수완나품 | BKK |
| 방콕 돈므앙 | DMK |
| 싱가포르 창이 | SIN |
| 쿠알라룸푸르 | KUL |
| 발리 응우라라이 | DPS |
| 하노이 노이바이 | HAN |
| 호치민 탄손녓 | SGN |
| 다낭 | DAD |
| 세부 막탄 | CEB |
| 마닐라 니노이아키노 | MNL |

## 중국
| 공항 | 코드 |
|------|------|
| 베이징 수도 | PEK |
| 베이징 다싱 | PKX |
| 상하이 푸동 | PVG |
| 상하이 훙차오 | SHA |
| 광저우 바이윈 | CAN |

## 유럽/미주
| 공항 | 코드 |
|------|------|
| 런던 히드로 | LHR |
| 파리 샤를드골 | CDG |
| 프랑크푸르트 | FRA |
| 뉴욕 JFK | JFK |
| LA 국제공항 | LAX |

## 한국 주요 기차역 (코레일 검색용)
| 역명 | 비고 |
|------|------|
| 서울 | KTX 주요 출발역 |
| 수서 | SRT 전용 |
| 용산 | ITX/무궁화 |
| 부산 | 종착역 |
| 동대구 | 대구권 |
| 광주송정 | 호남선 |
| 목포 | 호남선 종착 |
| 강릉 | 강릉선 KTX |
| 춘천 | ITX-청춘 |
| 여수엑스포 | 전라선 종착 |
`, sortOrder: 0 }
    ]
  },
  {
    id: 'builtin-travel-planner',
    name: 'Travel Planner',
    description: `여행 플래너. "여행 가고 싶다", "어디 가면 좋을까", "XX 여행 계획 짜줘" 등의 요청에 트리거. 목적지/동행/날짜/예산을 파악하고, 날씨·시즌·현지 이벤트·공휴일·교통편·숙박·비용을 종합 조사해 최적의 여행 플랜을 제안. 긍정/부정 이벤트(축제, 골든위크, 장마, 태풍 등) 체크 포함. transport-search 스킬과 연계해 실제 교통편 가격도 조회.`,
    instructions: `# Travel Planner

여행 요청을 받으면 단계적으로 조사해 비용·시간 최적화된 풀 플랜을 제공한다.

## Step 1: 기본 정보 파악

요청에서 아래 항목을 추출. 없으면 바로 물어보기.

- **목적지**: 확정 or 미정 (미정이면 후보 제안)
- **동행**: 혼자 / 커플 / 가족 / 친구 (인원 수)
- **날짜**: 확정 / 유동적 (유동적이면 최적 시기 추천)
- **기간**: 1박2일 / 2박3일 / 3박4일 등
- **예산**: 절약형 / 중급 / 프리미엄 (or 구체적 금액)
- **우선순위**: 가격 / 날씨 / 액티비티 / 휴식 중 무엇이 가장 중요한지

한 번에 너무 많이 묻지 말 것. 2~3개씩 자연스럽게.

## Step 2: 시기 검토

날짜가 확정이면 해당 시기를 검토. 유동적이면 최적 시기를 찾아 추천.

### 체크리스트
- [ ] **날씨/시즌**: 우기·건기·태풍 시즌·꽃 시즌 등
- [ ] **한국 공휴일**: 연휴 앞뒤 여부 (항공권 가격 폭등 구간)
- [ ] **현지 공휴일**: 골든위크(일본), 국경절(중국), 송끄란(태양력 새해) 등
- [ ] **긍정적 이벤트**: 축제, 벚꽃 시즌, 단풍, 특산물 제철
- [ ] **부정적 이벤트**: 태풍, 장마, 폭염, 대규모 행사로 인한 숙박 폭등

조회 방법: \`web_fetch\` 또는 \`browser\`로 현지 이벤트 검색.

참고 → \`references/holidays.md\`

## Step 3: 교통편 조사

\`transport-search\` 스킬과 연계해 실제 가격 조회.

- 출발지: 기본값 서울(인천/김포)
- 날짜 2~3개 비교해서 최저가 구간 찾기
- 경유 vs 직항 비교
- 현지 이동 수단도 제안 (렌터카, 대중교통, 투어버스 등)

## Step 4: 숙박 조사

\`browser\`로 아고다/부킹닷컴 검색 또는 web_fetch.

- 위치 우선순위: 관광지 중심 vs 공항 근처 vs 해변
- 동행 유형에 맞는 숙소 (커플→분위기, 가족→넓이, 혼자→가성비)
- 3개 등급(절약/중급/프리미엄) 옵션 제시

## Step 5: 비용 종합

2인 기준 표로 정리.

| 항목 | 절약형 | 중급 | 프리미엄 |
|------|--------|------|---------|
| 항공 | | | |
| 숙박 | | | |
| 현지교통 | | | |
| 식비+액티비티 | | | |
| **합계** | | | |

## Step 6: 일정 플랜

Day-by-Day 타임라인 제시.

\`\`\`
Day 1 — 이동 + 도착
  오전: 출발
  오후: 도착, 체크인
  저녁: 첫 식사 추천

Day 2 — 메인 관광
  ...

Day N — 귀국
  오전: 체크아웃
  ...귀국
\`\`\`

## Step 7: 예약 체크리스트

플랜 완성 후 아래 항목으로 마무리.

\`\`\`
□ 항공권 예매 (링크 제공)
□ 숙박 예약 (링크 제공)
□ 현지 렌터카 / 투어 예약
□ 국제운전면허증 (필요시)
□ 여행자보험
□ 환전 or 트래블카드
□ 비자 (필요시)
□ 현지 심카드 or 포켓와이파이
\`\`\`

## 출력 원칙

- 정보가 불확실하면 추정치임을 명시
- 가격은 실시간 변동 → 캡처 시점 기준 고지
- 한 번에 너무 많은 정보 주지 말고 단계별로 확인받으며 진행
- 사용자가 "그냥 다 짜줘"라고 하면 → 합리적 기본값으로 풀 플랜 바로 제시`,
    sortOrder: -3,
    refs: [
      { id: 'builtin-travel-planner-ref-0', name: 'references/holidays.md', content: `# 여행 시 주의할 공휴일 & 이벤트

## 한국 출발 기준 성수기 구간

| 시기 | 내용 | 영향 |
|------|------|------|
| 설 연휴 | 1월 말~2월 초 | 항공 폭등, 현지 한국인 급증 |
| 3·1절 | 3월 1일 전후 주말 | 단기 여행 수요 증가 |
| 어린이날 | 5월 5일 전후 | 가족 여행 성수기 |
| 추석 연휴 | 9~10월 중순 | 최대 성수기, 가격 최고점 |
| 크리스마스·연말 | 12월 말 | 항공 폭등 |

## 일본 공휴일

| 시기 | 내용 | 주의 |
|------|------|------|
| 골든위크 | 4/29~5/6 | 항공·숙박 2~3배, 관광지 극혼잡 |
| 오봉 | 8/13~8/15 | 국내 이동 많아 숙박 구하기 어려움 |
| 연말연시 | 12/29~1/3 | 대부분 시설 휴업 |
| 체육의 날 | 10월 두 번째 월요일 | 소규모 연휴 |
| 실버위크 | 9월 중순 (해에 따라) | 5일 연휴 되는 해 있음 |

## 동남아 주의 시기

| 국가 | 시기 | 내용 |
|------|------|------|
| 태국 | 4/13~4/15 | 송끄란(물축제), 물난리+혼잡, 교통 마비 |
| 베트남 | 1월 말~2월 초 | 뗏(설날), 대부분 상점 휴업 |
| 인도네시아 | 이슬람력 기준 | 르바란(라마단 종료), 항공 폭등 |
| 중국 | 10/1~10/7 | 국경절 황금연휴, 관광지 극혼잡 |
| 중국 | 1월 말~2월 초 | 춘절, 중국인 해외여행 폭증 |

## 날씨 주의 시기

| 지역 | 시기 | 내용 |
|------|------|------|
| 일본 오키나와/미야코지마 | 5월 중순~6월 | 장마 |
| 일본 전역 | 7~9월 | 태풍 시즌 |
| 동남아 | 6~10월 | 우기 (국가별 상이) |
| 제주도 | 7~8월 | 태풍, 폭우 잦음 |
| 유럽 | 7~8월 | 폭염, 관광 극성수기 |

## 긍정적 이벤트 (여행 이유가 되는 것들)

| 지역 | 시기 | 이벤트 |
|------|------|--------|
| 일본 | 3월 말~4월 초 | 벚꽃 시즌 |
| 일본 | 11월 | 단풍 시즌 |
| 미야코지마 | 10월 | 재즈 페스티벌 |
| 가평 자라섬 | 10월 | 자라섬 재즈 페스티벌 |
| 제주 | 4~5월 | 유채꽃 |
| 네덜란드 | 4~5월 | 튤립 시즌 |
| 스위스 | 12~2월 | 스키 시즌 |
| 태국 | 4/13 | 송끄란 (물축제 즐기러 가는 사람도 있음) |
`, sortOrder: 0 }
    ]
  },
  {
    id: 'builtin-trend-tracker',
    name: 'Trend Tracker',
    description: `오늘의 트렌드를 조사한다. Google Trends(한국/글로벌), Reddit 인기 글에서 실시간 트렌드 수집. "트렌드 알려줘", "요즘 뭐가 핫해?", "인기 키워드", "오늘의 이슈" 등의 요청에 트리거.`,
    instructions: `# Trend Tracker

Google Trends + Reddit에서 실시간 트렌드를 수집하는 스킬.

## 사용법

\`\`\`bash
# 텍스트 출력 (한국)
python3 scripts/research.py KR text

# JSON 출력 (파이프라인용)
python3 scripts/research.py KR json

# 미국 트렌드
python3 scripts/research.py US text
\`\`\`

## 데이터 소스

- **Google Trends**: 일간 인기 검색어 + 관련 뉴스 (RSS)
- **Reddit**: r/popular 일간 인기 글 (JSON API)

## 파이프라인 연동

JSON 출력 시 다음 구조:
\`\`\`json
{
  "date": "ISO날짜",
  "geo": "KR",
  "google_trends": [{"keyword": "...", "traffic": "...", "news": [...]}],
  "reddit": [{"title": "...", "subreddit": "...", "score": 0}]
}
\`\`\`

트렌드 데이터를 기반으로 영상 스크립트 생성, 콘텐츠 기획 등에 활용.`,
    sortOrder: -2,
    refs: [
      { id: 'builtin-trend-tracker-ref-0', name: 'scripts/research.py', content: `#!/usr/bin/env python3
"""
트렌드 리서치 스크립트
Google Trends, Reddit에서 오늘의 트렌드를 수집한다.
Usage: python3 research.py [geo] [format]
  geo: KR (기본), US, JP 등
  format: text (기본), json
"""

import json
import sys
import urllib.request
from datetime import datetime
from xml.etree import ElementTree


def fetch(url, headers=None):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None


def google_trends_daily(geo="KR"):
    """Google Trends 일간 트렌드 (RSS)"""
    url = f"https://trends.google.com/trending/rss?geo={geo}"
    xml = fetch(url)
    if not xml:
        return []

    ns = {"ht": "https://trends.google.com/trending/rss"}
    results = []
    try:
        root = ElementTree.fromstring(xml)
        for item in root.iter("item"):
            title = item.findtext("title", "")
            traffic = item.findtext("ht:approx_traffic", "", ns)
            news_items = []
            for ni in item.iter("{https://trends.google.com/trending/rss}news_item"):
                nt = ni.findtext("{https://trends.google.com/trending/rss}news_item_title", "")
                nu = ni.findtext("{https://trends.google.com/trending/rss}news_item_url", "")
                if nt:
                    news_items.append({"title": nt, "url": nu})
            results.append({
                "keyword": title,
                "traffic": traffic,
                "news": news_items[:2]
            })
    except Exception:
        pass
    return results[:15]


def reddit_trending(limit=15):
    """Reddit 인기 글 (글로벌)"""
    url = f"https://www.reddit.com/r/popular/top.json?t=day&limit={limit}"
    data = fetch(url)
    if not data:
        return []

    results = []
    try:
        j = json.loads(data)
        for post in j.get("data", {}).get("children", []):
            d = post.get("data", {})
            results.append({
                "title": d.get("title", ""),
                "subreddit": d.get("subreddit", ""),
                "score": d.get("score", 0),
                "url": f"https://reddit.com{d.get('permalink', '')}"
            })
    except Exception:
        pass
    return results


def reddit_trending_topic(subreddit="all", limit=10):
    """특정 서브레딧 트렌드"""
    url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}"
    data = fetch(url)
    if not data:
        return []

    results = []
    try:
        j = json.loads(data)
        for post in j.get("data", {}).get("children", []):
            d = post.get("data", {})
            if d.get("stickied"):
                continue
            results.append({
                "title": d.get("title", ""),
                "subreddit": d.get("subreddit", ""),
                "score": d.get("score", 0),
            })
    except Exception:
        pass
    return results


def main():
    geo = sys.argv[1] if len(sys.argv) > 1 else "KR"
    output_format = sys.argv[2] if len(sys.argv) > 2 else "text"

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # 데이터 수집
    gt = google_trends_daily(geo)
    rd = reddit_trending(10)

    if output_format == "json":
        result = {
            "date": datetime.now().isoformat(),
            "geo": geo,
            "google_trends": gt,
            "reddit": rd,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    # 텍스트 출력
    print(f"[트렌드 리서치] {now} | 지역: {geo}")
    print("=" * 60)

    print("\\n🔥 Google Trends (일간)")
    print("-" * 40)
    if gt:
        for i, t in enumerate(gt, 1):
            print(f"  {i}. {t['keyword']} ({t['traffic']})")
            for n in t.get("news", [])[:1]:
                print(f"     └ {n['title']}")
    else:
        print("  (데이터 없음)")

    print("\\n📱 Reddit 인기 (글로벌)")
    print("-" * 40)
    if rd:
        for i, r in enumerate(rd, 1):
            print(f"  {i}. [{r['subreddit']}] {r['title']} (↑{r['score']})")
    else:
        print("  (데이터 없음)")


if __name__ == "__main__":
    main()
`, sortOrder: 0 }
    ]
  },
  {
    id: 'builtin-veo-shorts-writer',
    name: 'VEO Shorts Writer',
    description: `VEO 숏폼 영상 스크립트 생성. 사주팔자/돈/운명/사랑 주제의 유튜브 쇼츠용 VEO 3.1 프롬프트와 대사를 작성한다. "영상 스크립트 만들어", "숏폼 스크립트", "사주 영상 대본", "VEO 프롬프트" 등의 요청에 트리거.`,
    instructions: `# VEO Shorts Writer

사주/운세/운명 주제의 유튜브 쇼츠(세로 9:16) 스크립트를 생성하는 스킬.

## 출력 구조

15초 영상 = **2개 파트**. Veo extend API로 이어붙인다.

\`\`\`
파트 1 (0-8초):  Hook + Core — 시청자를 잡는 도입 + 핵심 정보
파트 2 (8-15초): Payoff — 반전/결론 + 여운
\`\`\`

**기술적 구조**: Part 1 = create (8초), Part 2 = extend (+7초 = 15초 누적)

## 핵심 규칙 (절대 준수)

### VEO 프롬프트 규칙
1. **텍스트/글씨 절대 금지** — VEO가 글씨를 깨뜨린다. 특히 한글. 자막은 후처리(finalize)에서 넣음
2. **배경음악 완전 금지** — "ABSOLUTELY NO MUSIC. NO background music. NO instrumental sounds. NO soundtrack. Only her voice and soft ambient sounds" 반드시 포함
3. **3D 애니메이션 스타일 명시** — "3D animated character style matching the reference image throughout — NOT live action, NOT realistic" 반드시 포함
4. **상황묘사 명확하게** — 장소, 인물 외형, 조명, 카메라 움직임, 표정을 구체적으로 기술
5. **영어로 작성** — VEO 프롬프트는 영어. 대사 부분만 한국어를 직접 포함
6. **자막/텍스트 금지 반복** — 프롬프트 끝에 "No text, no titles, no subtitles, no captions, no watermarks" 반드시 포함

### 대사 규칙
7. **한국어 대사** — 등장인물이 한국어로 말한다
8. **대사 포맷** — \`Exact spoken Korean dialogue:\` 블록으로 대사를 프롬프트에 직접 포함
9. **음성 지시** — "She must speak the dialogue naturally in Korean, with a calm, soft, mysterious female voice, slow pacing, and short pauses between lines. Natural Korean lip sync." 포함
10. **파트 1 대사**: 2~3문장 (도입 + 핵심). 8초 안에 소화할 분량
11. **파트 2 대사**: 1~2문장 (결론). 짧고 임팩트 있게. 이후 여운을 위한 무언의 응시 시간 확보

### 파트 2 프롬프트 규칙
12. **연속성 명시** — "Continue the same scene in the SAME 3D animated illustration style — NOT live action, NOT photorealistic" 로 시작
13. **스타일 일관성** — "Maintain the same 3D animated character rendering from the previous part. Do NOT switch to live action or realistic style." 포함

### 연출/구도 규칙 (VEO 안정성 기반)
14. **배경은 추상적 공간** — "dark mystical space" 기본. 구체적 장소(연못, 숲, 방, 거리)는 VEO가 캐릭터 배치를 잘못함 (예: 연못 옆 → 물에 잠김)
15. **캐릭터는 항상 서 있는 포즈** — "She stands in..." 기본. 앉기/눕기/물가/기대기 등은 VEO가 비정상적 포즈로 해석할 위험 높음
16. **배경 효과는 부유 입자만** — golden particles, dust, light orbs, coins, fragments, fireflies 등 추상적 부유 요소. 동물(잉어, 새), 건축물, 가구 등 복잡한 3D 오브젝트는 퀄리티 저하
17. **물/액체 묘사 금지** — 물, 연못, 바다, 비, 강 등은 캐릭터가 잠기거나 젖는 결과 초래. 물 테마가 필요하면 "water-like light particles" 같은 추상적 표현으로 대체
18. **카메라는 단순하게** — close-up → slow pull back 또는 static shot만 사용. 패닝, 회전, 빠른 컷, wide→push in 금지. VEO는 단순한 카메라 무브에서 가장 안정적
19. **공간 배치 명확하게** — 모호한 전치사(beside, near, by) 대신 명확한 위치("standing on solid ground in", "standing alone in the center of") 사용
20. **파트 2 의상 고정** — Part 2 프롬프트에 "wearing the EXACT same outfit and colors as Part 1" 명시. extend 시 옷 색상 변경 방지
21. **이펙트 전환은 은은하게** — "bursting", "exploding", "brilliant sparks" 등 폭발적 전환 금지. "slowly begin to glow", "gradually reform", "gently drift upward" 같은 점진적/은은한 전환만 사용. 과한 이펙트 = 촌스러움

### 콘텐츠 규칙
22. **주제** — 사주팔자, 돈복, 운명, 사랑운, 재물운, 건강운 중 선택
23. **다양성** — 이전 스크립트를 참고해 반복 회피. \`references/archive.md\` 확인
24. **후편 가능** — 시리즈물로 이어질 수 있는 열린 결말 허용

## 캐릭터: 정빈 (Jeongbin)

현재 채널의 고정 캐릭터. 모든 프롬프트에 아래 외형 설명을 포함:

> Jeongbin is a mysterious Korean female saju interpreter in traditional hanbok with purple eyes, yin-yang earrings, and a crescent moon hair ornament, rendered in stylized 3D animation.

- 레퍼런스 이미지: \`contents/character/jeong_bin/\` (front, idle, black, smile, stand)
- \`--image\` 옵션으로 레퍼런스 이미지를 Veo에 전달

## 스크립트 포맷

\`\`\`markdown
# [제목]
- 주제: [사주팔자/돈/운명/사랑 중]
- 분위기: [한 줄 설명]

## 파트 1 (0-8초) — Hook + Core
**VEO 프롬프트:** [영어 프롬프트]
**대사(한국어):** [2~3문장]
**상황:** [한국어 장면 설명]

## 파트 2 (8-15초) — Payoff
**VEO 프롬프트:** [영어 프롬프트. "Continue the same scene..." 으로 시작]
**대사(한국어):** [1~2문장 + 무언의 응시]
**상황:** [장면 설명]

## 음악 프롬프트
[Gemini Music용 한국어 프롬프트]
\`\`\`

## JSON 출력 포맷

스크립트 작성 후 CLI에서 바로 쓸 수 있는 JSON도 함께 생성:

\`\`\`json
[
  {
    "prompt": "A cinematic vertical short-form video, 9:16. 3D animated character style...",
    "dialogue": "대사 1줄\\n대사 2줄"
  },
  {
    "prompt": "Continue the same scene in the SAME 3D animated illustration style...",
    "dialogue": "대사"
  }
]
\`\`\`

저장 경로: \`output/YYYY-MM-DD/prompts/{파일명}.json\`

## 실행 절차

1. \`references/archive.md\` 읽어서 이전 스크립트 주제/캐릭터 확인
2. 겹치지 않는 새로운 조합 선택 (주제 × 분위기 × 시각 테마)
3. 위 포맷에 맞춰 스크립트 + JSON 생성
4. 생성된 스크립트를 \`references/archive.md\`에 추가 (제목, 날짜, 주제, 비고만 요약)
5. JSON을 \`output/YYYY-MM-DD/prompts/\` 에 저장

## 프롬프트 구조 템플릿 (파트 1)

\`\`\`
A cinematic vertical short-form video, 9:16. 3D animated character style matching the reference image throughout — NOT live action, NOT realistic. The character Jeongbin is a mysterious Korean female saju interpreter in traditional hanbok with purple eyes, yin-yang earrings, and a crescent moon hair ornament, rendered in stylized 3D animation. She stands alone in the center of a dark mystical space. [배경 부유 입자/빛 효과 묘사 — 구체적 장소 금지]. Close-up on her face with [표정]. [단순 카메라: "Camera slowly pulls back" 또는 static].

Exact spoken Korean dialogue:
"[대사 1]"
"[대사 2]"

She must speak the dialogue naturally in Korean, with a calm, soft, mysterious female voice, slow pacing, and short pauses between lines. Natural Korean lip sync. Clear mouth movement matched to Korean syllables.

ABSOLUTELY NO MUSIC. NO background music. NO instrumental sounds. NO soundtrack. Only her voice and soft ambient sounds ([구체적 앰비언트 — wind, shimmer 등]). No subtitles. No on-screen text. No translation. No English speech. No other voices.

Visual progression: 0-2s close-up on her face as she delivers the first line, 2-8s camera slowly pulls back to reveal [부유 입자 효과] around her as she delivers the remaining lines. Maintain consistent 3D animated illustration style throughout — do NOT transition to live action or photorealistic rendering at any point.

Style: premium 3D animated fantasy, elegant, mystical, emotionally immersive. No text, no titles, no subtitles, no captions, no watermarks.
\`\`\`

### 파트 1 체크리스트
- [ ] "She stands" 사용 (앉기/눕기 금지)
- [ ] "dark mystical space" 또는 추상적 공간 (구체적 장소 금지)
- [ ] 배경 효과는 particles/dust/orbs만 (동물/건축물/물 금지)
- [ ] 카메라: close-up → pull back (단순 줌아웃)
- [ ] 물/액체 묘사 없음

## 프롬프트 구조 템플릿 (파트 2)

\`\`\`
Continue the same scene in the SAME 3D animated illustration style — NOT live action, NOT photorealistic. Jeongbin remains standing in the same position, wearing the EXACT same outfit and colors as Part 1. [부유 입자/빛 효과의 변화 묘사 — 전환/강화/수렴 등]. Her expression shifts to [표정 변화]. She looks directly at the camera.

Exact spoken Korean dialogue:
"[대사]"

She delivers this line slowly with [감정 묘사]. Then holds a [표정] for several seconds as [시각 효과 변화]. Natural Korean lip sync.

ABSOLUTELY NO MUSIC. NO background music. NO instrumental sounds. Only her voice and soft ambient sounds. No subtitles. No on-screen text.

Maintain the same 3D animated character rendering from the previous part. Do NOT switch to live action or realistic style. Same outfit, same colors, same accessories.

Style: premium 3D animated fantasy, elegant, mystical, emotionally immersive. No text, no titles, no subtitles, no captions, no watermarks.
\`\`\`

### 파트 2 체크리스트
- [ ] "remains standing in the same position" (포즈 유지)
- [ ] "wearing the EXACT same outfit and colors as Part 1" (의상 고정)
- [ ] 부유 입자의 변화로 시각적 전환 (장소 변경 금지)
- [ ] "looks directly at the camera" (마무리 응시)
- [ ] 물/액체/새 장소 없음

## 검증된 배경 패턴 (조회수 기반)

아래 패턴이 VEO에서 안정적이고 높은 조회수를 기록한 조합:

| 패턴 | 부유 입자 | 조회수 | 예시 |
|------|----------|--------|------|
| 금빛 파편 변환 | dissolving fragments → golden particles rising | 343 | 잃고얻는재물 |
| 어둠 → 빛 전환 | dark clouds parting → golden particles | 322 | 판이바뀌는신호 |
| 금빛 동전/먼지 | golden coins + gold dust swirling | 304 | 돈조짐 |
| 초승달 + 반딧불 | crescent moon + firefly lights | 288 | 새벽태생외로움 |

**공통점**: 어두운 추상 공간 + 금빛/빛 입자 + 감정적 전환(어둠→빛)`,
    sortOrder: -1,
    refs: [
      { id: 'builtin-veo-shorts-writer-ref-0', name: 'references/archive.md', content: `# 스크립트 아카이브

이전에 생성한 스크립트 요약. 새 스크립트 생성 시 중복 회피용.

## 기록

| 날짜 | 제목 | 주제 | 캐릭터 | 비고 |
|------|------|------|--------|------|
| 2026-03-06 | 2026년 3월, 당신의 사주가 경고합니다 | 운명/사주 | 한복 입은 노인 점술사 | 첫 번째 테스트. 8초만 생성됨. |
| 2026-03-09 | 수기운 강한 사람의 존재감 | 유형/오행 | 정빈 (한복, 보라 눈, 음양 귀걸이) | Day 1 유형형. 물/달빛 테마. |
| 2026-03-10 | 답장 보류의 지혜 | 조언/감정 | 정빈 (사색, 폰) | Day 1 조언형. EasyOCR+LaMa 인페인팅. |
| 2026-03-12 | 화기운 강한 사람의 연애 | 유형/오행/연애 | 정빈 (미소, 불꽃 입자) | Day 2 유형형. 화기운/불 테마. PQP8uSgCKXo |
| 2026-03-12 | 돈이 들어오기 직전의 조짐 | 공감/재물운 | 정빈 (사색, 금빛 동전 입자) | Day 2 공감형. 재물운/금 테마. sPaeerSemo4 |
| 2026-03-13 | 재물운 트이기 전 잃는 것들 | 공감/재물운 | 정빈 (사색, 파편→금빛 변환) | Day 3 공감형. 잃고 얻는 재물운. C_PQ6gr2kWw |
| 2026-03-13 | 새벽에 태어난 사람의 외로움 | 공감/운명 | 정빈 (사색, 초승달+반딧불) | Day 3 공감형. 인시/묘시 태생 외로움→강점 반전. Veo Fast 테스트. |
| 2026-03-16 | 곧 큰돈 들어올 사람, 요즘 이런 꿈 꿔 | 공감/재물운/꿈 | 정빈 (사색, 연못+황금잉어) | Day 4 공감형. 물꿈=재물운 신호. XgUV_WnxED4 |
`, sortOrder: 0 }
    ]
  },
]
