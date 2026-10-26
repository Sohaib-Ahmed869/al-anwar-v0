# ---------------------------------------------------------------------------
# The API's image, for the EC2 deploy (compose.yaml runs it beside MongoDB).
#
# The server runs straight from TypeScript through tsx, which is a dev
# dependency, so the install keeps dev dependencies. mongodb-memory-server (also
# a dev dependency, for tests and local dev) would download a MongoDB binary on
# install; the image never uses it, so that download is switched off.
#
# The site is not built here: Vercel builds and serves it. CMD is the exec form
# so node is PID 1 and gets the SIGTERM a deploy sends, which lets the API
# finish the job in hand (server/index.ts) instead of being cut off mid-charge.
# ---------------------------------------------------------------------------
FROM node:22-slim
WORKDIR /app

ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
ENV NODE_ENV=production
EXPOSE 4600
CMD ["node", "--import", "tsx", "server/index.ts"]
