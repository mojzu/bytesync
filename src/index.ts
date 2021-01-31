export * from "./types";
export * from "./server";
export * from "./client";

// TODO: Package test command implementation
// Something that can be run in CI without a browser (test server + client script?)
// Something that can be run in a browser (client ui, enter server details?)
// Can these depend on the same set of tests somehow?

// TODO: Package lint, other useful commands

// TODO: Binary output support using nexe (for docker?)
// "nexe": "npm run dist && nexe ./dist/es2017/bin/bytesync-dev.js",
// "nexe": "^4.0.0-beta.17",

// TODO: Improved logging output, wait for better implementation?
// import logger from "morgan";
// app.use(logger('dev'));
