import * as bcrypt from 'bcrypt';

export type Rol = 'ASESOR' | 'SUPERVISOR' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  nombres: string;
  roles: Rol[];
}

/**
 * Mock user database. In production this would be Mongo / IdP / Keycloak.
 * Passwords pre-hashed with bcrypt(rounds=10) at module load time.
 *
 * Credenciales de prueba:
 *   asesor   / asesor123    → rol ASESOR
 *   supervisor / super123   → rol SUPERVISOR (puede aprobar/rechazar/finalizar)
 *   admin    / admin123     → roles ASESOR + SUPERVISOR + ADMIN
 */
const SEED: Array<Omit<User, 'passwordHash'> & { plainPassword: string }> = [
  { id: 'usr_asesor_001', username: 'asesor', plainPassword: 'asesor123', nombres: 'Asesor de Pruebas', roles: ['ASESOR'] },
  { id: 'usr_super_001', username: 'supervisor', plainPassword: 'super123', nombres: 'Supervisor de Pruebas', roles: ['SUPERVISOR'] },
  { id: 'usr_admin_001', username: 'admin', plainPassword: 'admin123', nombres: 'Admin BCS', roles: ['ASESOR', 'SUPERVISOR', 'ADMIN'] },
];

export const MOCK_USERS: User[] = SEED.map((u) => ({
  id: u.id,
  username: u.username,
  passwordHash: bcrypt.hashSync(u.plainPassword, 10),
  nombres: u.nombres,
  roles: u.roles,
}));

export function findByUsername(username: string): User | undefined {
  return MOCK_USERS.find((u) => u.username === username.toLowerCase());
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
