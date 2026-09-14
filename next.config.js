/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/build (dev-only Jarvis self-builder) leest projectbestanden dynamisch;
  // zonder exclude traceert Next het hele project de serverbundle in
  outputFileTracingExcludes: {
    '/api/build': ['./**/*'],
    '/api/chat': ['./**/*'],
  },
}
module.exports = nextConfig
