#!/usr/bin/env node
'use strict';
// Einstieg des CLI `slopdogs-typedefs`. Liegt als fertiges JavaScript im Paket (nicht unter dist/), damit npm den
// bin-Link auch dann anlegt, wenn das Paket beim Installieren noch nicht gebaut ist (Workspace im Monorepo).
require('../dist/cli.js');
