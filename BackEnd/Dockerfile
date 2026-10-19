FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
COPY BackEnd/package.json ./BackEnd/package.json
COPY FrontEnd/package.json ./FrontEnd/package.json
COPY BackEnd/prisma ./BackEnd/prisma
COPY BackEnd/prisma.config.ts ./BackEnd/prisma.config.ts
RUN npm ci --workspace=backend --include-workspace-root=false

COPY BackEnd/ ./BackEnd/
WORKDIR /app/BackEnd
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
