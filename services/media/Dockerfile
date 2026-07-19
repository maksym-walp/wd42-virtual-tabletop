FROM node:20-alpine AS base
WORKDIR /app
# Сюди монтується volume media_data. Docker переносить власника теки з образу
# у named volume ЛИШЕ під час першого монтування, тож цей chown має існувати
# в образі до того, як volume створено — інакше /uploads залишиться root-owned
# і продакшн-стадія (USER node, uid 1000) не зможе туди писати.
RUN mkdir -p /uploads && chown node:node /uploads
COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
# USER node і в dev теж — на відміну від решти сервісів. Цей сервіс створює
# підтеки в /uploads під час роботи, і власник у них — той, хто їх створив.
# Якби dev працював від root, підтеки лягли б root-owned у спільний volume,
# і продакшн-контейнер (uid 1000) потім не зміг би в них писати.
USER node
CMD ["npm", "run", "dev"]

FROM base AS production
RUN npm ci --only=production
COPY --chown=node:node . .
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get({host:'localhost',port:process.env.PORT||3000,path:'/'},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "src/index.js"]
