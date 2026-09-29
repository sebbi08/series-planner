export default defineEventHandler(() => ({
  allowSignup: process.env.ALLOW_SIGNUP === 'true',
}))
