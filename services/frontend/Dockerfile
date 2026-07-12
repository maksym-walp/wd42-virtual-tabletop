FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM base AS development
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN npm install -g serve
COPY --from=build --chown=node:node /app/dist ./dist
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get({host:'localhost',port:5173,path:'/'},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["serve", "-s", "dist", "-l", "5173"]
