FROM node:24-bookworm-slim AS node

FROM python:3.12-slim-bookworm AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends libatomic1 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

FROM base AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY python/requirements.txt ./python/requirements.txt
RUN python -m venv /opt/newboy-venv \
  && /opt/newboy-venv/bin/pip install --no-cache-dir -r python/requirements.txt

COPY --from=build /app/dist ./dist
COPY python ./python
COPY assets ./assets

ENV NODE_ENV=production \
  HOTARU_PYTHON=/opt/newboy-venv/bin/python \
  LAB_PYTHON=/opt/newboy-venv/bin/python

EXPOSE 3031
CMD ["npm", "run", "start"]
