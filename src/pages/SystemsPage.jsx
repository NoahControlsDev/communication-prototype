import { useState } from 'react'
import { api } from '../api.js'
import { useLoad, useAction } from '../lib.js'
import { PageHeader, Card, Errors, Empty } from '../ui.jsx'
import { useLive } from '../live.js'
import { Pill, groupStatus } from '../workspace.jsx'

// All systems as cards: name, how many devices, and the worst condition among them.
export default function SystemsPage() {
  const systems = useLoad(() => api.list('systems'))
  const live = useLive()
  const action = useAction()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const create = async (e) => {
    e.preventDefault()
    if (await action.run(() => api.create('systems', { name }))) {
      setName('')
      setAdding(false)
      systems.reload()
    }
  }

  return (
    <>
      <PageHeader title="All Systems" current="Systems" subtitle="Groups of devices that work together, such as a heating plant.">
        {!adding && <button className="primary" onClick={() => setAdding(true)}>Add System</button>}
      </PageHeader>
      <Errors errors={[systems.error, action.error, ...live.errors]} />

      {adding && (
        <Card title="Add system">
          <form className="inline-form" onSubmit={create}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 06 Heating" required />
            <button className="primary">Add system</button>
            <button type="button" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        </Card>
      )}

      {systems.data?.length === 0 && <Empty>No systems yet. Add one, then commission devices into it.</Empty>}
      <div className="system-cards">
        {systems.data?.map((sys) => {
          const states = live.devices.filter((d) => d.system_id === sys.id).map((d) => live.states.get(d.id)).filter(Boolean)
          const status = groupStatus(states)
          return (
            <a key={sys.id} className="system-card" href={`#/systems/${sys.id}`}>
              <div>
                <strong>{sys.name}</strong>
                <span className="sub">{sys.device_count} device{sys.device_count === 1 ? '' : 's'}</span>
              </div>
              {live.loaded && <Pill tone={status.tone}>{status.label}</Pill>}
            </a>
          )
        })}
      </div>
    </>
  )
}
