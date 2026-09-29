export default defineEventHandler(async (event) => {
  const up = await pingDb()
  setResponseStatus(event, up ? 200 : 503)
  return { status: up ? 'ok' : 'degraded', db: up ? 'up' : 'down', version: process.env.APP_VERSION || 'dev' }
})
