FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/package.json ./package.json
USER node
EXPOSE 3001
CMD ["npm", "start"]
