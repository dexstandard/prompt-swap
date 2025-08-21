# PromptSwap Server — Scheduled Agent Architecture

## Overview
Single-node Fastify backend with cron scheduler and SQLite DB.

## Agent Role
An AI component rebalances positions through a Facade contract. The contract exposes abstract functions where the agent swaps among allowlisted tokens while users may deposit or withdraw funds.

## Scheduler Flow
cron → load users → plan action → simulate → execute → record result.

## Security Model
Funds reside in user-owned smart contracts. Users can deposit and withdraw, and the agent may swap only against allowlisted tokens via the Facade.

## Data Model
users table; executions table.

## Config
DATABASE_URL, CRON.

## Logging
Use structured logging and include `userId`, `agentId`, and `execLogId` in log context whenever those values are available.
