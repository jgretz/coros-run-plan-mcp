import type { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

// Resource-server auth for the hosted MCP. Accepts either:
//   - a JWT issued by the shared OAuth AS (OAUTH_ISSUER), validated against its
//     JWKS with issuer + audience checks (this is what claude.ai / the phone use), or
//   - the static MCP_AUTH_TOKEN bearer (local dev + the Desktop mcp-remote bridge).
// On a missing/invalid token it returns 401 with a WWW-Authenticate header
// pointing at this server's protected-resource metadata, so OAuth clients can
// discover the authorization server.

let jwks: JWTVerifyGetKey | null = null;
function getJwks(issuer: string): JWTVerifyGetKey {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return jwks;
}

function resourceId(): string {
  return (process.env.MCP_RESOURCE ?? '').replace(/\/$/, '');
}

export function protectedResourceMetadata() {
  const resource = resourceId();
  const issuer = process.env.OAUTH_ISSUER ?? '';
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  };
}

function unauthorized(c: Context): Response {
  const resource = resourceId();
  const metadataUrl = resource ? `${new URL(resource).origin}/.well-known/oauth-protected-resource` : '';
  if (metadataUrl) {
    c.header('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"`);
  }
  return c.json({ error: 'unauthorized' }, 401);
}

export async function authGate(c: Context, next: Next): Promise<Response | void> {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) return unauthorized(c);

  // Static fallback (local dev + Desktop mcp-remote bridge).
  const staticToken = process.env.MCP_AUTH_TOKEN;
  if (staticToken && token === staticToken) return next();

  // JWT from the shared authorization server.
  const issuer = process.env.OAUTH_ISSUER;
  const resource = resourceId();
  if (issuer && resource) {
    try {
      await jwtVerify(token, getJwks(issuer), {
        issuer,
        audience: [resource, new URL(resource).origin],
      });
      return next();
    } catch {
      // fall through to 401
    }
  }

  return unauthorized(c);
}
