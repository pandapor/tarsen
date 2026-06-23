export type RiskLevel = "low" | "medium" | "high" | "unknown";
export type Recommendation = "safe_to_run" | "ask_user" | "do_not_run_without_user_confirmation" | "unknown_ask_user";
export type SignalSeverity = "low" | "medium" | "high";

export interface RiskSignal { type: string; severity: SignalSeverity; message: string; file?: string; evidence?: string; }
export interface PackageMetadata { name: string; version: string; description?: string; repository?: string | null; maintainers: string[]; publishedAt?: string; dependencies: number; scripts: Record<string,string>; tarball?: string; unpackedSize?: number; fileCount?: number; bin?: string | Record<string,string>; }
export interface RiskReport { schemaVersion: "1.0"; package: string; version: string; risk: RiskLevel; score: number; recommendation: Recommendation; signals: RiskSignal[]; metadata: PackageMetadata; analyzedAt: string; stats: { filesScanned: number; bytesScanned: number; truncated: boolean }; }
export interface TeamPolicy { block?: string[]; requireConfirmation?: string[]; allowPackages?: string[]; blockPackages?: string[]; defaultDecision?: "allow"|"warn"|"block"; }
export interface PolicyResult { decision:"allow"|"warn"|"block"; reasons:string[]; }

const patterns: Array<{ type: string; severity: SignalSeverity; message: string; pattern: RegExp }> = [
  { type: "dangerous_execution", severity: "high", message: "child process execution detected", pattern: /(?:node:)?child_process|\b(?:execSync|spawnSync|execFileSync|execFile|exec|spawn|fork)\s*\(/ },
  { type: "dynamic_execution", severity: "high", message: "dynamic code execution detected", pattern: /\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(/ },
  { type: "filesystem_write", severity: "medium", message: "filesystem write or deletion detected", pattern: /(?:\bfs\.|node:fs)[\s\S]{0,60}\b(?:writeFile|appendFile|rm|unlink|rmdir|chmod|chown|rename)\b/ },
  { type: "filesystem_read", severity: "low", message: "filesystem read detected", pattern: /(?:\bfs\.|node:fs)[\s\S]{0,60}\b(?:readFile|readdir|createReadStream)\b|os\.homedir\s*\(/ },
  { type: "network_access", severity: "medium", message: "network access detected", pattern: /\bfetch\s*\(|https?\.(?:request|get)\s*\(|\baxios\b|XMLHttpRequest|new\s+WebSocket/ },
  { type: "shell_command", severity: "high", message: "shell command construction detected", pattern: /\bshell\s*:\s*true|\/bin\/(?:ba|z)?sh|cmd\.exe|powershell(?:\.exe)?/i }
];

function lineEvidence(content:string, pattern:RegExp):string|undefined { const match=content.match(pattern); if(!match) return; const line=content.slice(0,match.index).split("\n").length; return `line ${line}`; }

export function scanContent(content: string, file: string): RiskSignal[] {
  const signals:RiskSignal[]=[];
  for(const rule of patterns) if(rule.pattern.test(content)) signals.push({type:rule.type,severity:rule.severity,message:rule.message,file,evidence:lineEvidence(content,rule.pattern)});
  if (/process\.env(?:\[[^\]]+\]|\.(?!NODE_ENV\b|DEBUG\b|CI\b)[A-Za-z_$][\w$]*)/.test(content)) signals.push({ type:"environment_access",severity:"high",message:"potentially sensitive environment access detected",file,evidence:lineEvidence(content,/process\.env/) });
  else if(/process\.env\.(?:NODE_ENV|DEBUG|CI)\b/.test(content)) signals.push({type:"environment_access",severity:"low",message:"runtime environment mode access detected",file,evidence:lineEvidence(content,/process\.env/)});
  const lines=content.split("\n");
  if (lines.some(line => line.length > 2000) || /[A-Za-z0-9+/]{1000,}={0,2}/.test(content)) signals.push({ type: "obfuscation", severity: "medium", message: "minified or encoded code detected", file });
  return signals;
}

const commonPackages=["typescript","react","next","vite","webpack","eslint","prettier","express","commander","create-next-app","create-vite","npm","pnpm","yarn"];
function distance(a:string,b:string){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
function typosquatSignal(name:string):RiskSignal|undefined { const plain=name.replace(/^@[^/]+\//,""); const target=commonPackages.find(item=>item!==plain&&plain.length>3&&distance(plain,item)===1); return target?{type:"typosquatting",severity:"high",message:`package name is one edit away from ${target}`} : undefined; }
function capSignals(signals:RiskSignal[]){const seen=new Set<string>(),counts=new Map<string,number>();return signals.filter(s=>{const key=`${s.type}:${s.file??""}`;if(seen.has(key)||(counts.get(s.type)??0)>=5)return false;seen.add(key);counts.set(s.type,(counts.get(s.type)??0)+1);return true;}).slice(0,100);}

export function analyzePackage(metadata: PackageMetadata, files: Array<{ path: string; content: string }>, options?:{truncated?:boolean}): RiskReport {
  let signals: RiskSignal[] = [];
  for (const script of ["preinstall", "install", "postinstall", "prepare"]) if (metadata.scripts[script]) signals.push({ type: "lifecycle_script", severity: "high", message: `${script} script detected`, file: "package.json", evidence:metadata.scripts[script] });
  if (!metadata.repository) signals.push({ type: "metadata_risk", severity: "medium", message: "repository is missing" });
  if (!metadata.maintainers.length) signals.push({ type: "metadata_risk", severity: "medium", message: "maintainers are missing" });
  const typo=typosquatSignal(metadata.name);if(typo)signals.push(typo);
  for (const file of files) signals.push(...scanContent(file.content, file.path));
  signals=capSignals(signals);
  const weights={high:35,medium:12,low:2};
  const strongestByType=new Map<string,SignalSeverity>();const rank={low:1,medium:2,high:3};for(const signal of signals){const current=strongestByType.get(signal.type);if(!current||rank[signal.severity]>rank[current])strongestByType.set(signal.type,signal.severity);}
  const score=Math.min(100,[...strongestByType.values()].reduce((sum,severity)=>sum+weights[severity],0));
  const hasHigh = signals.some(signal => signal.severity === "high");
  const mediumCount=signals.filter(signal=>signal.severity==="medium").length;
  const risk: RiskLevel = hasHigh ? "high" : mediumCount>0||score>=10 ? "medium" : "low";
  const recommendation: Recommendation = risk === "high" ? "do_not_run_without_user_confirmation" : risk === "medium" ? "ask_user" : "safe_to_run";
  return { schemaVersion:"1.0",package: metadata.name, version: metadata.version, risk, score, recommendation, signals, metadata, analyzedAt:new Date().toISOString(),stats:{filesScanned:files.length,bytesScanned:files.reduce((n,f)=>n+Buffer.byteLength(f.content),0),truncated:options?.truncated??false} };
}

function packageMatches(name:string,patterns:string[]=[]){return patterns.some(p=>p.endsWith("/*")?name.startsWith(p.slice(0,-1)):name===p);}
export function evaluatePolicy(report:RiskReport,policy:TeamPolicy):PolicyResult { const reasons:string[]=[];if(packageMatches(report.package,policy.blockPackages)){reasons.push("package is on the blocklist");return{decision:"block",reasons};}if(packageMatches(report.package,policy.allowPackages)){reasons.push("package is on the allowlist");return{decision:"allow",reasons};}const types=new Set(report.signals.map(s=>s.type));const blocked=(policy.block??[]).filter(x=>types.has(x));if(blocked.length){reasons.push(`blocked signals: ${blocked.join(", ")}`);return{decision:"block",reasons};}const warned=(policy.requireConfirmation??[]).filter(x=>types.has(x));if(warned.length){reasons.push(`confirmation required for: ${warned.join(", ")}`);return{decision:"warn",reasons};}reasons.push("default organization policy");return{decision:policy.defaultDecision??(report.risk==="low"?"allow":"warn"),reasons}; }
