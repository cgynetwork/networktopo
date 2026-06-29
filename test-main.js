var fs = require("fs");
var out = [];
out.push("pt=" + process.type);
out.push("da=" + process.defaultApp);
// Check NODE_PATH
out.push("NP=" + (process.env.NODE_PATH || "none"));
// Check module.paths
out.push("mp=" + JSON.stringify(module.paths.slice(0,3)));
// Check where electron resolves
var m = require("module");
try {
  var r = m._resolveFilename("electron");
  out.push("res=" + r);
} catch(e) {
  out.push("res_err=" + e.message);
}
var e = require("electron");
out.push("app=" + typeof e.app + " bw=" + typeof e.BrowserWindow);
fs.writeFileSync("d:/CGY/Vibe Coding/Topo/result.txt", out.join("|"));
