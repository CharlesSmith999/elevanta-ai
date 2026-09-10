export class ConfigurationError extends Error {}

export function supabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new ConfigurationError('CRM server configuration is incomplete. Contact your administrator.');
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw new Error();
  } catch {
    throw new ConfigurationError('CRM server connection configuration is invalid. Contact your administrator.');
  }
  return { url, anonKey };
}
