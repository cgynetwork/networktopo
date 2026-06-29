var fs = require("fs");
var e = require("electron");
var out = [];
out.push("process.type: " + process.type);
out.push("defaultApp: " + process.defaultApp);
out.push("electron type: " + typeof e);
out.push("electron.app: " + typeof e.app);
out.push("electron keys count: " + Object.keys(e).length);
// Check if this is the npm package (has cli.js resolution) or built-in
try {
  var path = require("module")._resolveFilename("electron");
  out.push("resolved to: " + path);
} catch(err) {
  out.push("resolve err: " + err.message);
}
fs.writeFileSync("d:/CGY/Vibe Coding/Topo/result.txt", out.join("\n"));
