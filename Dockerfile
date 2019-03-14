FROM node:8
WORKDIR /app
COPY package.json package-lock.json index.js ./
RUN npm ci
# https://gitlab.com/api/v4/feature_flags/unleash/10251209 * K27Cwg-DkvSSQ2TVpaBC
ENTRYPOINT ["node", "index"]