const query = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined))
  return q.size ? `?${q}` : ''
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body && JSON.stringify(options.body),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

const get = (path) => request(path)
const post = (path, body) => request(path, { method: 'POST', body })
const patch = (path, body) => request(path, { method: 'PATCH', body })
const del = (path) => request(path, { method: 'DELETE' })

export const api = {
  enums: () => get('/enums'),
  health: () => get('/health'),

  profiles: () => get('/profiles'),
  createProfile: (body) => post('/profiles', body),
  updateProfile: (id, body) => patch(`/profiles/${id}`, body),
  deleteProfile: (id) => del(`/profiles/${id}`),
  properties: (profileId) => get(`/profiles/${profileId}/properties`),
  createProperty: (profileId, body) => post(`/profiles/${profileId}/properties`, body),
  updateProperty: (id, body) => patch(`/profiles/properties/${id}`, body),
  deleteProperty: (id) => del(`/profiles/properties/${id}`),

  devices: () => get('/devices'),
  device: (id) => get(`/devices/${id}`),
  createDevice: (body) => post('/devices', body),
  updateDevice: (id, body) => patch(`/devices/${id}`, body),
  deleteDevice: (id) => del(`/devices/${id}`),
  syncDevice: (id) => post(`/devices/${id}/sync`),
  addExtension: (id, body) => post(`/devices/${id}/properties`, body),
  updateDeviceProperty: (id, body) => patch(`/devices/properties/${id}`, body),
  deleteDeviceProperty: (id) => del(`/devices/properties/${id}`),
  sendCommand: (propertyId, value) => post(`/devices/properties/${propertyId}/command`, { value }),
  deviceCommands: (id) => get(`/devices/${id}/commands`),

  certificates: (status) => get(`/birth-certificates${status ? `?status=${status}` : ''}`),
  certificate: (id) => get(`/birth-certificates/${id}`),
  submitCertificate: (payload) => post('/birth-certificates', { payload }),
  acceptCertificate: (id, body) => post(`/birth-certificates/${id}/accept`, body),
  declineCertificate: (id) => post(`/birth-certificates/${id}/decline`),
  declineAllCertificates: () => post('/birth-certificates/decline-all'),
  reopenCertificates: (ids) => post('/birth-certificates/reopen-many', { ids }),
  deleteCertificates: (ids) => post('/birth-certificates/delete-many', { ids }),

  dataLatest: () => get('/data/latest'),
  dataUnapproved: () => get('/data/unapproved'),
  deleteUnapproved: (filters) => post('/data/unapproved/delete', filters),
  promoteData: () => post('/data/promote'),
  dataDeclined: () => get('/data/declined'),
  declineData: (body) => post('/data/declined', body),
  undeclineData: (id) => del(`/data/declined/${id}`),
  propertyHistory: (id, range = '1h') => get(`/data/properties/${id}/history?range=${range}`),
  deviceSeries: (id, range = '1h') => get(`/data/devices/${id}/series?range=${range}`),
  dataStats: (range = '1h') => get(`/data/stats?range=${range}`),

  alerts: (scope) => get(`/alerts${query(scope)}`),
  acknowledgeAlert: (id) => post(`/alerts/${id}/acknowledge`),
  silenceAlert: (id, minutes) => post(`/alerts/${id}/silence`, minutes ? { minutes } : undefined),
  clearAlert: (id) => post(`/alerts/${id}/clear`),
  events: (scope) => get(`/events${query(scope)}`),

  connections: () => get('/connections'),
  createConnection: (body) => post('/connections', body),
  deleteConnection: (id) => del(`/connections/${id}`),

  fields: () => get('/fields'),
  approveField: (body) => post('/fields/approve', body),

  list: (resource) => get(`/${resource}`),
  create: (resource, body) => post(`/${resource}`, body),
  update: (resource, id, body) => patch(`/${resource}/${id}`, body),
  remove: (resource, id) => del(`/${resource}/${id}`),
}
