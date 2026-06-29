var fs = require("fs");
var out = [];
try {
  var e = require("electron");
  out.push("electron OK: app=" + typeof e.app + " BrowserWindow=" + typeof e.BrowserWindow);
  out.push("process.type: " + process.type);
} catch(err) {
  out.push("electron FAIL: " + err.message);
  out.push("process.type: " + process.type);
}
fs.writeFileSync("d:/CGY/Vibe Coding/Topo/temp-result.txt", out.join("\n"), "utf8");
