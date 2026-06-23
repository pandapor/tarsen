"use client";

import { useState } from "react";
import { ArrowRight, BracketsCurly, CheckCircle, Clipboard, GithubLogo, List, LockKey, ShieldCheck, TerminalWindow, X } from "@phosphor-icons/react";

const command = "npm i -g @tarsen/cli";

function Brand() {
  return <a className="brand" href="#top" aria-label="Tarsen home"><span className="brandMark"><ShieldCheck weight="fill" /></span><span>tarsen</span></a>;
}

function CopyButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return <button className="install" onClick={copy} aria-label="Copy install command"><TerminalWindow weight="bold" /><b>{command}</b><span>{copied ? "Copied" : <Clipboard />}</span></button>;
}

function Terminal({ compact = false }: { compact?: boolean }) {
  return <div className={`terminal ${compact ? "terminalWide" : ""}`}>
    <div className="terminalBar"><div className="dots"><i/><i/><i/></div><span>{compact ? "tarsen check" : "macbook-pro"}</span><b>+</b></div>
    <div className="terminalBody">
      <p><em>$</em> tarsen check create-random-app</p>
      <p className="muted">Fetching package metadata...</p>
      <p><span className="ok">✓</span> Analyzed <strong>132 files</strong></p>
      <br />
      <p>Package&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; create-random-app@2.0.1</p>
      <p>Published&nbsp;&nbsp;&nbsp;&nbsp; 2 days ago</p>
      <p>Maintainers&nbsp;&nbsp; unknown</p>
      <br />
      <p><span className="bad">!</span> postinstall script detected</p>
      <p><span className="bad">!</span> child_process usage detected</p>
      <p><span className="warn">!</span> process.env access detected</p>
      <p><span className="warn">!</span> network access detected</p>
      <br />
      <p>Risk&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <mark>HIGH</mark></p>
      <p>Decision&nbsp;&nbsp;&nbsp;&nbsp; <span className="badText">ASK USER BEFORE RUNNING</span></p>
      {!compact && <><br/><p><em>?</em> Proceed with npx? <span className="cursor">no</span></p></>}
    </div>
  </div>;
}

const features = [
  { icon: BracketsCurly, title: "Static analysis", text: "Inspect package code without executing it." },
  { icon: LockKey, title: "Risk context", text: "See scripts, network, filesystem and env access." },
  { icon: ShieldCheck, title: "Safe execution", text: "Run only after a clear, explicit decision." }
];

export function LandingPage() {
  const [open, setOpen] = useState(false);
  return <main id="top">
    <header><Brand/><nav className={open ? "open" : ""}><a href="#how">How it works</a><a href="#docs">Docs</a><a href="https://github.com" target="_blank">GitHub</a><a className="navCta" href="#install">Get Started <ArrowRight/></a></nav><button className="menu" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X/> : <List/>}</button></header>

    <section className="hero">
      <div className="heroCopy"><div className="eyebrow"><BracketsCurly/> Open source <i/> Built for developers & agents</div><h1>Stop running packages <span>blindly.</span></h1><p className="lede">Tarsen checks executable npm packages before developers or AI agents run them.</p><div className="badges"><span><GithubLogo weight="fill"/> Open Source</span><span><TerminalWindow/> CLI</span><span><ShieldCheck/> Local-first</span></div><div className="heroActions" id="install"><CopyButton/><a className="githubButton" href="https://github.com" target="_blank"><GithubLogo weight="fill"/> Star <b>0.1k</b></a></div></div>
      <Terminal />
    </section>

    <section className="featureRail" id="how">{features.map(({icon: Icon, title, text}) => <a href="#docs" className="feature" key={title}><span><Icon weight="duotone"/></span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight className="featureArrow"/></a>)}</section>

    <section className="why" id="docs"><div className="whyCopy"><span className="label">CHECK BEFORE RUN</span><h2>Know what a package wants to do.</h2><ul><li><CheckCircle/> Lifecycle and install scripts</li><li><CheckCircle/> Shell and child process execution</li><li><CheckCircle/> Filesystem and environment access</li><li><CheckCircle/> Network calls and obfuscation</li><li><CheckCircle/> Machine-readable JSON for agents</li></ul><a href="#install">Read the CLI guide <ArrowRight/></a></div><Terminal compact /></section>

    <section className="agentBand"><div><span className="label">FOR AI AGENTS</span><h2>A safety checkpoint agents can understand.</h2></div><p>Use <code>tarsen check package --json</code> to get structured risk, signals, and a recommendation before any executable package runs.</p><a href="#install">Agent guide <ArrowRight/></a></section>

    <footer><Brand/><p>Open source under the Apache-2.0 License.</p><div><a href="#docs">Docs</a><a href="https://github.com">GitHub</a><a href="#top">Back to top</a></div></footer>
  </main>;
}
