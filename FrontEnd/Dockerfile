FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY BackEnd/package.json ./BackEnd/package.json
COPY FrontEnd/package.json ./FrontEnd/package.json
RUN npm ci --workspace=frontend --include-workspace-root=false
COPY FrontEnd/ ./FrontEnd/
WORKDIR /app/FrontEnd
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/FrontEnd/dist /usr/share/nginx/html
COPY FrontEnd/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
