(() => {
  const $ = id => document.getElementById(id);
  const STORE = "codespace-full-local-ide-v2";
  const STARTER = {
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="card">
    <span class="eyebrow">WELCOME TO CODESPACE</span>
    <h1>Hello, world! 👋</h1>
    <p>Edit HTML, CSS and JavaScript, then press Run.</p>
    <button id="helloBtn">Click me</button>
    <p id="message"></p>
  </main>
  <script src="script.js"></script>
</body>
</html>`,
    "style.css": `* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  padding: 24px; font-family: system-ui, sans-serif; color: #172033;
  background: linear-gradient(135deg, #edf0ff, #f8f9ff);
}
.card { width: min(100%, 560px); padding: 40px; border-radius: 24px;
  background: white; box-shadow: 0 20px 60px #26376b18; }
.eyebrow { color: #6475e8; font-size: 12px; font-weight: 800; letter-spacing: 2px; }
h1 { font-size: clamp(30px, 6vw, 48px); margin: 14px 0; }
p { color: #657086; line-height: 1.7; }
button { border: 0; border-radius: 10px; padding: 12px 18px;
  background: #6979ed; color: white; font-weight: 700; cursor: pointer; }`,
    "script.js": `document.getElementById("helloBtn")?.addEventListener("click", () => {
  document.getElementById("message").textContent = "JavaScript is working ✨";
});`
  };
  const EXTENSIONS = [
    {id:"html-kit",name:"HTML Starter Kit",icon:"🌐",desc:"HTML boilerplate and common element shortcuts.",detail:"Shortcuts: !, h1, h2, p, div, img, a, btn, form, ul3."},
    {id:"css-kit",name:"CSS Quick Styles",icon:"🎨",desc:"Quick CSS property snippets.",detail:"Shortcuts: m10, m20, p10, p20, c#333, bgc#fff, fs16, fw700, flex-center."},
    {id:"js-kit",name:"JavaScript Snippets",icon:"⚡",desc:"Common JS patterns and console helpers.",detail:"Shortcuts: clg, log, afn, fn, if, for, query, event."},
    {id:"formatter",name:"Whitespace Formatter",icon:"⌘",desc:"Removes trailing whitespace from each line.",detail:"Use the Format button in the editor toolbar."},
    {id:"live-preview",name:"Live Preview",icon:"▶",desc:"Preview HTML with local CSS and JS in a sandbox.",detail:"Use Run or Ctrl/⌘ + Enter. The preview is sandboxed."},
    {id:"guidebook",name:"HTML/CSS/JS Guidebook",icon:"📘",desc:"Built-in beginner reference guides.",detail:"Open Guides to learn HTML structure, CSS styling and JavaScript events."}
  ];
  let state = loadState();
  let activeFile = "index.html";
  let openFiles = ["index.html","style.css","script.js"];
  let activeGuide = "HTML";
  let toastTimer = null;
  let selectedFolder = "";
  let previewUpdateTimer = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE));
      if (parsed?.files && Object.keys(parsed.files).length) {
        parsed.enabledExtensions ||= Object.fromEntries(EXTENSIONS.map(e => [e.id,true]));
        return parsed;
      }
    } catch (_) {}
    return {files:{...STARTER},enabledExtensions:Object.fromEntries(EXTENSIONS.map(e=>[e.id,true]))};
  }
  function saveState(showToast=false) {
    try {
      if (!isBinaryPath(activeFile)) state.files[activeFile] = $("codeEditor").value;
      localStorage.setItem(STORE, JSON.stringify(state));
      $("saveStatus").textContent = "Saved locally";
      if (showToast) toast("Project saved in this browser.");
    } catch (_) { toast("Save failed: browser storage may be full."); }
  }
  function typeOf(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return ["html","css","js","json","txt"].includes(ext) ? ext : "txt";
  }
  function iconFor(name) { return ({html:"◇",css:"▣",js:"JS",json:"{}",txt:"≡"})[typeOf(name)]; }
  function dirOf(p){const i=p.lastIndexOf("/");return i<0?"":p.slice(0,i);}
  function baseOf(p){return p.slice(p.lastIndexOf("/")+1);}
  function buildTree(paths){
    const root={path:"",dirs:{},files:[]};
    paths.forEach(p=>{
      const parts=p.split("/"); let node=root, acc="";
      parts.slice(0,-1).forEach(seg=>{
        acc=acc?acc+"/"+seg:seg;
        node=node.dirs[seg]||=({path:acc,dirs:{},files:[]});
      });
      node.files.push(p);
    });
    return root;
  }
  function sortFiles(list){
    const rank=n=>({html:0,css:1,js:2,json:3,txt:4}[typeOf(n)]??5);
    return list.slice().sort((a,b)=>rank(a)-rank(b)||baseOf(a).localeCompare(baseOf(b)));
  }
  function expandAncestors(name){
    state.expanded ||= [];
    const parts=name.split("/").slice(0,-1); let acc="";
    parts.forEach(seg=>{acc=acc?acc+"/"+seg:seg; if(!state.expanded.includes(acc)) state.expanded.push(acc);});
  }
  function toggleFolder(path){
    state.expanded ||= [];
    const i=state.expanded.indexOf(path);
    if(i>=0) state.expanded.splice(i,1); else state.expanded.push(path);
    selectedFolder=path; renderFiles(); saveState();
  }
  function renderFiles() {
    const root=$("fileList"); root.innerHTML="";
    const expanded=new Set(state.expanded||[]);
    const draw=(node,depth)=>{
      Object.keys(node.dirs).sort((a,b)=>a.localeCompare(b)).forEach(seg=>{
        const dir=node.dirs[seg], open=expanded.has(dir.path);
        const row=document.createElement("button"); row.type="button";
        row.className="file-item folder-item"+(selectedFolder===dir.path?" selected":"");
        row.style.paddingLeft=(8+depth*14)+"px"; row.title=dir.path;
        row.setAttribute("aria-expanded",open?"true":"false");
        const caret=document.createElement("span"); caret.className="caret"; caret.textContent=open?"▾":"▸";
        const icon=document.createElement("span"); icon.className="file-icon folder-icon"; icon.textContent="▰";
        const label=document.createElement("span"); label.className="file-label"; label.textContent=seg;
        row.append(caret,icon,label); row.addEventListener("click",()=>toggleFolder(dir.path)); root.append(row);
        if(open) draw(dir,depth+1);
      });
      sortFiles(node.files).forEach(name=>{
        const btn=document.createElement("button"); btn.type="button"; btn.className="file-item"+(name===activeFile?" active":"");
        btn.style.paddingLeft=(8+depth*14+21)+"px"; btn.title=name;
        const icon=document.createElement("span"); icon.className="file-icon "+typeOf(name); icon.textContent=iconFor(name);
        const label=document.createElement("span"); label.className="file-label"; label.textContent=baseOf(name);
        btn.append(icon,label); btn.addEventListener("click",()=>switchFile(name)); root.append(btn);
      });
    };
    draw(buildTree(Object.keys(state.files)),0);
  }
  function renderTabs() {
    const root=$("tabs"); root.innerHTML="";
    openFiles.filter(n=>state.files[n]!==undefined).forEach(name=>{
      const tab=document.createElement("div"); tab.className="tab"+(name===activeFile?" active":"");
      tab.addEventListener("click",()=>switchFile(name));
      const icon=document.createElement("span"); icon.className=typeOf(name); icon.textContent=iconFor(name);
      const b=baseOf(name), dup=openFiles.filter(n=>state.files[n]!==undefined&&baseOf(n)===b).length>1;
      const label=document.createElement("span"); label.textContent=(dup&&dirOf(name))?baseOf(dirOf(name))+"/"+b:b; tab.title=name; tab.append(icon,label);
      if(openFiles.length>1){
        const close=document.createElement("button"); close.className="tab-close"; close.textContent="×"; close.title="Close tab";
        close.addEventListener("click",ev=>{
          ev.stopPropagation(); openFiles=openFiles.filter(n=>n!==name);
          if(activeFile===name) activeFile=openFiles.at(-1)||Object.keys(state.files)[0];
          if(!openFiles.length) openFiles=[activeFile]; loadEditor();
        }); tab.append(close);
      }
      root.append(tab);
    });
  }
  function updateLineNumbers() {
    const ed=$("codeEditor"), count=ed.value.split("\n").length;
    $("lineNumbers").textContent=Array.from({length:count},(_,i)=>i+1).join("\n");
    $("lineNumbers").scrollTop=ed.scrollTop;
    const before=ed.value.slice(0,ed.selectionStart), lines=before.split("\n");
    $("cursorStatus").textContent=`Ln ${lines.length}, Col ${lines.at(-1).length+1}`;
  }
  function loadEditor() {
    if(!state.files[activeFile]) { if(!(activeFile in state.files)) activeFile=Object.keys(state.files)[0]; }
    const binaryAsset=isBinaryPath(activeFile)&&String(state.files[activeFile]||"").startsWith("data:");
    $("codeEditor").readOnly=!!binaryAsset;
    $("codeEditor").value=binaryAsset?`/* Binary asset: ${baseOf(activeFile)}\nThis file is preserved in the project and ZIP export. Binary editing is not supported in the text editor. */`:state.files[activeFile]||"";
    $("breadcrumbs").replaceChildren();
    const dirPart=dirOf(activeFile);
    const crumb=document.createElement("span"); crumb.textContent="my-project / "+(dirPart?dirPart.split("/").join(" / ")+" / ":"");
    const name=document.createElement("b"); name.textContent=baseOf(activeFile); $("breadcrumbs").append(crumb,name);
    expandAncestors(activeFile); selectedFolder=dirPart;
    $("languageStatus").textContent=typeOf(activeFile).toUpperCase();
    renderFiles(); renderTabs(); updateLineNumbers(); renderHighlight();
  }
  function switchFile(name) {
    if(!isBinaryPath(activeFile))state.files[activeFile]=$("codeEditor").value; activeFile=name;
    if(!openFiles.includes(name)) openFiles.push(name);
    loadEditor(); $("workspace").classList.remove("files-open"); setNav("code");
  }
  function toast(msg) {
    const el=$("toast"); el.textContent=msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2400);
  }
  function openModal() { $("modalBackdrop").hidden=false; $("fileNameInput").value=selectedFolder?selectedFolder+"/":""; $("fileNameInput").focus(); }
  function closeModal() { $("modalBackdrop").hidden=true; }
  function createFile(raw) {
    const name=raw.trim();
    if(!isSafeProjectPath(name)){toast("Use a relative path with a supported text-code extension; ../ paths are not allowed.");return;}
    if(name in state.files){toast("That file already exists.");return;}
    if(!isBinaryPath(activeFile))state.files[activeFile]=$("codeEditor").value; state.files[name]=""; activeFile=name; openFiles.push(name);
    loadEditor(); saveState(); closeModal(); toast("File created.");
  }
  function resolveProjectPath(baseDir,ref){
    ref=ref.split("#")[0].split("?")[0].trim();
    if(!ref||/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return null;
    const parts=ref.startsWith("/")?[]:(baseDir?baseDir.split("/"):[]);
    ref.split("/").forEach(seg=>{if(seg===""||seg===".")return; if(seg==="..")parts.pop(); else parts.push(seg);});
    const p=parts.join("/"); return Object.prototype.hasOwnProperty.call(state.files,p)?p:null;
  }
  function pickPreviewHtml(){
    const htmls=Object.keys(state.files).filter(n=>/\.html?$/i.test(n));
    if(!htmls.length) return null;
    if(/\.html?$/i.test(activeFile)) return activeFile;
    const dir=dirOf(activeFile);
    return htmls.find(n=>dirOf(n)===dir&&/^index\.html?$/i.test(baseOf(n)))||htmls.find(n=>dirOf(n)===dir)||htmls.find(n=>n.toLowerCase()==="index.html")||htmls[0];
  }
  function buildPreview() {
    if(state.enabledExtensions["live-preview"]===false){toast("Enable Live Preview in Extensions first.");return;}
    if(!isBinaryPath(activeFile))state.files[activeFile]=$("codeEditor").value;
    const htmlName=pickPreviewHtml();
    if(!htmlName){toast("Create an HTML file first.");return;}
    let html=state.files[htmlName]||"<h1>Empty HTML file</h1>";
    const dir=dirOf(htmlName);
    let usedCss=false, usedJs=false;
    // Inline the CSS/JS files this page links to (paths resolved relative to the HTML file's folder).
    html=html.replace(/<link\b[^>]*>/gi,tag=>{
      const m=tag.match(/href=["']([^"']+)["']/i); const p=m&&resolveProjectPath(dir,m[1]);
      if(p&&/\.css$/i.test(p)){usedCss=true;return "<style>\n"+state.files[p]+"\n</style>";}
      return tag;
    });
    html=html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script\s*>/gi,(tag,src)=>{
      const p=resolveProjectPath(dir,src);
      if(p&&/\.m?js$/i.test(p)){usedJs=true;const mod=/type=["']module["']/i.test(tag)?' type="module"':"";return "<script"+mod+">\n"+state.files[p].replace(/<\/script/gi,"<\\/script")+"\n<\/script>";}
      return tag;
    });
    // Embed imported local assets (images/fonts/media) so sandboxed preview can display them.
    html=html.replace(/\b(src|href)=(["'])([^"']+)\2/gi,(all,attr,q,ref)=>{
      const path=resolveProjectPath(dir,ref); if(path && typeof state.files[path]==="string" && state.files[path].startsWith("data:")) return `${attr}=${q}${state.files[path]}${q}`; if(path && /\.svg$/i.test(path) && typeof state.files[path]==="string") return `${attr}=${q}data:image/svg+xml;charset=utf-8,${encodeURIComponent(state.files[path])}${q}`;
      return all;
    });
    // Add an isolated console bridge and persistent localStorage shim without granting same-origin access.
    const storageKey="codespace-preview-storage-v1";
    const stored=localStorage.getItem(storageKey)||"{}";
    const bridge=`<script>(function(){const send=(type,args)=>parent.postMessage({__codespace:true,type,args:Array.from(args||[]).map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch(e){return String(v)}})},'*');['log','info','warn','error','debug'].forEach(k=>{const old=console[k];console[k]=function(){send('console.'+k,arguments);try{old.apply(console,arguments)}catch(e){}}});addEventListener('error',e=>send('error',[e.message+' ('+e.filename+':'+e.lineno+')']));addEventListener('unhandledrejection',e=>send('error',['Unhandled promise rejection: '+(e.reason?.stack||e.reason)]));const data=${JSON.stringify(JSON.parse(stored))};const ls={getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v);parent.postMessage({__codespace:true,type:'storage',data},'*')},removeItem:k=>{delete data[k];parent.postMessage({__codespace:true,type:'storage',data},'*')},clear:()=>{Object.keys(data).forEach(k=>delete data[k]);parent.postMessage({__codespace:true,type:'storage',data},'*')},key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length}};try{Object.defineProperty(window,'localStorage',{value:ls})}catch(e){}})();<\/script>`;
    html=/<head[^>]*>/i.test(html)?html.replace(/<head[^>]*>/i,m=>m+bridge):bridge+html;
    // Fallback: page links nothing local -> include CSS/JS files from the same folder.
    const sameDir=ext=>Object.entries(state.files).filter(([n])=>dirOf(n)===dir&&n.toLowerCase().endsWith(ext)).map(([,v])=>v).join("\n");
    const css=usedCss?"":sameDir(".css"), js=usedJs?"":sameDir(".js");
    if(css.trim()){
      if(/<\/head\s*>/i.test(html)) html=html.replace(/<\/head\s*>/i,()=>"<style>\n"+css+"\n</style>\n</head>");
      else html="<style>"+css+"</style>"+html;
    }
    if(js.trim()){
      const safeJs=js.replace(/<\/script/gi,"<\\/script");
      if(/<\/body\s*>/i.test(html)) html=html.replace(/<\/body\s*>/i,()=>"<script>\n"+safeJs+"\n<\/script>\n</body>");
      else html+="<script>"+safeJs+"<\/script>";
    }
    const previewFrame = $("previewFrame");
    // Always send the latest composed document to the preview frame.
    previewFrame.srcdoc = html;
    previewFrame.style.maxWidth = $("deviceSize")?.value || "100%";
    previewFrame.style.margin = "0 auto";
    $("consoleOutput").textContent = "Preview started. Console output will appear here.";
    const workspace = $("workspace");
    workspace.classList.remove("files-open", "panel-open");
    workspace.classList.add("show-preview");
    $("toolPanel").hidden=true;
    setNav("preview");
    saveState();
    const frame = $("previewFrame");
    if (frame) { frame.style.display = "block"; frame.style.width = "100%"; frame.style.minHeight = "0"; }
  }
  function setNav(which) {
    ["Code","Files","Preview","Guide"].forEach(x=>{const el=$("nav"+x);if(el)el.classList.toggle("active",x.toLowerCase()===which);});
  }
  function openPanel(kind) {
    if(kind==="guide" && state.enabledExtensions["guidebook"]===false){toast("Enable HTML/CSS/JS Guidebook in Extensions first.");return;}
    $("toolPanel").hidden=false; $("workspace").classList.add("panel-open"); $("workspace").classList.remove("show-preview","files-open"); document.body.classList.remove("mobile-preview-mode");
    $("panelTitle").textContent=kind==="extensions"?"Extension Center":"HTML / CSS / JS Guides";
    renderPanelTabs(kind);
    setNav(kind==="guide"?"guide":"code");
  }
  function renderPanelTabs(kind) {
    const tabs=$("panelTabs"); tabs.innerHTML="";
    const list=kind==="extensions"?["Extensions"]:["HTML","CSS","JavaScript"];
    list.forEach(label=>{
      const b=document.createElement("button"); b.className="panel-tab"+((kind==="extensions"||label===activeGuide)?" active":""); b.textContent=label;
      b.addEventListener("click",()=>{if(kind==="guide")activeGuide=label;renderPanelTabs(kind);}); tabs.append(b);
    });
    renderPanelContent(kind);
  }
  function addCodeCard(parent,title,desc,code) {
    const card=document.createElement("article");card.className="guide-card";
    const h=document.createElement("h3");h.textContent=title;
    const p=document.createElement("p");p.textContent=desc;
    const sample=document.createElement("code");sample.className="code-sample";sample.textContent=code;
    const btn=document.createElement("button");btn.className="panel-button";btn.textContent="Insert into editor";
    btn.addEventListener("click",()=>insertAtCursor(code));
    card.append(h,p,sample,btn);parent.append(card);
  }
  function renderPanelContent(kind) {
    const root=$("panelContent");root.innerHTML="";
    if(kind==="extensions"){
      EXTENSIONS.forEach(ext=>{
        const card=document.createElement("article");card.className="extension-card";
        const head=document.createElement("div");head.className="extension-head";
        const icon=document.createElement("div");icon.className="extension-icon";icon.textContent=ext.icon;
        const info=document.createElement("div");const h=document.createElement("h3");h.textContent=ext.name;
        const p=document.createElement("p");p.textContent=ext.desc;info.append(h,p);
        const toggle=document.createElement("button");const enabled=state.enabledExtensions[ext.id]!==false;
        toggle.className="extension-toggle"+(enabled?" on":"");toggle.textContent=enabled?"Enabled":"Enable";
        toggle.addEventListener("click",()=>{state.enabledExtensions[ext.id]=!enabled;saveState();renderPanelContent("extensions");toast(`${ext.name} ${enabled?"disabled":"enabled"}.`);});
        head.append(icon,info,toggle);card.append(head);
        const detail=document.createElement("p");detail.textContent=ext.detail;detail.style.marginTop="10px";card.append(detail);root.append(card);
      });
      const note=document.createElement("p");note.textContent="These are built-in CodeSpace extensions/snippet packs, not installable VS Code marketplace extensions. They work offline inside this website.";root.append(note);
      return;
    }
    if(activeGuide==="HTML"){
      addCodeCard(root,"HTML page skeleton","Use this as the starting structure for a web page.",`<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>`);
      addCodeCard(root,"Heading and paragraph","Headings describe sections; paragraphs contain text.","<h1>Main heading</h1>\n<p>Your paragraph goes here.</p>");
      addCodeCard(root,"Link and image","Always provide useful alt text for images.",`<a href="https://example.com">Visit site</a>\n<img src="photo.jpg" alt="Description of photo">`);
      addCodeCard(root,"Form basics","Labels make form fields easier to use.",`<form>\n  <label for="email">Email</label>\n  <input id="email" type="email" required>\n  <button type="submit">Send</button>\n</form>`);
    } else if(activeGuide==="CSS"){
      addCodeCard(root,"Connect a CSS file","Place the link inside the HTML head.",`<link rel="stylesheet" href="style.css">`);
      addCodeCard(root,"Color, spacing and borders","CSS rules use selector { property: value; }.",`.card {\n  color: #20243a;\n  background: white;\n  padding: 20px;\n  margin: 10px;\n  border-radius: 12px;\n}`);
      addCodeCard(root,"Responsive layout","Use a media query for smaller screens.",`@media (max-width: 600px) {\n  .card { padding: 14px; }\n  h1 { font-size: 28px; }\n}`);
      addCodeCard(root,"Flexbox center","Useful for aligning items in a row or column.",`.container {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n}`);
    } else {
      addCodeCard(root,"Connect JavaScript","Place before the closing body tag.",`<script src="script.js"></script>`);
      addCodeCard(root,"Click event","Select an element and respond to clicks.",`document.querySelector("button")?.addEventListener("click", () => {\n  console.log("Button clicked");\n});`);
      addCodeCard(root,"Variables and functions","Use const by default; use let when reassignment is needed.",`const name = "CodeSpace";\nlet count = 0;\nfunction greet(person) {\n  return "Hello, " + person;\n}`);
      addCodeCard(root,"Fetch data","Network requests require internet and a suitable API.",`fetch("https://jsonplaceholder.typicode.com/todos/1")\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error(error));`);
    }
  }
  function insertAtCursor(text) {
    $("workspace").classList.remove("panel-open");$("toolPanel").hidden=true;
    const ed=$("codeEditor");ed.focus();ed.setRangeText(text,ed.selectionStart,ed.selectionEnd,"end");
    state.files[activeFile]=ed.value;updateLineNumbers();saveState();setNav("code");toast("Guide snippet inserted.");
  }
  function expandShortcut() {
    if(!state.enabledExtensions["html-kit"] && !state.enabledExtensions["css-kit"] && !state.enabledExtensions["js-kit"]){toast("Enable a snippet extension first.");return;}
    const ed=$("codeEditor"),value=ed.value,start=ed.selectionStart;
    const lineStart=value.lastIndexOf("\n",start-1)+1,lineEnd0=value.indexOf("\n",start),lineEnd=lineEnd0<0?value.length:lineEnd0;
    const line=value.slice(lineStart,lineEnd).trim(),type=typeOf(activeFile);
    const html={"!":'<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>',h1:"<h1>Heading</h1>",h2:"<h2>Heading</h2>",p:"<p>Text</p>",div:"<div></div>",img:'<img src="image.jpg" alt="Description">',a:'<a href="#">Link text</a>',btn:'<button type="button">Click me</button>',ul3:"<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n  <li>Item 3</li>\n</ul>"};
    const css={"m10":"margin: 10px;","m20":"margin: 20px;","p10":"padding: 10px;","p20":"padding: 20px;","c#333":"color: #333;","bgc#fff":"background-color: #fff;","fs16":"font-size: 16px;","fw700":"font-weight: 700;","ta:center":"text-align: center;","flex-center":"display: flex;\n  align-items: center;\n  justify-content: center;"};
    const js={"clg":"console.log();","log":"console.log();","afn":"const name = () => {\n  \n};","fn":"function name() {\n  \n}","if":"if (condition) {\n  \n}","for":"for (let i = 0; i < 10; i++) {\n  \n}","query":'document.querySelector(".class")',"event":'document.querySelector("button")?.addEventListener("click", () => {\n  \n});'};
    const map=type==="html"&&state.enabledExtensions["html-kit"]?html:type==="css"&&state.enabledExtensions["css-kit"]?css:type==="js"&&state.enabledExtensions["js-kit"]?js:{};
    const replacement=map[line];
    if(!replacement){toast("No shortcut found. Try !, h1, m10, flex-center or clg.");return;}
    ed.setRangeText(replacement,lineStart,lineEnd,"end");state.files[activeFile]=ed.value;updateLineNumbers();saveState();toast("Shortcut expanded.");
  }
  function formatCode() {
    if(state.enabledExtensions.formatter===false){toast("Enable Whitespace Formatter in Extensions.");return;}
    const ed=$("codeEditor");ed.value=ed.value.split("\n").map(line=>line.replace(/[ \t]+$/g,"")).join("\n");
    state.files[activeFile]=ed.value;updateLineNumbers();saveState();toast("Trailing spaces removed.");
  }
  const TEXT_EXTENSIONS = new Set(["png","jpg","jpeg","gif","webp","avif","ico","bmp","svg","woff","woff2","ttf","otf","mp3","wav","ogg","mp4","webm","pdf","html","htm","css","js","mjs","cjs","ts","jsx","tsx","json","txt","md","xml","svg","php","py","java","c","h","cpp","sql","yaml","yml","sh","csv"]);
  function isBinaryPath(path){return /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|pdf)$/i.test(path);}
  function mimeFor(path){return ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",avif:"image/avif",ico:"image/x-icon",bmp:"image/bmp",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",mp3:"audio/mpeg",wav:"audio/wav",ogg:"audio/ogg",mp4:"video/mp4",webm:"video/webm",pdf:"application/pdf"})[(path.split(".").pop()||"").toLowerCase()]||"application/octet-stream";}
  function fileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
  function isSafeProjectPath(path) {
    if (typeof path !== "string" || !path.trim() || path.startsWith("/") || path.includes("\\")) return false;
    const parts = path.split("/");
    if (parts.some(part => !part || part === "." || part === ".." || !/^[a-zA-Z0-9._ -]+$/.test(part))) return false;
    const ext = (parts.at(-1).split(".").pop() || "").toLowerCase();
    return TEXT_EXTENSIONS.has(ext) || /^[a-z0-9]{1,12}$/.test(ext);
  }
  function isIgnoredProjectPath(path) {
    return path.split("/").some(part => [".git","node_modules",".vscode","dist","build","vendor"].includes(part));
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function exportProject() {
    try {
      if (!isBinaryPath(activeFile)) state.files[activeFile] = $("codeEditor").value;
      if (!window.JSZip) throw new Error("ZIP engine did not load. Reload the page and try again.");
      const zip = new JSZip();
      for (const [path, content] of Object.entries(state.files)) {
        if (isSafeProjectPath(path) && typeof content === "string") { const m=content.match(/^data:[^;]+;base64,(.*)$/s); zip.file(path, m?m[1]:content, m?{base64:true}:{}); }
      }
      zip.file(".codespace-project.json", JSON.stringify({app:"CodeSpace",version:2,enabledExtensions:state.enabledExtensions},null,2));
      const blob = await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
      downloadBlob(blob, "codespace-project.zip");
      toast("Project downloaded as ZIP.");
    } catch (e) { console.error(e); toast(e.message || "ZIP export failed."); }
  }
  async function replaceProjectFiles(entries, sourceLabel) {
    const clean = {};
    for (const entry of entries) {
      const path = String(entry.path || "").replace(/^\.\//, "");
      if (!isSafeProjectPath(path) || isIgnoredProjectPath(path)) continue;
      if (typeof entry.content === "string") clean[path] = entry.content;
    }
    if (!Object.keys(clean).length) throw new Error("No supported files found in that selection.");
    state.files = clean;
    if (!state.enabledExtensions) state.enabledExtensions = Object.fromEntries(EXTENSIONS.map(e=>[e.id,true]));
    activeFile = Object.keys(clean).find(n => n.toLowerCase().endsWith("index.html")) || Object.keys(clean).find(n=>n.toLowerCase().endsWith(".html")) || Object.keys(clean)[0];
    openFiles = Object.keys(clean).slice(0, 8);
    if (!openFiles.includes(activeFile)) openFiles.unshift(activeFile);
    $("workspace").classList.remove("show-preview","files-open","panel-open");
    if ($("toolPanel")) $("toolPanel").hidden = true;
    loadEditor(); saveState();
    toast(`${Object.keys(clean).length} file(s) imported from ${sourceLabel}.`);
  }
  async function importProject(file) {
    try {
      const obj = JSON.parse(await file.text());
      const imported = obj.files && typeof obj.files === "object" ? obj.files : obj;
      const entries = Object.entries(imported).map(([path,content])=>({path,content}));
      await replaceProjectFiles(entries,"JSON backup");
      if (obj.enabledExtensions) state.enabledExtensions = obj.enabledExtensions;
      saveState();
    } catch(e) { toast(e.message || "Import failed. Select a valid CodeSpace JSON backup."); }
    $("importInput").value = "";
  }
  async function importIndividualFiles(fileList) {
    try {
      const incoming = {};
      for (const file of fileList) {
        const path = file.name;
        if (isSafeProjectPath(path)) incoming[path] = isBinaryPath(path) ? await fileDataUrl(file) : await file.text();
      }
      if (!Object.keys(incoming).length) throw new Error("No supported text/code files selected.");
      if (!isBinaryPath(activeFile)) state.files[activeFile] = $("codeEditor").value;
      Object.assign(state.files, incoming);
      activeFile = Object.keys(incoming)[0];
      for (const name of Object.keys(incoming)) if (!openFiles.includes(name)) openFiles.push(name);
      loadEditor(); saveState();
      toast(`${Object.keys(incoming).length} file(s) imported into the current project.`);
    } catch(e) { toast(e.message || "Could not import selected files."); }
    $("fileImportInput").value = "";
  }
  async function importFolder(fileList) {
    try {
      const entries = [];
      for (const file of fileList) {
        const path = file.webkitRelativePath || file.name;
        entries.push({path,content:isBinaryPath(path)?await fileDataUrl(file):await file.text()});
      }
      await replaceProjectFiles(entries,"folder");
    } catch(e) { toast(e.message || "Could not open that folder."); }
    $("folderImportInput").value = "";
  }
  async function importZip(file) {
    try {
      if (!window.JSZip) throw new Error("ZIP engine did not load. Reload the page and try again.");
      const zip = await JSZip.loadAsync(file);
      const entries = [];
      let importedExtensions = null;
      for (const [path, item] of Object.entries(zip.files)) {
        if (item.dir || isIgnoredProjectPath(path)) continue;
        if (path === ".codespace-project.json") {
          try { importedExtensions = JSON.parse(await item.async("string")).enabledExtensions || null; } catch (_) {}
          continue;
        }
        if (!isSafeProjectPath(path)) continue;
        entries.push({path,content:isBinaryPath(path)?`data:${mimeFor(path)};base64,${await item.async("base64")}`:await item.async("string")});
      }
      await replaceProjectFiles(entries,"ZIP archive");
      if (importedExtensions) { state.enabledExtensions = importedExtensions; saveState(); }
    } catch(e) { console.error(e); toast(e.message || "ZIP import failed. Choose a valid project ZIP."); }
    $("zipImportInput").value = "";
  }

  // Lightweight IntelliSense for the local textarea editor. It works offline.
  const COMPLETIONS = {
    html: [
      ['!','HTML5 starter document','<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>'],
      ['html','HTML document element','<html lang="en">\n  \n</html>'],['head','Head section','<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>'],
      ['meta:vp','Responsive viewport meta','<meta name="viewport" content="width=device-width, initial-scale=1.0">'],
      ['h1','Heading level 1','<h1>Heading</h1>'],['h2','Heading level 2','<h2>Heading</h2>'],['h3','Heading level 3','<h3>Heading</h3>'],
      ['p','Paragraph','<p>Text</p>'],['div','Division container','<div class="container">\n  \n</div>'],['span','Inline span','<span>Text</span>'],
      ['a','Anchor link','<a href="#">Link text</a>'],['img','Image with alt text','<img src="image.jpg" alt="Description">'],['btn','Button','<button type="button">Click me</button>'],
      ['input','Input field','<input type="text" name="name" placeholder="Enter text">'],['form','Form','<form action="#" method="post">\n  \n  <button type="submit">Submit</button>\n</form>'],
      ['label','Form label','<label for="field">Label</label>'],['ul','Unordered list','<ul>\n  <li>Item</li>\n</ul>'],['ol','Ordered list','<ol>\n  <li>Item</li>\n</ol>'],['li','List item','<li>Item</li>'],
      ['table','Table','<table>\n  <thead><tr><th>Heading</th></tr></thead>\n  <tbody><tr><td>Value</td></tr></tbody>\n</table>'],
      ['link:css','Link stylesheet','<link rel="stylesheet" href="style.css">'],['script:src','Link JavaScript','<script src="script.js"></script>'],
      ['nav','Navigation','<nav aria-label="Main navigation">\n  <a href="#home">Home</a>\n</nav>'],['main','Main content','<main>\n  \n</main>'],['section','Section','<section>\n  <h2>Section title</h2>\n</section>'],['article','Article','<article>\n  \n</article>'],['footer','Footer','<footer>\n  \n</footer>'],
      ['video','Video element','<video controls src="video.mp4"></video>'],['audio','Audio element','<audio controls src="audio.mp3"></audio>'],['details','Expandable details','<details>\n  <summary>More information</summary>\n  <p>Details here.</p>\n</details>'],['comment','HTML comment','<!-- comment -->']
    ],
    css: [
      ['color','Text color','color: #333;'],['background','Background','background: #fff;'],['background-color','Background color','background-color: #fff;'],['display','Display mode','display: flex;'],['position','Position','position: relative;'],
      ['margin','Margin','margin: 10px;'],['padding','Padding','padding: 10px;'],['width','Width','width: 100%;'],['height','Height','height: auto;'],['max-width','Maximum width','max-width: 1200px;'],['min-height','Minimum height','min-height: 100vh;'],
      ['font-size','Font size','font-size: 16px;'],['font-family','Font family','font-family: Arial, sans-serif;'],['font-weight','Font weight','font-weight: 700;'],['text-align','Text alignment','text-align: center;'],['line-height','Line height','line-height: 1.5;'],['letter-spacing','Letter spacing','letter-spacing: 1px;'],
      ['border','Border','border: 1px solid #ddd;'],['border-radius','Rounded corners','border-radius: 12px;'],['box-shadow','Box shadow','box-shadow: 0 8px 24px #0001;'],['opacity','Opacity','opacity: 1;'],['overflow','Overflow','overflow: hidden;'],['z-index','Stack order','z-index: 10;'],
      ['flex','Flex layout','display: flex;'],['flex-center','Center with flexbox','display: flex;\n  align-items: center;\n  justify-content: center;'],['align-items','Align items','align-items: center;'],['justify-content','Justify content','justify-content: center;'],['flex-direction','Flex direction','flex-direction: column;'],['flex-wrap','Wrap flex items','flex-wrap: wrap;'],['gap','Gap','gap: 12px;'],
      ['grid','Grid layout','display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 16px;'],['grid-template-columns','Grid columns','grid-template-columns: repeat(2, minmax(0, 1fr));'],['transition','Transition','transition: all 0.2s ease;'],['transform','Transform','transform: translateY(-2px);'],['cursor','Cursor','cursor: pointer;'],[':hover','Hover state','&:hover {\n  opacity: 0.85;\n}'],['@media','Responsive media query','@media (max-width: 600px) {\n  \n}'],
      ['m10','Margin 10px','margin: 10px;'],['m20','Margin 20px','margin: 20px;'],['mt10','Margin top','margin-top: 10px;'],['mb10','Margin bottom','margin-bottom: 10px;'],['p10','Padding 10px','padding: 10px;'],['p20','Padding 20px','padding: 20px;'],['fs16','Font size 16px','font-size: 16px;'],['fw700','Bold font','font-weight: 700;'],['ta:center','Center text','text-align: center;'],['bgc#fff','White background','background-color: #fff;'],['c#333','Dark text','color: #333;']
    ],
    js: [
      ['console','Console object','console.log();'],['clg','Console log','console.log();'],['log','Console log','console.log();'],['const','Constant declaration','const name = "value";'],['let','Variable declaration','let value = 0;'],['function','Function declaration','function name() {\n  \n}'],['fn','Function template','function name() {\n  \n}'],['afn','Arrow function','const name = () => {\n  \n};'],['if','If statement','if (condition) {\n  \n}'],['else','Else block','else {\n  \n}'],['for','For loop','for (let i = 0; i < 10; i++) {\n  \n}'],['foreach','For each array item','items.forEach((item) => {\n  \n});'],['map','Array map','const result = items.map((item) => item);'],['filter','Array filter','const result = items.filter((item) => condition);'],['query','Query selector','document.querySelector(".class");'],['queryAll','Query all elements','document.querySelectorAll(".item");'],['event','Click event listener','document.querySelector("button")?.addEventListener("click", (event) => {\n  \n});'],['addEventListener','Event listener','element.addEventListener("click", (event) => {\n  \n});'],['fetch','Fetch API','fetch("https://example.com/api")\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error(error));'],['async','Async function','async function loadData() {\n  \n}'],['await','Await expression','const result = await promise;'],['try','Try/catch','try {\n  \n} catch (error) {\n  console.error(error);\n}'],['promise','Promise','new Promise((resolve, reject) => {\n  \n});'],['json','Parse JSON','const data = JSON.parse(text);'],['stringify','Stringify JSON','JSON.stringify(data, null, 2);'],['timeout','Set timeout','setTimeout(() => {\n  \n}, 1000);'],['interval','Set interval','setInterval(() => {\n  \n}, 1000);'],['import','Import module','import { name } from "./module.js";'],['export','Export function','export function name() {\n  \n}']
    ]
  };
  let suggestionItems = [];
  let selectedSuggestion = 0;
  let suggestionBox = null;
  function ensureSuggestionBox() {
    if (suggestionBox) return suggestionBox;
    suggestionBox = document.createElement('div');
    suggestionBox.id = 'intellisenseBox';
    suggestionBox.className = 'intellisense-box';
    suggestionBox.hidden = true;
    $('editorArea').appendChild(suggestionBox);
    return suggestionBox;
  }
  function currentToken() {
    const ed = $('codeEditor');
    const before = ed.value.slice(0, ed.selectionStart);
    const line = before.slice(before.lastIndexOf('\n') + 1);
    const match = line.match(/[!#@\w:$.-]+$/);
    return { token: match ? match[0] : '', start: match ? ed.selectionStart - match[0].length : ed.selectionStart };
  }
  function activeCompletionList() {
    const type = typeOf(activeFile);
    return COMPLETIONS[type] || [];
  }
  function showSuggestions(force=false) {
    const box = ensureSuggestionBox();
    const ed = $('codeEditor');
    const {token} = currentToken();
    const type = typeOf(activeFile);
    if (!['html','css','js'].includes(type) || (!token && !force)) { box.hidden=true; return; }
    const query = token.toLowerCase();
    let items = activeCompletionList().filter(item => {
      const label = item[0].toLowerCase();
      return query === '' ? false : label.startsWith(query) || (query.length >= 2 && label.includes(query));
    });
    if (force && !query) items = activeCompletionList().slice(0, 9);
    if (query === '!') items = COMPLETIONS.html.filter(item => item[0] === '!');
    if (!items.length) { box.hidden=true; return; }
    suggestionItems = items.slice(0, 9); selectedSuggestion = 0;
    box.innerHTML = '';
    const head = document.createElement('div'); head.className='intellisense-head'; head.textContent = `${type.toUpperCase()} SUGGESTIONS · ↑↓ SELECT · ENTER INSERT`; box.appendChild(head);
    suggestionItems.forEach((item,index)=>{
      const row = document.createElement('button'); row.type='button'; row.className='suggestion-row'+(index===0?' selected':'');
      const label=document.createElement('span');label.className='suggestion-label';label.textContent=item[0];
      const desc=document.createElement('span');desc.className='suggestion-desc';desc.textContent=item[1];row.append(label,desc);
      row.addEventListener('mousedown',ev=>{ev.preventDefault();acceptSuggestion(index);});box.appendChild(row);
    });
    box.hidden=false;
  }
  function moveSuggestion(delta) {
    if (!suggestionBox || suggestionBox.hidden || !suggestionItems.length) return false;
    selectedSuggestion=(selectedSuggestion+delta+suggestionItems.length)%suggestionItems.length;
    [...suggestionBox.querySelectorAll('.suggestion-row')].forEach((el,i)=>el.classList.toggle('selected',i===selectedSuggestion));
    const selected=suggestionBox.querySelectorAll('.suggestion-row')[selectedSuggestion]; if(selected) selected.scrollIntoView({block:'nearest'});
    return true;
  }
  function acceptSuggestion(index=selectedSuggestion) {
    if (!suggestionItems[index]) return false;
    const ed=$('codeEditor'), {start}=currentToken(), end=ed.selectionStart, item=suggestionItems[index];
    ed.setRangeText(item[2], start, end, 'end');
    ed.dispatchEvent(new Event('input',{bubbles:true}));
    if(suggestionBox) suggestionBox.hidden=true;
    ed.focus(); return true;
  }
  function expandAbbreviation() {
    const ed=$('codeEditor'), {token,start}=currentToken(), type=typeOf(activeFile);
    const match = activeCompletionList().find(item=>item[0]===token);
    if(match && token && ['html','css','js'].includes(type) && state.enabledExtensions[({html:'html-kit',css:'css-kit',js:'js-kit'})[type]]!==false) {
      ed.setRangeText(match[2], start, ed.selectionStart, 'end');
      ed.dispatchEvent(new Event('input',{bubbles:true})); if(suggestionBox) suggestionBox.hidden=true; return true;
    }
    return false;
  }
  function replaceCurrentLine(transform) {
    const ed=$('codeEditor'), value=ed.value, cursor=ed.selectionStart;
    const start=value.lastIndexOf('\n',cursor-1)+1, end0=value.indexOf('\n',cursor), end=end0<0?value.length:end0;
    const line=value.slice(start,end), result=transform(line);
    ed.setRangeText(result,start,end,'end');ed.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function editorShortcuts(ev) {
    const ed=$('codeEditor'), mod=ev.ctrlKey||ev.metaKey;
    if(ev.key==='ArrowDown' && !ev.altKey && suggestionBox && !suggestionBox.hidden){ev.preventDefault();ev.stopImmediatePropagation();moveSuggestion(1);return;}
    if(ev.key==='ArrowUp' && !ev.altKey && suggestionBox && !suggestionBox.hidden){ev.preventDefault();ev.stopImmediatePropagation();moveSuggestion(-1);return;}
    if((ev.key==='Enter'||ev.key==='Tab') && suggestionBox && !suggestionBox.hidden && suggestionItems.length){ev.preventDefault();ev.stopImmediatePropagation();acceptSuggestion();return;}
    if(ev.key==='Escape' && suggestionBox && !suggestionBox.hidden){suggestionBox.hidden=true;ev.preventDefault();ev.stopImmediatePropagation();return;}
    if(ev.key==='Tab'){
      ev.preventDefault();ev.stopImmediatePropagation();
      if(expandAbbreviation()) return;
      ed.setRangeText('  ',ed.selectionStart,ed.selectionEnd,'end');ed.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    if(mod && ev.key==='/'){
      ev.preventDefault();ev.stopImmediatePropagation();
      const type=typeOf(activeFile), prefix=type==='html'?'<!-- ':type==='css'?'/* ': '//', suffix=type==='html'?' -->':type==='css'?' */':'';
      replaceCurrentLine(line=>{
        if(type==='html' && line.trim().startsWith('<!--') && line.trim().endsWith('-->')) return line.replace('<!-- ','').replace(' -->','');
        if(type==='css' && line.trim().startsWith('/*') && line.trim().endsWith('*/')) return line.replace('/* ','').replace(' */','');
        if(type==='html'||type==='css') return prefix+line+suffix;
        return line.trim().startsWith('//')?line.replace(/^\s*\/\/\s?/,''):prefix+line;
      });return;
    }
    if(mod && ev.shiftKey && ev.key.toLowerCase()==='k'){
      ev.preventDefault();ev.stopImmediatePropagation();replaceCurrentLine(()=> '');return;
    }
    if(ev.altKey && (ev.key==='ArrowUp'||ev.key==='ArrowDown')){
      ev.preventDefault();ev.stopImmediatePropagation();
      const value=ed.value,cursor=ed.selectionStart,start=value.lastIndexOf('\n',cursor-1)+1,end0=value.indexOf('\n',cursor),end=end0<0?value.length:end0;
      const prevStart=start>0?value.lastIndexOf('\n',start-2)+1:-1, prevEnd=start-1;
      const nextStart=end<value.length?end+1:-1,nextEnd=nextStart>=0?(value.indexOf('\n',nextStart)<0?value.length:value.indexOf('\n',nextStart)):-1;
      if(ev.shiftKey){const line=value.slice(start,end);if(ev.key==='ArrowDown'){ed.setRangeText(line+'\n',end,end,'end');}else{ed.setRangeText(line+'\n',start,start,'start');}ed.dispatchEvent(new Event('input',{bubbles:true}));return;}
      if(ev.key==='ArrowUp' && prevStart>=0){const prev=value.slice(prevStart,prevEnd),cur=value.slice(start,end);ed.setRangeText(cur,prevStart,prevEnd,'end');const newStart=prevStart+cur.length+1;ed.setRangeText(prev,newStart,end+(cur.length-prev.length),'end');ed.dispatchEvent(new Event('input',{bubbles:true}));}
      else if(ev.key==='ArrowDown' && nextStart>=0){const cur=value.slice(start,end),next=value.slice(nextStart,nextEnd);ed.setRangeText(next,start,end,'end');ed.setRangeText(cur,start+next.length+1,nextEnd+(next.length-cur.length),'end');ed.dispatchEvent(new Event('input',{bubbles:true}));}
      return;
    }
    if(mod && ev.key.toLowerCase()==='f'){
      ev.preventDefault();ev.stopImmediatePropagation();const q=prompt('Find text:');if(q){const at=ed.value.indexOf(q,ed.selectionEnd);const pos=at>=0?at:ed.value.indexOf(q);if(pos>=0){ed.focus();ed.setSelectionRange(pos,pos+q.length);}}return;
    }
    if(mod && ev.key.toLowerCase()==='h'){
      ev.preventDefault();ev.stopImmediatePropagation();const q=prompt('Find text:');if(q){const rep=prompt('Replace with:','');if(rep!==null){ed.value=ed.value.split(q).join(rep);ed.dispatchEvent(new Event('input',{bubbles:true}));}}return;
    }
    if(mod && ev.key.toLowerCase()==='g'){
      ev.preventDefault();ev.stopImmediatePropagation();const line=Number(prompt('Go to line number:','1'));if(Number.isFinite(line)&&line>0){const lines=ed.value.split('\n');let pos=0;for(let i=0;i<Math.min(line-1,lines.length);i++)pos+=lines[i].length+1;ed.focus();ed.setSelectionRange(pos,pos);}return;
    }
    if(mod && ev.shiftKey && ev.key.toLowerCase()==='p'){
      ev.preventDefault();ev.stopImmediatePropagation();const command=prompt('Command: run, save, guide, extensions, format, new file');if(!command)return;const c=command.toLowerCase();if(c==='run')buildPreview();else if(c==='save')saveState(true);else if(c==='guide')openPanel('guide');else if(c==='extensions')openPanel('extensions');else if(c==='format')formatCode();else if(c==='new file')openModal();return;
    }
    if(mod && ev.key.toLowerCase()==='p'){
      ev.preventDefault();ev.stopImmediatePropagation();const names=Object.keys(state.files);const name=prompt('Open file:\n'+names.join('\n'),activeFile);if(name&&state.files[name]!==undefined)switchFile(name);return;
    }
  }
  function insertTouchText(text, cursorOffset=null) {
    const ed=$('codeEditor'); ed.focus();
    const start=ed.selectionStart, end=ed.selectionEnd;
    ed.setRangeText(text,start,end,'end');
    if(cursorOffset!==null){const pos=start+cursorOffset;ed.setSelectionRange(pos,pos);}
    ed.dispatchEvent(new Event('input',{bubbles:true})); updateLineNumbers();
  }
  function toggleCurrentLineComment() {
    const type=typeOf(activeFile);
    const prefix=type==='html'?'<!-- ':type==='css'?'/* ':'//';
    const suffix=type==='html'?' -->':type==='css'?' */':'';
    replaceCurrentLine(line=>{
      if(type==='html' && line.trim().startsWith('<!--') && line.trim().endsWith('-->')) return line.replace('<!-- ','').replace(' -->','');
      if(type==='css' && line.trim().startsWith('/*') && line.trim().endsWith('*/')) return line.replace('/* ','').replace(' */','');
      if(type==='html'||type==='css') return prefix+line+suffix;
      return line.trim().startsWith('//')?line.replace(/^\s*\/\/\s?/,''):prefix+line;
    });
  }
  function setupMobileCodebar() {
    document.querySelectorAll('[data-mobile-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const action=btn.dataset.mobileAction, ed=$('codeEditor');
      if(action==='tab') { ed.focus(); if(expandAbbreviation()) return; insertTouchText('  '); }
      else if(action==='suggest') { ed.focus(); showSuggestions(true); }
      else if(action==='expand') { ed.focus(); if(!expandAbbreviation()) expandShortcut(); }
      else if(action==='braces') insertTouchText('{}',1);
      else if(action==='parens') insertTouchText('()',1);
      else if(action==='semicolon') insertTouchText(';');
      else if(action==='comment') { ed.focus(); toggleCurrentLineComment(); }
      else if(action==='undo') { ed.focus(); try{document.execCommand('undo');}catch(_){}; ed.dispatchEvent(new Event('input',{bubbles:true})); }
      else if(action==='redo') { ed.focus(); try{document.execCommand('redo');}catch(_){}; ed.dispatchEvent(new Event('input',{bubbles:true})); }
    }));
  }
  function setupIntelliSense() {
    ensureSuggestionBox();
    $('codeEditor').addEventListener('input',()=>showSuggestions());
    $('codeEditor').addEventListener('keydown',editorShortcuts,true);
    $('codeEditor').addEventListener('blur',()=>setTimeout(()=>{if(suggestionBox)suggestionBox.hidden=true;},150));
  }

  function escapeHtml(v){return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function renderHighlight(){const code=$("highlightCode"),ed=$("codeEditor");if(!code||!ed)return;let t=escapeHtml(ed.value);const lang=typeOf(activeFile);const rules=[[/(&lt;!--[\s\S]*?--&gt;)/g,"comment"],[/(\b(?:const|let|var|function|return|if|else|for|while|new|class|async|await|import|export|from|throw|try|catch|true|false|null|undefined)\b)/g,"keyword"],[/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,"string"],[/(\b\d+(?:\.\d+)?\b)/g,"number"],[/(\b(?:console|document|window|Math|JSON|Array|Object|localStorage)\b)/g,"object"]];
    // Tokenize in one pass so inserted spans are never recolored as source.
    const token=/(&lt;!--[\s\S]*?--&gt;)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b(?:const|let|var|function|return|if|else|for|while|new|class|async|await|import|export|from|throw|try|catch|true|false|null|undefined)\b)|(\b(?:console|document|window|Math|JSON|Array|Object|localStorage)\b)|(\b\d+(?:\.\d+)?\b)/g;
    code.innerHTML=t.replace(token,(m,c,st,kw,obj,num)=>`<span class="tok-${c?'comment':st?'string':kw?'keyword':obj?'object':'number'}">${m}</span>`)+"\n";$("highlightLayer").scrollTop=ed.scrollTop;$("highlightLayer").scrollLeft=ed.scrollLeft;}
  function projectSearch(replace=false,all=false){const q=$("searchQuery").value;if(!q){toast("Enter text to search for.");return;}const rep=$("replaceQuery").value;let count=0;const names=Object.keys(state.files);for(const name of names){if(typeof state.files[name]!=="string"||state.files[name].startsWith("data:"))continue;let content=name===activeFile?$("codeEditor").value:state.files[name];if(all){const esc=q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const rx=new RegExp(esc,"g");const matches=content.match(rx);if(matches){count+=matches.length;if(replace)content=content.replace(rx,rep);}}else if(name===activeFile){const at=content.indexOf(q,Math.max($("codeEditor").selectionEnd,0));if(at>=0){$("codeEditor").focus();$("codeEditor").setSelectionRange(at,at+q.length);count++;break;}}else if(content.includes(q))count++;if(replace&&all)state.files[name]=content;}if(replace&&all){state.files[activeFile]=$("codeEditor").value=state.files[activeFile]||"";loadEditor();saveState();}toast(all?`${count} match(es) ${replace?'replaced':'found'} across project.`:`${count?'Match found':'No further match in active file'}.`);}
  function renameOrDelete(name,action){const isFolder=Object.keys(state.files).some(p=>p.startsWith(name+"/"));if(isFolder){if(action==="delete"){if(!confirm(`Delete folder ${name} and all its files?`))return;Object.keys(state.files).filter(p=>p.startsWith(name+"/")).forEach(p=>delete state.files[p]);openFiles=openFiles.filter(p=>state.files[p]!==undefined);if(!state.files[activeFile])activeFile=Object.keys(state.files)[0];loadEditor();saveState();toast("Folder deleted.");return;}const next=prompt("Rename folder:",name);if(!next||next===name||!isSafeProjectPath(next+"/placeholder.txt")||Object.keys(state.files).some(p=>p.startsWith(next+"/"))){toast("Invalid folder name or destination already exists.");return;}Object.keys(state.files).filter(p=>p.startsWith(name+"/")).forEach(p=>{state.files[next+p.slice(name.length)]=state.files[p];delete state.files[p];});openFiles=openFiles.map(p=>p.startsWith(name+"/")?next+p.slice(name.length):p);if(activeFile.startsWith(name+"/"))activeFile=next+activeFile.slice(name.length);loadEditor();saveState();toast("Folder renamed.");return;}if(action==="delete"){if(Object.keys(state.files).length<2){toast("Keep at least one project file.");return;}if(!confirm(`Delete ${name}?`))return;delete state.files[name];openFiles=openFiles.filter(n=>n!==name);if(activeFile===name)activeFile=Object.keys(state.files)[0];loadEditor();saveState();toast("File deleted.");return;}const next=prompt("Rename file (include folder path):",name);if(!next||next===name)return;if(!isSafeProjectPath(next)||state.files[next]!==undefined){toast("Invalid name or destination already exists.");return;}state.files[next]=state.files[name];delete state.files[name];openFiles=openFiles.map(n=>n===name?next:n);if(activeFile===name)activeFile=next;loadEditor();saveState();toast("File renamed.");}
  function createFolder(){const name=prompt("Folder name (example: assets/images):",selectedFolder?selectedFolder+"/assets":"assets");if(!name)return;const clean=name.replace(/\/$/,"");if(!isSafeProjectPath(clean+"/placeholder.txt")){toast("Invalid folder path.");return;}state.files[clean+"/.folder.txt"]="Folder created in CodeSpace.";selectedFolder=clean;expandAncestors(clean+"/placeholder.txt");loadEditor();saveState();toast("Folder created.");}
  window.addEventListener("message",ev=>{const d=ev.data;if(!d||d.__codespace!==true||ev.source!==$("previewFrame")?.contentWindow)return;if(d.type==="storage"){try{localStorage.setItem("codespace-preview-storage-v1",JSON.stringify(d.data||{}));}catch(_){}}else if(d.type.startsWith("console.")||d.type==="error"){$("consoleOutput").textContent+=`\n[${d.type.replace("console.","").toUpperCase()}] ${(d.args||[]).join(" ")}`;$("consoleOutput").scrollTop=$("consoleOutput").scrollHeight;}});
  function setUp() {
    $("codeEditor").addEventListener("input",()=>{
      if(isBinaryPath(activeFile))return;
      if(!isBinaryPath(activeFile))state.files[activeFile]=$("codeEditor").value;
      $("saveStatus").textContent="Unsaved changes";
      updateLineNumbers();renderHighlight();
      saveState();
      // Desktop/tablet side-by-side preview refreshes automatically after edits.
      // On mobile, editing and preview are separate screens, so the Preview button
      // calls buildPreview() with the latest saved editor contents.
      if (window.matchMedia && window.matchMedia("(min-width: 641px)").matches) {
        clearTimeout(previewUpdateTimer);
        previewUpdateTimer=setTimeout(()=>{
          const previewVisible = !$("previewArea").hidden && getComputedStyle($("previewArea")).display !== "none";
          if (previewVisible) buildPreview();
        }, 450);
      }
    });
    $("codeEditor").addEventListener("scroll",()=>{updateLineNumbers();renderHighlight();});
    $("codeEditor").addEventListener("click",updateLineNumbers);
    $("codeEditor").addEventListener("keyup",updateLineNumbers);
    $("codeEditor").addEventListener("keydown",ev=>{
      const ed=ev.currentTarget; if(ev.key===">" && typeOf(activeFile)==="html" && ed.selectionStart===ed.selectionEnd){const before=ed.value.slice(0,ed.selectionStart);const m=before.match(/<([a-zA-Z][\w:-]*)(?:\s[^<>]*)?$/);const voids=["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"];if(m&&!voids.includes(m[1].toLowerCase())&&!before.endsWith("/")){ev.preventDefault();ed.setRangeText("></"+m[1]+">",ed.selectionStart,ed.selectionEnd,"end");ed.setSelectionRange(ed.selectionStart- m[1].length-3,ed.selectionStart- m[1].length-3);ed.dispatchEvent(new Event("input"));return;}} if(["(","[","{","\"","'","`"].includes(ev.key)&&!ev.ctrlKey&&!ev.metaKey&&!ev.altKey&&ed.selectionStart===ed.selectionEnd){const close={"(":")","[":"]","{":"}","\"":"\"","'":"'","`":"`"}[ev.key];ev.preventDefault();ed.setRangeText(ev.key+close,ed.selectionStart,ed.selectionEnd,"end");ed.setSelectionRange(ed.selectionStart-1,ed.selectionStart-1);ed.dispatchEvent(new Event("input"));return;}
      if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==="s"){ev.preventDefault();saveState(true);}
      if((ev.ctrlKey||ev.metaKey)&&ev.key==="Enter"){ev.preventDefault();buildPreview();}
      if(ev.key==="Tab"){ev.preventDefault();const ed=ev.currentTarget;ed.setRangeText("  ",ed.selectionStart,ed.selectionEnd,"end");ed.dispatchEvent(new Event("input"));}
    });
    $("saveBtn").addEventListener("click",()=>saveState(true));
    $("runBtn").addEventListener("click",buildPreview);$("refreshPreview").addEventListener("click",buildPreview);
    $("formatBtn").addEventListener("click",formatCode);$("expandBtn").addEventListener("click",expandShortcut);
    $("newFileBtn")?.addEventListener("click",openModal);$("newFileSide").addEventListener("click",openModal);
    $("cancelModal").addEventListener("click",()=> $("modalBackdrop").hidden=true);
    $("cancelModal2").addEventListener("click",()=> $("modalBackdrop").hidden=true);
    $("modalBackdrop").addEventListener("click",ev=>{if(ev.target===$("modalBackdrop"))$("modalBackdrop").hidden=true;});
    $("newFileForm").addEventListener("submit",ev=>{ev.preventDefault();createFile($("fileNameInput").value);});
    $("menuBtn").addEventListener("click",()=> $("workspace").classList.toggle("files-open"));
    $("closePreview").addEventListener("click",()=>{$("workspace").classList.remove("show-preview");document.body.classList.remove("mobile-preview-mode");setNav("code");});
    $("guideBtn").addEventListener("click",()=>openPanel("guide"));$("guideSide").addEventListener("click",()=>openPanel("guide"));
    $("extensionsBtn").addEventListener("click",()=>openPanel("extensions"));$("extensionsSide").addEventListener("click",()=>openPanel("extensions"));
    $("closePanel").addEventListener("click",()=>{$("workspace").classList.remove("panel-open");$("toolPanel").hidden=true;setNav("code");});
    $("exportBtn").addEventListener("click",exportProject);
    $("importBtn").addEventListener("click",()=>$("importInput").click());
    $("importInput").addEventListener("change",ev=>{if(ev.target.files?.[0])importProject(ev.target.files[0]);});
    $("importFilesBtn").addEventListener("click",()=>$("fileImportInput").click());
    $("fileImportInput").addEventListener("change",ev=>{if(ev.target.files?.length)importIndividualFiles(ev.target.files);});
    $("openFolderBtn").addEventListener("click",()=>$("folderImportInput").click());
    $("folderImportInput").addEventListener("change",ev=>{if(ev.target.files?.length)importFolder(ev.target.files);});
    $("uploadZipBtn").addEventListener("click",()=>$("zipImportInput").click());
    $("zipImportInput").addEventListener("change",ev=>{if(ev.target.files?.[0])importZip(ev.target.files[0]);});
    $("navCode").addEventListener("click",()=>{$("workspace").classList.remove("show-preview","files-open","panel-open");document.body.classList.remove("mobile-preview-mode");$("toolPanel").hidden=true;setNav("code");});
    $("navFiles").addEventListener("click",()=>{$("workspace").classList.remove("show-preview","panel-open");document.body.classList.remove("mobile-preview-mode");$("toolPanel").hidden=true;$("workspace").classList.add("files-open");setNav("files");});
    $("navPreview").addEventListener("click",buildPreview);$("navGuide").addEventListener("click",()=>openPanel("guide"));
    $("searchBtn").addEventListener("click",()=>{$("searchPanel").hidden=!$("searchPanel").hidden;$("searchQuery").focus();});
    $("closeSearchBtn").addEventListener("click",()=>$("searchPanel").hidden=true);
    $("findNextBtn").addEventListener("click",()=>projectSearch(false,false));
    $("replaceBtn").addEventListener("click",()=>{const ed=$("codeEditor"),q=$("searchQuery").value;if(q&&ed.value.slice(ed.selectionStart,ed.selectionEnd)===q){ed.setRangeText($("replaceQuery").value,ed.selectionStart,ed.selectionEnd,"end");ed.dispatchEvent(new Event("input"));}else projectSearch(false,false);});
    $("replaceAllBtn").addEventListener("click",()=>projectSearch(true,true));
    $("zoomInBtn").addEventListener("click",()=>{document.documentElement.style.setProperty("--editor-font",Math.min(24,(parseFloat(getComputedStyle($("codeEditor")).fontSize)||12)+1)+"px");$("codeEditor").style.fontSize="var(--editor-font)";$("highlightLayer").style.fontSize="var(--editor-font)";});
    $("zoomOutBtn").addEventListener("click",()=>{document.documentElement.style.setProperty("--editor-font",Math.max(8,(parseFloat(getComputedStyle($("codeEditor")).fontSize)||12)-1)+"px");$("codeEditor").style.fontSize="var(--editor-font)";$("highlightLayer").style.fontSize="var(--editor-font)";});
    $("themeBtn").addEventListener("click",()=>document.body.classList.toggle("light-editor"));
    $("deviceSize").addEventListener("change",ev=>{$("previewFrame").style.maxWidth=ev.target.value;$("previewFrame").style.margin="0 auto";});
    $("clearConsoleBtn").addEventListener("click",()=>$("consoleOutput").textContent="Console cleared.");
    $("newFolderBtn").addEventListener("click",createFolder);
    document.addEventListener("contextmenu",ev=>{const row=ev.target.closest(".file-item");if(!row)return;ev.preventDefault();const name=row.title;if(!name)return;const choice=prompt(`File/folder: ${name}\nType R to rename, D to delete, anything else to cancel`,"");if(choice?.toLowerCase()==="r")renameOrDelete(name,"rename");else if(choice?.toLowerCase()==="d")renameOrDelete(name,"delete");});
    $("fileList").addEventListener("touchstart",ev=>{const row=ev.target.closest(".file-item");if(!row)return;row._hold=setTimeout(()=>{const name=row.title;const choice=prompt(`File/folder: ${name}\nType R to rename, D to delete`,"");if(choice?.toLowerCase()==="r")renameOrDelete(name,"rename");else if(choice?.toLowerCase()==="d")renameOrDelete(name,"delete");},650);},{passive:true});
    $("fileList").addEventListener("touchend",ev=>{const row=ev.target.closest(".file-item");if(row)clearTimeout(row._hold);});
    loadEditor();saveState();renderHighlight();buildPreview();
    if(window.matchMedia && window.matchMedia("(max-width: 640px)").matches){
      $("workspace").classList.remove("show-preview");document.body.classList.remove("mobile-preview-mode");setNav("code");
    }
  }
  setUp();
  setupIntelliSense();
  setupMobileCodebar();
})();