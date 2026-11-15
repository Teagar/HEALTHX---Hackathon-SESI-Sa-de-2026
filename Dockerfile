# SESILITA — imagem de produção: API Express + site estático (dist/) num único processo Node.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# prebuild copia o OCR local (Tesseract + modelo pt) e o worker do pdf.js para public/ocr.
RUN npm run build && npm run build:server

FROM node:22-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/build/server.mjs ./server.mjs
COPY data ./data
COPY server/data ./server/data
RUN chown -R node:node /app/data /app/server/data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1
CMD ["node", "server.mjs"]
