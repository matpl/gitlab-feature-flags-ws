FROM node:8
WORKDIR /app
COPY package.json package-lock.json index.js ./
RUN npm ci
ENTRYPOINT ["node", "index"]