export interface Connection {
  id: string;
  userId: string;
  provider: 'google';
  email?: string;
  scopes: string[];
  encryptedCredentialRef: string; // Pointer or encrypted ciphertext ID, never raw tokens in client
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  updatedAt: string;
}
