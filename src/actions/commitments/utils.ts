export function isManagerOrAdmin(role: string) {
  return role === 'ADMIN' || role === 'SYSTEM_ADMIN';
}
