const { spawn } = require("node:child_process");
const path = require("node:path");

const incoming = process.argv.slice(2);
const forwarded = [];

for (let index = 0; index < incoming.length; index += 1) {
  const argument = incoming[index];
  if (argument === "--host") {
    index += 1;
    continue;
  }
  if (argument.startsWith("--host=") || argument === "--strictPort") continue;
  forwarded.push(argument);
}

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "node_modules", "@11ty", "eleventy", "cmd.cjs");
const child = spawn(process.execPath, [cli, "--serve", ...forwarded], {
  cwd: root,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
