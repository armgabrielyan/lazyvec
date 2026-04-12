#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./App";
import { loadConnectionState } from "./config/connections";

const connectionState = await loadConnectionState(process.argv.slice(2));

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
});

createRoot(renderer).render(<App connectionState={connectionState} />);
