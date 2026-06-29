var fs = require("fs");
var out = "test output";
out += " | node=" + process.versions.node;
out += " | electron=" + process.versions.electron;
out += " | type=" + process.type;
try {
  var e = require("electron");
  out += " | electron.app=" + typeof e.app;
} catch(err) {
  out += " | ERR=" + err.message.substring(0,30);
}
require("fs").writeFileSync("d:/CGY/Vibe Coding/Topo/result.txt", out);
