import { describe, expect, it } from "vitest";
import { analyzePackage, evaluatePolicy, scanContent } from "./index.js";

const meta=(extra={})=>({name:"clean",version:"1.0.0",maintainers:["a"],repository:"x",dependencies:0,scripts:{},...extra});
describe("Tarsen analyzer",()=>{
  it("detects command execution and sensitive env access",()=>{const types=scanContent("require('child_process').exec('x'); console.log(process.env.TOKEN)","index.js").map(x=>x.type);expect(types).toContain("dangerous_execution");expect(types).toContain("environment_access");});
  it("does not make NODE_ENV high risk",()=>{const report=analyzePackage(meta(),[{path:"index.js",content:"if(process.env.NODE_ENV !== 'production'){}"}]);expect(report.risk).toBe("low");expect(report.signals[0].severity).toBe("low");});
  it("makes lifecycle scripts high risk",()=>{const report=analyzePackage(meta({scripts:{postinstall:"node setup.js"}}),[]);expect(report.risk).toBe("high");expect(report.recommendation).toBe("do_not_run_without_user_confirmation");});
  it("marks clean packages low risk",()=>{expect(analyzePackage(meta(),[{path:"index.js",content:"export const answer = 42"}]).risk).toBe("low");});
  it("detects likely typosquatting",()=>{expect(analyzePackage(meta({name:"expres"}),[]).signals.some(x=>x.type==="typosquatting")).toBe(true);});
  it("enforces policy block and allow lists",()=>{const report=analyzePackage(meta(),[]);expect(evaluatePolicy(report,{blockPackages:["clean"]}).decision).toBe("block");expect(evaluatePolicy(report,{allowPackages:["clean"]}).decision).toBe("allow");});
});
