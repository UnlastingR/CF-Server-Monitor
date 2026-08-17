import test from 'node:test'
import assert from 'node:assert/strict'

import { coalesceRealtimeBatchMessages } from '../src/frontend/utils/realtimeUi.js'

test('coalesces staggered realtime messages into one update per server', () => {
  const result = coalesceRealtimeBatchMessages([
    { type: 'batchUpdate', ts: 1000, updates: [{ serverId: 'a', samples: [{ ts: 1000, data: { cpu: 10 } }] }] },
    { type: 'batchUpdate', ts: 1200, updates: [{ serverId: 'b', samples: [{ ts: 1200, data: { cpu: 20 } }] }] },
    { type: 'batchUpdate', ts: 1800, updates: [{ serverId: 'a', samples: [{ ts: 1800, data: { cpu: 30 } }] }] }
  ])

  assert.equal(result.updates.length, 2)
  const a = result.updates.find(update => update.serverId === 'a')
  assert.equal(a.samples.length, 1)
  assert.equal(a.samples[0].ts, 1800)
  assert.equal(a.samples[0].data.cpu, 30)
})

test('merges fields from samples collected during the same UI second', () => {
  const result = coalesceRealtimeBatchMessages([
    { type: 'batchUpdate', ts: 1000, updates: [{ serverId: 'a', samples: [{ ts: 1000, data: { gpu_info: 'report', net_in_speed: 10 } }] }] },
    { type: 'batchUpdate', ts: 1900, updates: [{ serverId: 'a', samples: [{ ts: 1900, data: { net_in_speed: 20, net_out_speed: 5 } }] }] }
  ])

  assert.deepEqual(result.updates[0].samples[0].data, {
    gpu_info: 'report',
    net_in_speed: 20,
    net_out_speed: 5
  })
})

test('can restrict coalescing to one detail-page server', () => {
  const result = coalesceRealtimeBatchMessages([
    { type: 'batchUpdate', ts: 1000, updates: [
      { serverId: 'a', samples: [{ ts: 1000, data: { cpu: 10 } }] },
      { serverId: 'b', samples: [{ ts: 1000, data: { cpu: 20 } }] }
    ] }
  ], 'b')

  assert.equal(result.updates.length, 1)
  assert.equal(result.updates[0].serverId, 'b')
})
