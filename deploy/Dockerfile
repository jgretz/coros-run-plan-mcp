ARG BUN_VERSION=1.3.10
FROM oven/bun:${BUN_VERSION}-slim AS base

LABEL fly_launch_runtime="Bun"

WORKDIR /app
ENV NODE_ENV="production"

FROM base AS build

COPY --link bun.lock package.json tsconfig.json ./
RUN bun install --frozen-lockfile

COPY --link src ./src

FROM base

COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/tsconfig.json /app/tsconfig.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/src /app/src

EXPOSE 3000
CMD ["bun", "run", "src/http.ts"]
