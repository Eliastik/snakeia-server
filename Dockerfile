FROM node:17-alpine
WORKDIR /opt/snakeia-server
COPY package*.json ./
COPY . .
RUN npm install
ENTRYPOINT npm run start