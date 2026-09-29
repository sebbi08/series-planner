export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const stream = createEventStream(event)
  const remove = addSeriesListener(user.name, stream)
  // keep-alive so proxies (Traefik) do not close idle connections
  const ping = setInterval(() => {
    stream.push({ event: 'ping', data: '' }).catch(() => {})
  }, 25_000)
  stream.onClosed(async () => {
    clearInterval(ping)
    remove()
    await stream.close()
  })
  return stream.send()
})
