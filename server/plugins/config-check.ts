export default defineNitroPlugin(() => {
  const problem = sessionPasswordProblem()
  if (problem) {
    console.error(`[config] ${problem} — every login will fail. Set it to at least 32 random characters, e.g. \`openssl rand -base64 48\`, and recreate the container.`)
  }
})
