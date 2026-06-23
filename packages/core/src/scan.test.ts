import { describe, expect, it } from "vitest";
import { scanContent, scanFiles } from "./scan.js";

describe("dangerous execution detection", () => {
  it("flags child_process require + exec", () => {
    const types = scanContent("require('child_process').exec('rm -rf /')", "index.js").map(
      (s) => s.type,
    );
    expect(types).toContain("dangerous_execution");
  });
  it("flags spawn( and execSync(", () => {
    const t = scanContent("const {execSync}=require('child_process'); spawn('x');", "i.js").map(
      (s) => s.type,
    );
    expect(t).toContain("dangerous_execution");
  });
  it("flags shell:true construction", () => {
    const t = scanContent("cp('x',{shell:true})", "i.js").map((s) => s.type);
    expect(t).toContain("shell_command");
  });
});

describe("dynamic execution detection", () => {
  it("flags eval( and new Function(", () => {
    const t = scanContent("eval('1'); new Function('x')();", "i.js").map((s) => s.type);
    expect(t).toContain("dynamic_execution");
  });
});

describe("environment access detection", () => {
  it("treats arbitrary env keys as high risk", () => {
    const s = scanContent("process.env.SECRET_TOKEN", "i.js");
    expect(s.find((x) => x.type === "environment_access")?.severity).toBe("high");
  });
  it("treats NODE_ENV/DEBUG/CI as low risk", () => {
    const s = scanContent("if(process.env.NODE_ENV !== 'production'){}", "i.js");
    const env = s.find((x) => x.type === "environment_access");
    expect(env?.severity).toBe("low");
  });
});

describe("filesystem detection", () => {
  it("flags fs.writeFile / fs.rm / fs.unlink as writes", () => {
    for (const code of ["fs.writeFile('a')", "fs.rm('a')", "fs.unlink('a')"]) {
      expect(
        scanContent(code, "i.js").some((s) => s.type === "filesystem_write"),
      ).toBe(true);
    }
  });
  it("flags fs.readFile and os.homedir as reads", () => {
    const t = scanContent("const h = require('os').homedir(); fs.readFile(h)", "i.js").map(
      (s) => s.type,
    );
    expect(t).toContain("filesystem_read");
  });
});

describe("network detection", () => {
  it("flags fetch, http.request, axios, XHR, WebSocket", () => {
    for (const code of [
      "fetch('https://x')",
      "http.request({})",
      "axios.get('x')",
      "new XMLHttpRequest()",
      "new WebSocket('wss://x')",
    ]) {
      expect(scanContent(code, "i.js").some((s) => s.type === "network_access")).toBe(true);
    }
  });
});

describe("obfuscation heuristics", () => {
  it("flags very long lines", () => {
    const long = "x".repeat(2500);
    expect(scanContent(long, "i.js").some((s) => s.type === "obfuscation")).toBe(true);
  });
  it("flags base64-like blobs", () => {
    const blob = "A".repeat(1200);
    expect(scanContent(blob, "i.js").some((s) => s.type === "obfuscation")).toBe(true);
  });
  it("does not flag normal code", () => {
    expect(scanContent("export const answer = 42;", "i.js")).toHaveLength(0);
  });
});

describe("lifecycle scripts", () => {
  // Lifecycle signals come from metadata, but scan must not double-fire.
  it("does not classify a plain postinstall string in source as execution", () => {
    const s = scanContent('const s = "postinstall"', "i.js");
    expect(s.some((x) => x.type === "dangerous_execution")).toBe(false);
  });
});

describe("scanFiles aggregation", () => {
  it("merges signals across files and dedupes per type+file", () => {
    const signals = scanFiles([
      { path: "a.js", content: "fetch('x')" },
      { path: "a.js", content: "fetch('y')" },
      { path: "b.js", content: "eval('z')" },
    ]);
    const network = signals.filter((s) => s.type === "network_access");
    expect(network).toHaveLength(2); // one per file
    expect(signals.some((s) => s.type === "dynamic_execution")).toBe(true);
  });
});
