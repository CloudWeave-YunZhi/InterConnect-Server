FROM node:22-alpine AS panel-builder

WORKDIR /panel
ARG PANEL_BASE_PATH=/admin

COPY panel/package*.json ./
RUN npm ci

COPY panel ./
RUN PANEL_BASE_PATH="/${PANEL_BASE_PATH#/}" \
    && PANEL_BASE_PATH="${PANEL_BASE_PATH%/}" \
    && VITE_APP_BASE_PATH="${PANEL_BASE_PATH}/" npm run build

FROM nginx:1.27-alpine
ARG PANEL_BASE_PATH=/admin

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=panel-builder /panel/dist/ /usr/share/nginx/html/admin/
RUN PANEL_BASE_PATH="/${PANEL_BASE_PATH#/}" \
    && PANEL_BASE_PATH="${PANEL_BASE_PATH%/}" \
    && sed -i "s|return 302 /admin/;|return 302 ${PANEL_BASE_PATH}/;|g" /etc/nginx/conf.d/default.conf \
    && sed -i "s|location /admin/ {|location ${PANEL_BASE_PATH}/ {|g" /etc/nginx/conf.d/default.conf \
    && sed -i "s|/admin/index.html;|${PANEL_BASE_PATH}/index.html;|g" /etc/nginx/conf.d/default.conf

EXPOSE 80
