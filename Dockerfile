FROM node:22-alpine
RUN addgroup -S snakeia-server && adduser -S snakeia-server -G snakeia-server && chown -R snakeia-server:snakeia-server /home/snakeia-server
RUN apk add git
WORKDIR /home/snakeia-server/server
COPY package*.json ./
COPY . .
RUN chown -R snakeia-server:snakeia-server /home/snakeia-server
USER snakeia-server
RUN npm install
ENTRYPOINT npm run start