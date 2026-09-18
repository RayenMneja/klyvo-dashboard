FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY public ./public
COPY server ./server
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
