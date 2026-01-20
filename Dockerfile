FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8000

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8000

CMD ["node", "src/server.js"]
