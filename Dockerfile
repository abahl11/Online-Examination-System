FROM node:20-alpine

WORKDIR /usr/src/testdesk

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

USER node
CMD ["node", "src/server.js"]
