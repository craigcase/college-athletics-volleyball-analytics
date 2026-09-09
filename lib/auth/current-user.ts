export type CurrentUser = { id?: string; email: string; name?: string };

export function getCurrentUserFromHeaders(headers: Headers): CurrentUser | null {
  const email = headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email) return null;
  const id = headers.get('oai-authenticated-user-id')?.trim() || undefined;
  const rawName = headers.get('oai-authenticated-user-full-name')?.trim() || undefined;
  const encoding = headers.get('oai-authenticated-user-full-name-encoding')?.toLowerCase();
  let name = rawName;
  if (rawName && encoding === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(rawName); } catch { name = rawName; }
  }
  return { ...(id ? { id } : {}), email, ...(name ? { name } : {}) };
}

export function requireCurrentUser(headers: Headers): CurrentUser {
  const user = getCurrentUserFromHeaders(headers);
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
