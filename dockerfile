FROM node:20-alpine

WORKDIR /app

VOLUME ["/app/data"]

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8000

CMD ["npm", "run", "start", "serve"]