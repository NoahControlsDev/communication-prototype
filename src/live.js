import { useEffect, useMemo } from 'react'
import { api } from './api.js'
import { useLoad } from './lib.js'
import { deviceState } from './plant/model.js'

export function useLive(pollMs = 5000) {
  const devices = useLoad(api.devices)
  const profiles = useLoad(api.profiles)
  const latest = useLoad(api.dataLatest)

  const { reload: reloadDevices } = devices
  const { reload: reloadLatest } = latest
  useEffect(() => {
    const t = setInterval(() => { reloadLatest(); reloadDevices() }, pollMs)
    return () => clearInterval(t)
  }, [pollMs, reloadLatest, reloadDevices])

  const states = useMemo(() => {
    if (!devices.data || !profiles.data || !latest.data) return new Map()
    const profileById = new Map(profiles.data.map((p) => [p.id, p]))
    return new Map(devices.data.map((d) => [d.id,
      deviceState(d, profileById.get(d.profile_id), latest.data.filter((r) => r.device_id === d.id))]))
  }, [devices.data, profiles.data, latest.data])

  return {
    devices: devices.data ?? [],
    loaded: Boolean(devices.data && profiles.data && latest.data),
    states,
    errors: [devices.error, profiles.error, latest.error],
    reload: () => { reloadDevices(); reloadLatest() },
  }
}
