import { EmailService } from '../services/emailService'
import { logger } from '../utils/logger'

type Job = {
  id: string
  payload: any
}

const queue: Job[] = []
let processing = false

export function enqueueEmail(job: Job) {
  queue.push(job)
  logger.info('emailWorker: enqueued job', { id: job.id })
}

async function processJob(job: Job) {
  try {
    const { to, template, variables, subject, text, from } = job.payload
    const res = await EmailService.send({ to, template, variables, subject, text, from })
    if (res.success) {
      logger.info('emailWorker: job sent', { id: job.id, provider: res.provider })
    } else {
      logger.error('emailWorker: job failed', { id: job.id, error: res.error })
    }
  } catch (err) {
    logger.error('emailWorker: unexpected error', { err })
  }
}

async function workerLoop() {
  if (processing) return
  processing = true
  while (queue.length > 0) {
    const job = queue.shift()
    if (!job) break
    // basic try/catch + backoff could be added here
    // process without blocking other async tasks
    // eslint-disable-next-line no-await-in-loop
    await processJob(job)
  }
  processing = false
}

// Periodic loop to drain queue
setInterval(() => {
  if (queue.length > 0) workerLoop()
}, 1000)

export default { enqueueEmail }
