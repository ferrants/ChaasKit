#!/bin/sh

pnpm db:generate
pnpm build
pnpm run pack:local
