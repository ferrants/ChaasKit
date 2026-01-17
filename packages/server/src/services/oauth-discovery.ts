import type { MCPServerConfig } from '@chaaskit/shared';

// Cached metadata per server URL
interface CachedMetadata {
  protectedResource?: ProtectedResourceMetadata;
  authServer?: AuthServerMetadata;
  clientRegistration?: ClientRegistration;
  expiresAt: number;
}

const metadataCache = new Map<string, CachedMetadata>();
// Persistent client registrations (survives cache expiry but not server restart)
const clientRegistrations = new Map<string, ClientRegistration>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// RFC 9728: OAuth 2.0 Protected Resource Metadata
interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
}

// RFC 8414: OAuth 2.0 Authorization Server Metadata
interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  client_id_metadata_document_supported?: boolean;
}

// RFC 7591: Dynamic Client Registration
interface ClientRegistration {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
}

interface DynamicRegistrationRequest {
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_uri?: string;
}

export interface DiscoveredOAuthConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.log(`[OAuth Discovery] ${url} returned ${response.status}`);
      return null;
    }
    return await response.json() as T;
  } catch (error) {
    console.log(`[OAuth Discovery] Failed to fetch ${url}:`, error);
    return null;
  }
}

// Discover protected resource metadata from MCP server
async function discoverProtectedResourceMetadata(
  serverUrl: string
): Promise<ProtectedResourceMetadata | null> {
  const url = new URL(serverUrl);

  // Try well-known paths per RFC 9728
  // Path-aware: /.well-known/oauth-protected-resource/path
  const pathAwareUrl = `${url.origin}/.well-known/oauth-protected-resource${url.pathname}`;
  let metadata = await fetchJson<ProtectedResourceMetadata>(pathAwareUrl);
  if (metadata) return metadata;

  // Root well-known
  const rootUrl = `${url.origin}/.well-known/oauth-protected-resource`;
  metadata = await fetchJson<ProtectedResourceMetadata>(rootUrl);
  if (metadata) return metadata;

  // Try making an unauthenticated request to get WWW-Authenticate header
  try {
    const response = await fetch(serverUrl, { method: 'GET' });
    if (response.status === 401) {
      const wwwAuth = response.headers.get('WWW-Authenticate');
      if (wwwAuth) {
        // Parse: Bearer resource_metadata="url", scope="scopes"
        const resourceMetadataMatch = wwwAuth.match(/resource_metadata="([^"]+)"/);
        if (resourceMetadataMatch) {
          metadata = await fetchJson<ProtectedResourceMetadata>(resourceMetadataMatch[1]);
          if (metadata) return metadata;
        }
      }
    }
  } catch {
    // Ignore fetch errors
  }

  return null;
}

// Discover authorization server metadata
async function discoverAuthServerMetadata(
  issuer: string
): Promise<AuthServerMetadata | null> {
  const url = new URL(issuer);

  // Try paths per RFC 8414 and OpenID Connect Discovery
  const paths = url.pathname && url.pathname !== '/'
    ? [
        // Path-aware discovery
        `${url.origin}/.well-known/oauth-authorization-server${url.pathname}`,
        `${url.origin}/.well-known/openid-configuration${url.pathname}`,
        `${issuer}/.well-known/openid-configuration`,
      ]
    : [
        `${url.origin}/.well-known/oauth-authorization-server`,
        `${url.origin}/.well-known/openid-configuration`,
      ];

  for (const path of paths) {
    const metadata = await fetchJson<AuthServerMetadata>(path);
    if (metadata) {
      // Verify PKCE support
      if (
        metadata.code_challenge_methods_supported &&
        !metadata.code_challenge_methods_supported.includes('S256')
      ) {
        console.warn(`[OAuth Discovery] Auth server doesn't support S256 PKCE`);
      }
      return metadata;
    }
  }

  return null;
}

// Dynamic client registration per RFC 7591
async function registerClient(
  registrationEndpoint: string,
  config: MCPServerConfig
): Promise<ClientRegistration | null> {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const request: DynamicRegistrationRequest = {
    client_name: config.oauth?.clientName || config.name || 'Chat SaaS Client',
    redirect_uris: [
      `${apiUrl}/api/mcp/oauth/callback`,
    ],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none', // Public client
    client_uri: config.oauth?.clientUri || appUrl,
  };

  try {
    const response = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OAuth Discovery] Client registration failed:`, errorText);
      return null;
    }

    return await response.json() as ClientRegistration;
  } catch (error) {
    console.error(`[OAuth Discovery] Client registration error:`, error);
    return null;
  }
}

// Store client registration in memory
function storeClientRegistration(
  serverId: string,
  registration: ClientRegistration
): void {
  clientRegistrations.set(serverId, registration);
  console.log(`[OAuth Discovery] Stored client registration for ${serverId}`);
}

// Load stored client registration from memory
function loadClientRegistration(
  serverId: string
): ClientRegistration | null {
  const registration = clientRegistrations.get(serverId);
  if (!registration) {
    return null;
  }

  // Check if expired
  if (
    registration.client_secret_expires_at &&
    registration.client_secret_expires_at * 1000 < Date.now()
  ) {
    clientRegistrations.delete(serverId);
    return null;
  }

  return registration;
}

// Main discovery function
export async function discoverOAuthConfig(
  config: MCPServerConfig
): Promise<DiscoveredOAuthConfig | null> {
  if (!config.url) {
    console.error('[OAuth Discovery] Server URL is required');
    return null;
  }

  // Check if manually configured
  if (config.oauth?.authorizationEndpoint && config.oauth?.tokenEndpoint && config.oauth?.clientId) {
    let clientId = config.oauth.clientId;
    // Resolve env var reference
    if (clientId.startsWith('${') && clientId.endsWith('}')) {
      const envVar = clientId.slice(2, -1);
      clientId = process.env[envVar] || '';
    }

    let clientSecret: string | undefined;
    if (config.oauth.clientSecretEnvVar) {
      clientSecret = process.env[config.oauth.clientSecretEnvVar];
    }

    return {
      authorizationEndpoint: config.oauth.authorizationEndpoint,
      tokenEndpoint: config.oauth.tokenEndpoint,
      clientId,
      clientSecret,
      scopes: config.oauth.scopes,
    };
  }

  // Check cache
  const cached = metadataCache.get(config.url);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.authServer && cached.clientRegistration) {
      return {
        authorizationEndpoint: cached.authServer.authorization_endpoint,
        tokenEndpoint: cached.authServer.token_endpoint,
        clientId: cached.clientRegistration.client_id,
        clientSecret: cached.clientRegistration.client_secret,
        scopes: cached.protectedResource?.scopes_supported || config.oauth?.scopes,
      };
    }
  }

  console.log(`[OAuth Discovery] Discovering OAuth config for ${config.url}`);

  // Step 1: Discover protected resource metadata
  const protectedResource = await discoverProtectedResourceMetadata(config.url);
  if (!protectedResource?.authorization_servers?.length) {
    console.error('[OAuth Discovery] No authorization servers found in protected resource metadata');
    return null;
  }

  const authServerUrl = protectedResource.authorization_servers[0];
  console.log(`[OAuth Discovery] Found authorization server: ${authServerUrl}`);

  // Step 2: Discover authorization server metadata
  const authServer = await discoverAuthServerMetadata(authServerUrl);
  if (!authServer) {
    console.error('[OAuth Discovery] Failed to discover authorization server metadata');
    return null;
  }

  console.log(`[OAuth Discovery] Found endpoints: auth=${authServer.authorization_endpoint}, token=${authServer.token_endpoint}`);

  // Step 3: Get or create client registration
  let clientRegistration = loadClientRegistration(config.id);

  if (!clientRegistration && authServer.registration_endpoint) {
    console.log(`[OAuth Discovery] Registering client at ${authServer.registration_endpoint}`);
    clientRegistration = await registerClient(authServer.registration_endpoint, config);

    if (clientRegistration) {
      storeClientRegistration(config.id, clientRegistration);
      console.log(`[OAuth Discovery] Client registered: ${clientRegistration.client_id}`);
    }
  }

  if (!clientRegistration) {
    console.error('[OAuth Discovery] No client registration available');
    return null;
  }

  // Cache the results
  metadataCache.set(config.url, {
    protectedResource,
    authServer,
    clientRegistration,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return {
    authorizationEndpoint: authServer.authorization_endpoint,
    tokenEndpoint: authServer.token_endpoint,
    clientId: clientRegistration.client_id,
    clientSecret: clientRegistration.client_secret,
    scopes: protectedResource.scopes_supported || config.oauth?.scopes,
  };
}

// Clear cached metadata (e.g., when client registration fails)
export function clearOAuthCache(serverUrl: string): void {
  metadataCache.delete(serverUrl);
}
