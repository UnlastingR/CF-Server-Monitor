const getSampleData = (sample) => {
  if (!sample || typeof sample !== 'object') return null
  return sample.data || sample.payload || sample.metrics || null
}

const toSortableTimestamp = (value, fallback) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

export function coalesceRealtimeBatchMessages(messages, serverIdFilter = null) {
  const list = Array.isArray(messages) ? messages : []
  const filter = serverIdFilter === null || serverIdFilter === undefined
    ? null
    : String(serverIdFilter)
  const buckets = new Map()
  let sequence = 0
  let messageTs = 0

  for (const message of list) {
    if (!message || message.type !== 'batchUpdate') continue
    messageTs = Math.max(messageTs, toSortableTimestamp(message.ts, 0))

    for (const update of Array.isArray(message.updates) ? message.updates : []) {
      if (!update || update.serverId === undefined || update.serverId === null) continue
      const serverId = String(update.serverId)
      if (filter !== null && serverId !== filter) continue

      let bucket = buckets.get(serverId)
      if (!bucket) {
        bucket = { serverId: update.serverId, reportTs: 0, samples: [] }
        buckets.set(serverId, bucket)
      }

      bucket.reportTs = Math.max(
        bucket.reportTs,
        toSortableTimestamp(update.reportTs ?? update.report_timestamp ?? message.ts, 0)
      )

      for (const sample of Array.isArray(update.samples) ? update.samples : []) {
        const data = getSampleData(sample)
        if (!data) continue
        sequence += 1
        const rawTs = sample.ts ?? sample.timestamp ?? data.sample_timestamp ??
          data.last_updated ?? data.timestamp ?? update.ts ?? message.ts
        bucket.samples.push({
          data,
          rawTs,
          sortTs: toSortableTimestamp(rawTs, sequence),
          sequence
        })
      }
    }
  }

  const updates = []
  for (const bucket of buckets.values()) {
    if (bucket.samples.length === 0) continue
    bucket.samples.sort((a, b) => a.sortTs - b.sortTs || a.sequence - b.sequence)

    const mergedData = {}
    for (const sample of bucket.samples) Object.assign(mergedData, sample.data)
    const latest = bucket.samples[bucket.samples.length - 1]

    updates.push({
      serverId: bucket.serverId,
      reportTs: bucket.reportTs || messageTs || latest.sortTs,
      samples: [{ ts: latest.rawTs ?? latest.sortTs, data: mergedData }]
    })
  }

  if (updates.length === 0) return null
  return {
    type: 'batchUpdate',
    ts: messageTs || Date.now(),
    updates
  }
}
