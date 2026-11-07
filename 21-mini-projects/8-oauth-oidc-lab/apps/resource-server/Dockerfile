FROM node:22-alpine AS build
WORKDIR /workspace
RUN npm install --global pnpm@10.33.4
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/resource-server/package.json apps/resource-server/package.json
RUN pnpm install --frozen-lockfile --filter @oauth-lab/resource-server...
COPY apps/resource-server apps/resource-server
RUN pnpm --filter @oauth-lab/resource-server build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
RUN npm install --global pnpm@10.33.4
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/resource-server/package.json apps/resource-server/package.json
RUN pnpm install --frozen-lockfile --prod --filter @oauth-lab/resource-server...
COPY --from=build /workspace/apps/resource-server/dist apps/resource-server/dist
EXPOSE 4000
CMD ["pnpm", "--filter", "@oauth-lab/resource-server", "start"]
