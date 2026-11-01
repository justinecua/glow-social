FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite bakes these into the bundle at build time
ARG VITE_HOST=http://localhost:8000
ARG VITE_WS_HOST=ws://localhost:8000
ENV VITE_HOST=$VITE_HOST VITE_WS_HOST=$VITE_WS_HOST
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
