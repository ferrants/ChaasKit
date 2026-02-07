# React Native Mobile App for ChaasKit

## Overview

Build a React Native mobile app with full feature parity, distributed as reusable packages plus a scaffolding template - mirroring the web client architecture.

## Architecture

### Package Structure (mirrors web)

```
packages/
├── shared/              # (existing) Types, validation - shared with mobile
├── mobile-core/         # NEW: Stores, contexts, services, API client
├── mobile-ui/           # NEW: Reusable React Native components
└── create-chaaskit/     # (existing) Add mobile template scaffolding
```

### How It Works for Implementers

```bash
# Scaffold a mobile app (like web)
npx chaaskit create-mobile my-mobile-app
cd my-mobile-app
npx expo prebuild        # Generate native projects
npx expo run:ios         # Build locally with Xcode
npx expo run:android     # Build locally with Android Studio
```

The scaffolded app imports from packages:
```typescript
// my-mobile-app/app/(main)/index.tsx
import { ChatScreen, useChatStore } from '@chaaskit/mobile-ui';
import { useAuth } from '@chaaskit/mobile-core';

export default function Home() {
  return <ChatScreen />;
}
```

### Package Responsibilities

**@chaaskit/mobile-core**
- `stores/chatStore.ts` - Zustand store (adapted from web)
- `contexts/` - AuthContext, ConfigContext, ThemeContext, TeamContext, ProjectContext
- `services/api.ts` - API client with token injection
- `services/streaming.ts` - SSE streaming for React Native
- `services/storage.ts` - Secure storage wrapper
- `hooks/` - useAuth, useConfig, useTheme, etc.

**@chaaskit/mobile-ui**
- `components/chat/` - MessageList, MessageItem, ChatInput, ToolCallDisplay
- `components/navigation/` - Drawer, ThreadList, TeamSwitcher
- `components/common/` - Button, Modal, Avatar, etc.
- `screens/` - Pre-built screens (ChatScreen, LoginScreen, SettingsScreen)
- `theme/` - Default theme + theme utilities

**create-chaaskit (mobile template)**
- Expo project with expo-router
- Pre-configured app/ routes
- Config file for customization
- Extension points for custom screens

## Technical Decisions

### Framework: Expo (local builds only)
- `expo prebuild` generates native iOS/Android projects
- Build with Xcode and Android Studio locally
- No dependency on EAS or cloud services
- Still get Expo SDK benefits (expo-secure-store, expo-router, etc.)

### Shared Code Strategy

| Layer | Web | Mobile | Shared? |
|-------|-----|--------|---------|
| Types | @chaaskit/shared | @chaaskit/shared | ✅ Yes |
| Validation | @chaaskit/shared | @chaaskit/shared | ✅ Yes |
| Store logic | @chaaskit/client | @chaaskit/mobile-core | 🔄 Pattern shared |
| Contexts | @chaaskit/client | @chaaskit/mobile-core | 🔄 Pattern shared |
| Components | @chaaskit/client (React DOM) | @chaaskit/mobile-ui (RN) | ❌ Separate |
| API types | @chaaskit/shared | @chaaskit/shared | ✅ Yes |

### SSE Streaming (React Native)

React Native's fetch doesn't support ReadableStream reliably, so we use react-native-fetch-blob:

```typescript
// packages/mobile-core/src/services/streaming.ts
import RNFetchBlob from 'react-native-fetch-blob';

export function streamChat(params, callbacks) {
  return RNFetchBlob.fetch('POST', `${API_URL}/api/chat`, headers, body)
    .then(res => {
      const lines = res.text().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          switch (event.type) {
            case 'delta': callbacks.onDelta(event.content); break;
            case 'tool_use': callbacks.onToolUse(event); break;
            case 'done': callbacks.onDone(event.messageId); break;
            // ... other events
          }
        }
      }
    });
}
```

### Auth Token Management

Replace HTTP-only cookies with secure storage:

```typescript
// packages/mobile-core/src/services/storage.ts
import * as SecureStore from 'expo-secure-store';

export const authStorage = {
  async setToken(token: string) {
    await SecureStore.setItemAsync('auth_token', token);
  },
  async getToken() {
    return SecureStore.getItemAsync('auth_token');
  },
  async clearToken() {
    await SecureStore.deleteItemAsync('auth_token');
  },
};

// API client injects token into Authorization header
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await authStorage.getToken();
  return fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
```

### Theming (matches web config)

```typescript
// packages/mobile-ui/src/theme/index.ts
import type { ThemeConfig } from '@chaaskit/shared';

export function createNativeTheme(config: ThemeConfig) {
  return {
    colors: config.colors,  // Same color tokens as web
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12 },
    fonts: {
      sans: Platform.select({ ios: 'System', android: 'Roboto' }),
      mono: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    },
  };
}
```

## Project Structure (scaffolded app)

```
my-mobile-app/
├── app/                          # Expo Router routes
│   ├── (auth)/
│   │   ├── login.tsx            # Uses <LoginScreen /> from mobile-ui
│   │   ├── register.tsx
│   │   └── verify-email.tsx
│   ├── (main)/
│   │   ├── _layout.tsx          # Drawer with <CustomDrawer />
│   │   ├── index.tsx            # <ChatScreen /> new thread
│   │   ├── thread/[threadId].tsx
│   │   ├── documents.tsx
│   │   ├── automations.tsx
│   │   └── team/[teamId]/settings.tsx
│   ├── share/[shareId].tsx
│   └── _layout.tsx              # Root with providers
├── config/
│   └── app.config.ts            # Same config format as web!
├── extensions/                   # Custom screens, components
├── assets/                       # App icons, splash
├── app.json                      # Expo config
└── package.json
```

## Key Dependencies

```json
{
  "@chaaskit/shared": "workspace:*",
  "@chaaskit/mobile-core": "workspace:*",
  "@chaaskit/mobile-ui": "workspace:*",
  "expo": "~51.0.0",
  "expo-router": "~3.5.0",
  "expo-secure-store": "~13.0.0",
  "react-native-fetch-blob": "^0.10.8",
  "zustand": "^4.5.0",
  "react-native-markdown-display": "^7.0.0",
  "@expo/vector-icons": "^14.0.0",
  "react-native-reanimated": "~3.6.0",
  "react-native-gesture-handler": "~2.14.0"
}
```

## Implementation Phases

### Phase 1: Core Package Foundation (2 weeks)
- Create `packages/mobile-core` structure
- Implement secure storage service
- Implement API client with token management
- Port AuthContext (token-based)
- Port ConfigContext
- Port ThemeContext (native adaptation)
- Implement SSE streaming service

### Phase 2: UI Components (3 weeks)
- Create `packages/mobile-ui` structure
- MessageList, MessageItem components
- ChatInput with auto-grow
- Markdown rendering setup
- ToolCallDisplay component
- Drawer navigation components
- ThreadList component
- Common components (Button, Modal, Avatar)

### Phase 3: Screens & Chat Store (2 weeks)
- Port chatStore to mobile-core
- ChatScreen (compose from components)
- LoginScreen, RegisterScreen
- SettingsScreen
- Wire up streaming to store

### Phase 4: Teams, Projects, Documents (2 weeks)
- Port TeamContext, ProjectContext
- TeamSwitcher component
- Team settings screen
- Project folders in drawer
- Documents screen
- File upload/attachment

### Phase 5: Template & CLI (1 week)
- Add `create-mobile` command to create-chaaskit
- Mobile app template
- Config file integration
- Extension system for custom screens
- Documentation

### Phase 6: Full Feature Parity (2 weeks)
- Automations/scheduled prompts screen
- Admin screens
- Search functionality
- Share thread functionality
- Export chat

### Phase 7: Polish (1 week)
- iOS-specific polish (safe areas, gestures)
- Android-specific polish (back button, status bar)
- App icons, splash screens
- Local build documentation

## Component Mapping (Web → Mobile)

| Web Component | Mobile Equivalent | Library |
|---------------|-------------------|---------|
| `div` | `View` | react-native |
| `p`, `span` | `Text` | react-native |
| `input` | `TextInput` | react-native |
| `button` | `Pressable` | react-native |
| `Link` | `Link` | expo-router |
| Tailwind classes | StyleSheet | react-native |
| react-markdown | react-native-markdown-display | npm |
| prism (syntax) | react-native-syntax-highlighter | npm |
| lucide-react | @expo/vector-icons | expo |
| CSS animations | react-native-reanimated | npm |

## Files to Reference (Web Client)

| Purpose | File |
|---------|------|
| Chat store logic | `packages/client/src/stores/chatStore.ts` |
| Auth context | `packages/client/src/contexts/AuthContext.tsx` |
| Config context | `packages/client/src/contexts/ConfigContext.tsx` |
| Theme context | `packages/client/src/contexts/ThemeContext.tsx` |
| Message component | `packages/client/src/components/MessageItem.tsx` |
| Sidebar | `packages/client/src/components/Sidebar.tsx` |
| SSE event format | `packages/server/src/api/chat.ts` |
| Shared types | `packages/shared/src/types/` |
| CLI scaffolding | `packages/create-chaaskit/src/commands/` |

## Verification Checklist

1. `pnpm build` succeeds for mobile-core and mobile-ui packages
2. `npx chaaskit create-mobile test-app` scaffolds working project
3. `expo prebuild && expo run:ios` builds and runs on simulator
4. Auth flow works (login, register, token persistence)
5. Chat streams responses correctly on iOS and Android
6. Tool calls display and confirmation works
7. Config from `config/app.config.ts` applies theming
8. Extension system allows custom screens
9. Teams and projects work correctly
10. Documents upload and @mention work
