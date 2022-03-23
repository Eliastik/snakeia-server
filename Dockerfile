FROM node:17-alpine
WORKDIR /opt/snakeia-server
COPY package*.json ./
COPY . .
RUN npm install
RUN npm run start
ENTRYPOINT npm run start