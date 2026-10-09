# ACE---AI_Contextual_Editor

## Local setup

### Backend

Set one of the supported model keys before starting the backend:

- Gemini: `GEMINI_API_KEY`
- Grok/xAI: `GROK_API_KEY` or `XAI_API_KEY`
- Optional override: `LLM_PROVIDER=gemini|grok`

Example:

```bash
export GEMINI_API_KEY=your_key_here
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The frontend expects the backend at `http://localhost:8000` and streams editor updates via `/api/edit-stream`.

## Frontend architecture

```text
.
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                       # Shared minimal Clerk-auth layout
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk sign-in route
│   │   └── sign-up/[[...sign-up]]/page.tsx   # Clerk sign-up route
│   ├── (dashboard)/
│   │   ├── layout.tsx                       # Shared dashboard layout
│   │   └── onboarding/page.tsx               # Workspace-preferences wizard
│   ├── (editor)/
│   │   ├── layout.tsx                       # Full-screen editor layout
│   │   └── workspace/[projectId]/page.tsx    # Project editor entry point
│   ├── globals.css                           # Tailwind theme and motion tokens
│   └── layout.tsx                            # Root document and global providers
├── components/
│   ├── editor/
│   │   ├── file-explorer.tsx                 # Interactive project tree and status
│   │   ├── monaco-editor.tsx                 # Editor surface and cursor tracking
│   │   ├── context-rail.tsx                  # Context stream and token metrics
│   │   └── editor-shell.tsx                  # Sidebar, editor, and right-rail layout
│   ├── onboarding/                            # Workspace preference wizard
│   ├── providers/app-providers.tsx            # Clerk and client-state provider boundary
│   └── ui/                                    # Styled Radix dialogs, inputs, loaders, buttons
├── hooks/                                     # Cursor and cloud-sync client hooks
├── lib/
│   ├── cloud-sync/                            # Cloud file-sync operations
│   ├── editor/                                # Monaco setup and language utilities
│   └── utils.ts                               # Shared UI utilities
├── stores/                                    # Zustand editor and workspace state
├── types/                                     # Shared project, file, and sync contracts
├── public/                                    # Static assets and app icon
├── components.json                            # Shadcn/ui configuration
├── .eslintrc.json                              # Next.js lint rules
├── .eslintignore                               # Generated and dependency file exclusions
├── .gitignore                                  # Build, dependency, and local environment exclusions
├── middleware.ts                              # Clerk route protection
├── next.config.ts                             # Next.js configuration
├── postcss.config.mjs                         # Tailwind CSS processing
├── tailwind.config.ts                         # Tailwind theme configuration
├── tsconfig.json                              # TypeScript configuration
├── package.json                               # Frontend dependencies and scripts
└── package-lock.json                          # Reproducible npm dependency lock
```

Copy `.env.example` to `.env.local` and configure Clerk keys to enable authentication.
Cloud file sync uses the configured `NEXT_PUBLIC_CLOUD_SYNC_ENDPOINT`; it expects a
`PUT /workspaces/{projectId}/files` endpoint accepting a JSON `{ "files": [...] }`
payload. The current FastAPI backend does not provide this route.
