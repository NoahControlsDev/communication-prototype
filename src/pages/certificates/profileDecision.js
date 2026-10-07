// Helpers behind the "which profile?" choice, shared by single and group accept.

// Guesses from the field name, unless the certificate says otherwise. Always review.
export function suggest(f) {
  const k = f.key
  const kind = f.kind
    ?? (/alarm|fault/i.test(k) ? 'alarm'
      : /(command|cmd|enable|sp)$/i.test(k) ? 'command'
      : /(status|state|running|mode)$/i.test(k) ? 'status'
      : 'measure')
  return {
    include: true,
    key: k,
    kind,
    type: f.type ?? (kind === 'alarm' ? 'bool' : 'float'),
    unit: f.unit ?? '',
    writable: f.writable ?? kind === 'command',
    required: true,
    // Carried straight from the certificate; the gateway is the source of truth for these.
    ...Object.fromEntries(['min', 'max', 'acquisition', 'deadband'].filter((m) => f[m] !== undefined).map((m) => [m, f[m]])),
  }
}

// Declared profile first, then an exact match; otherwise start on "create new".
export function initialChoice(cert) {
  const first = cert.candidates.find((c) => c.declared) ?? cert.candidates.find((c) => c.exact)
  return first ? String(first.id) : 'new'
}

export function initialNewProfile(cert) {
  return { key: cert.declared_profile?.split('@')[0] ?? '', major: 1, minor: 0, fields: cert.fields.map(suggest) }
}

// → the `profile` part of an accept request
export function profileDecision(choice, newProfile) {
  if (choice !== 'new') return { mode: 'existing', profile_id: Number(choice) }
  return {
    mode: 'new', key: newProfile.key, major: newProfile.major, minor: newProfile.minor,
    properties: newProfile.fields.filter((f) => f.include).map(({ include: _include, ...p }) => p),
  }
}
