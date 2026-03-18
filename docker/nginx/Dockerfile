FROM node:22-alpine AS panel-builder

WORKDIR /panel

COPY panel/package*.json ./
RUN npm ci

COPY panel ./
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=panel-builder /panel/dist/ /usr/share/nginx/html/admin/

EXPOSE 80
