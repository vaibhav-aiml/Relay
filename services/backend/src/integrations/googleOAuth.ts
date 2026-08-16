import { google } from 'googleapis';
import crypto from 'crypto';

export class GoogleOAuthService {
  private static getEncryptionKey(): Buffer {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    if (!key) {
      // Default fallback 32-byte key for local development
      return crypto.createHash('sha256').update('relay-local-secret-encryption-key-32').digest();
    }
    return crypto.createHash('sha256').update(key).digest();
  }

  /**
   * Encrypts sensitive OAuth credentials at rest using AES-256-GCM.
   */
  public static encryptTokens(tokens: Record<string, unknown>): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(tokens);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts stored OAuth tokens.
   */
  public static decryptTokens<T = Record<string, unknown>>(encryptedData: string): T {
    const key = this.getEncryptionKey();
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encryptedText) {
      throw new Error('Invalid encrypted token payload format');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Creates an authenticated OAuth2Client instance for API calls.
   */
  public static createOAuthClient(): InstanceType<typeof google.auth.OAuth2> {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'mock-client-id';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'mock-client-secret';
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:4000/api/connections/google/callback';

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Generates authorization URL for Google Consent Screen.
   */
  public static getAuthUrl(scopes: string[], state?: string): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });
  }
}
