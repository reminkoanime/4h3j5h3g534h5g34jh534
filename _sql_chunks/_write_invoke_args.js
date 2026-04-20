const fs = require("fs");
const path = require("path");
const base = __dirname;
for (let i = 1; i <= 4; i++) {
  const j = JSON.parse(
    fs.readFileSync(path.join(base, `mcp_payload_${i}.json`), "utf8")
  );
  fs.writeFileSync(
    path.join(base, `_invoke_args_${i}.json`),
    JSON.stringify(j)
  );
}
console.log("ok");
