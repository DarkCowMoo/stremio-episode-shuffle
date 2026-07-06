FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=7005
EXPOSE 7005
USER node
CMD ["node", "server.js"]
