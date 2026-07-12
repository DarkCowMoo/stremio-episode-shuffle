FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Beamup overrides the image command with `start`, which the Node image
# resolves as /start. Supply that compatibility entrypoint explicitly.
COPY beamup-start.js /start
ENV PORT=7005
EXPOSE 7005
USER node
CMD ["node", "server.js"]
