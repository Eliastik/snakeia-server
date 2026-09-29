FROM node:24-alpine
RUN addgroup -S snakeia-server && adduser -S snakeia-server -G snakeia-server && chown -R snakeia-server:snakeia-server /home/snakeia-server
RUN apk add git curl
WORKDIR /home/snakeia-server/server
COPY package*.json ./
COPY . .
RUN chown -R snakeia-server:snakeia-server /home/snakeia-server
USER snakeia-server
RUN npm install
ENTRYPOINT npm run start
ENV ENABLE_HEALTHCHECK=true
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/healthcheck || exit 1