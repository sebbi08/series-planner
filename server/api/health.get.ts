export default defineEventHandler(async (event) => {
  const up = await pingDb()
  const sessionProblem = sessionPasswordProblem()
  const healthy = up && !sessionProblem
  setResponseStatus(event, healthy ? 200 : 503)
  return {
    status: healthy ? 'ok' : 'degraded',
    db: up ? 'up' : 'down',
    session: sessionProblem ? 'misconfigured' : 'ok',
    version: process.env.APP_VERSION || 'dev',
  }
})
