# User Settings

The ChaasKit Template includes a flexible user settings system that allows users to customize their experience and provide context to the AI.

## Configuration

Define available settings in `config/app.config.ts`:

```typescript
userSettings: {
  fields: [
    {
      key: 'name',
      label: 'Your Name',
      type: 'text',
      placeholder: 'Enter your name',
    },
    {
      key: 'role',
      label: 'Your Role',
      type: 'select',
      options: ['Developer', 'Designer', 'Manager', 'Other'],
    },
    {
      key: 'context',
      label: 'Additional Context',
      type: 'textarea',
      placeholder: 'Any context the AI should know about you...',
    },
  ],
}
```

## Field Types

### Text Field

Simple single-line text input.

```typescript
{
  key: 'company',
  label: 'Company',
  type: 'text',
  placeholder: 'Your company name',
}
```

### Select Field

Dropdown selection from predefined options.

```typescript
{
  key: 'experience',
  label: 'Experience Level',
  type: 'select',
  options: ['Beginner', 'Intermediate', 'Expert'],
}
```

### Textarea Field

Multi-line text input for longer content.

```typescript
{
  key: 'bio',
  label: 'About You',
  type: 'textarea',
  placeholder: 'Tell us about yourself...',
}
```

## How Settings Work

### Storage

User settings are stored in the `settings` JSON field on the User model:

```prisma
model User {
  // ...
  settings Json @default("{}")
}
```

### API

**Get Settings:**
```http
GET /api/user/settings
Authorization: Bearer <token>
```

**Update Settings:**
```http
PUT /api/user/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John",
  "role": "Developer",
  "context": "I work with React and Node.js"
}
```

### AI Context

Settings are automatically included in the AI's system prompt:

```typescript
// agent.ts
if (options?.userContext) {
  const contextStr = Object.entries(options.userContext)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  if (contextStr) {
    systemPrompt += `\n\nUser context:\n${contextStr}`;
  }
}
```

This allows the AI to personalize responses based on user preferences.

## Frontend Integration

### Settings Page

The settings are displayed in a form on the settings page:

```tsx
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';

function SettingsPage() {
  const { user } = useAuth();
  const config = useConfig();

  return (
    <form>
      {config.userSettings.fields.map((field) => (
        <FormField key={field.key} field={field} />
      ))}
    </form>
  );
}
```

### FormField Component

Renders appropriate input based on field type:

```tsx
function FormField({ field }) {
  switch (field.type) {
    case 'text':
      return <input type="text" {...props} />;
    case 'select':
      return (
        <select {...props}>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'textarea':
      return <textarea {...props} />;
  }
}
```

## MCP Credentials

Users can manage credentials for MCP servers that require authentication directly in the Settings modal.

### Credential Types

**API Key**: For servers with `authMode: 'user-apikey'`
- Text input to enter/update the API key
- Key is encrypted and stored securely

**OAuth**: For servers with `authMode: 'user-oauth'`
- "Connect" button initiates OAuth flow
- Tokens are encrypted and stored
- "Disconnect" button to revoke access

### Settings Modal Section

The MCP Credentials section appears automatically when servers with user authentication are configured:

```tsx
// In SettingsModal
{mcpServers.length > 0 && (
  <MCPCredentialsSection servers={mcpServers} />
)}
```

### API Endpoints

**Get Credential Status:**
```http
GET /api/mcp/credentials
Authorization: Bearer <token>
```

**Set API Key:**
```http
POST /api/mcp/credentials/:serverId/apikey
Authorization: Bearer <token>
Content-Type: application/json

{
  "apiKey": "sk-..."
}
```

**Start OAuth:**
```http
GET /api/mcp/oauth/:serverId/authorize
Authorization: Bearer <token>
```

**Remove Credentials:**
```http
DELETE /api/mcp/credentials/:serverId
Authorization: Bearer <token>
```

## Usage Metrics

The Settings modal displays usage metrics showing the user's message consumption:

### Display

- Progress bar showing messages used vs. limit
- Numerical display: "X / Y messages used"
- For unlimited plans: "X messages used (unlimited)"

### API Endpoint

```http
GET /api/user/usage
Authorization: Bearer <token>
```

Response:
```json
{
  "messagesUsed": 15,
  "messagesLimit": 100,
  "unlimited": false
}
```

## Theme Preference

The user's theme preference is stored separately:

```prisma
model User {
  themePreference String?  // 'light' | 'dark' | null (system)
}
```

### API

**Get Theme:**
```http
GET /api/user/theme
```

**Update Theme:**
```http
PUT /api/user/theme
Content-Type: application/json

{
  "theme": "dark"
}
```

### Frontend

Use the ThemeContext:

```tsx
import { useTheme } from '../contexts/ThemeContext';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  );
}
```

## Use Cases

### Developer Context

```typescript
userSettings: {
  fields: [
    {
      key: 'primaryLanguage',
      label: 'Primary Language',
      type: 'select',
      options: ['JavaScript', 'Python', 'Go', 'Rust', 'Other'],
    },
    {
      key: 'framework',
      label: 'Preferred Framework',
      type: 'text',
      placeholder: 'React, Vue, Django, etc.',
    },
    {
      key: 'codeStyle',
      label: 'Code Style Preferences',
      type: 'textarea',
      placeholder: 'Describe your coding style preferences...',
    },
  ],
}
```

### Customer Support

```typescript
userSettings: {
  fields: [
    {
      key: 'accountId',
      label: 'Account ID',
      type: 'text',
    },
    {
      key: 'department',
      label: 'Department',
      type: 'select',
      options: ['Sales', 'Engineering', 'Support', 'Finance'],
    },
  ],
}
```

### Creative Writing

```typescript
userSettings: {
  fields: [
    {
      key: 'writingStyle',
      label: 'Preferred Writing Style',
      type: 'select',
      options: ['Formal', 'Casual', 'Technical', 'Creative'],
    },
    {
      key: 'targetAudience',
      label: 'Target Audience',
      type: 'text',
      placeholder: 'Who are you writing for?',
    },
  ],
}
```

## Extending Settings

### Custom Field Types

Add new field types by extending the configuration:

```typescript
// types/config.ts
export interface UserSettingsField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'number' | 'boolean';
  // ...
}
```

### Validation

Add validation using Zod:

```typescript
// validation/user.ts
export const settingsSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['Developer', 'Designer', 'Manager', 'Other']).optional(),
  context: z.string().max(1000).optional(),
});
```

### Computed Settings

Process settings before sending to AI:

```typescript
function processUserContext(settings) {
  return {
    ...settings,
    // Add computed fields
    fullContext: `${settings.name} is a ${settings.role}. ${settings.context}`,
  };
}
```
