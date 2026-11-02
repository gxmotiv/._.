import {EditorState} from "@codemirror/state";
import {EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection} from "@codemirror/view";
import {defaultKeymap, history, historyKeymap, indentWithTab} from "@codemirror/commands";
import {syntaxHighlighting, defaultHighlightStyle, foldGutter} from "@codemirror/language";
import {luau} from "@fazelstudio/codemirror-lang-luau";
import {autocompletion} from "@codemirror/autocomplete";
import {Filesystem, Directory, Encoding} from "@capacitor/filesystem";
import {Capacitor} from "@capacitor/core";
import {SafExport, RobloxLauncher} from "./src/plugins/native";
import {Overlay} from "./src/plugins/overlay";

const $=id=>document.getElementById(id);
const STORAGE_KEY="deltaLabScriptsV2";
const native=Capacitor.isNativePlatform();
let scripts=[],tabs=[],activeTabId=null,editorView=null;
const uid=()=>Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
const starter="-- Welcome to Delta Lab\n-- Write scripts for your own Roblox Studio experiences.\n\nlocal message = \"Hello, Roblox!\"\nprint(message)\n";
async function loadScripts(){
 try{
  if(native){const r=await Filesystem.readFile({path:"library/scripts.json",directory:Directory.Data,encoding:Encoding.UTF8});scripts=JSON.parse(r.data)||[]}
  else scripts=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
  if(!Array.isArray(scripts))scripts=[];
 }catch{scripts=[]}
}
async function persist(){
 try{
  const data=JSON.stringify(scripts);
  if(native)await Filesystem.writeFile({path:"library/scripts.json",directory:Directory.Data,data,encoding:Encoding.UTF8,recursive:true});
  else localStorage.setItem(STORAGE_KEY,data);
  $("saveState").textContent="Saved on this device";
 }catch(e){$("saveState").textContent="Save failed: "+(e.message||"storage unavailable")}
}
function activeTab(){return tabs.find(t=>t.id===activeTabId)}
function mountEditor(){
 const tab=activeTab();if(!tab)return;
 if(editorView)editorView.destroy();
 editorView=new EditorView({state:EditorState.create({doc:tab.code,extensions:[
  lineNumbers(),foldGutter(),history(),drawSelection(),highlightActiveLine(),luau(),syntaxHighlighting(defaultHighlightStyle),
  autocompletion(),keymap.of([indentWithTab,...defaultKeymap,...historyKeymap]),
  EditorView.updateListener.of(u=>{if(u.docChanged){tab.code=u.state.doc.toString();$("saveState").textContent="Unsaved changes";updateLineCount()}}),
  EditorView.theme({ "&":{height:"55vh",minHeight:"300px",backgroundColor:"#0d1421",color:"#c7d6eb",fontSize:"12px"},".cm-scroller":{overflow:"auto",fontFamily:"ui-monospace,monospace",lineHeight:"1.8"},".cm-gutters":{backgroundColor:"#0d1421",color:"#64748b",border:"none"},".cm-activeLine":{backgroundColor:"#172235"},".cm-activeLineGutter":{backgroundColor:"#172235"}})
 ]}),parent:$("codeEditor")});
 updateLineCount();
}
function updateLineCount(){const tab=activeTab();$("lineCount").textContent=tab?String((tab.code.match(/\n/g)||[]).length+1):"0"}
function renderTabs(){
 const bar=$("tabBar");bar.replaceChildren();
 tabs.forEach(t=>{const b=document.createElement("button");b.className="editor-tab"+(t.id===activeTabId?" active":"");b.setAttribute("role","tab");b.setAttribute("aria-selected",String(t.id===activeTabId));b.textContent=t.name;b.onclick=()=>{if(activeTab())activeTab().code=editorView.state.doc.toString();activeTabId=t.id;renderTabs();mountEditor()};const x=document.createElement("span");x.textContent=" ×";x.onclick=e=>{e.stopPropagation();closeTab(t.id)};b.append(x);bar.append(b)});
}
function openTab(script){if(activeTab()&&editorView)activeTab().code=editorView.state.doc.toString();const t={id:uid(),scriptId:script.id||null,name:script.name||"Untitled.luau",code:script.code||""};tabs.push(t);activeTabId=t.id;renderTabs();mountEditor();$("scriptName").value=t.name}
function closeTab(id){const i=tabs.findIndex(t=>t.id===id);if(i<0)return;tabs.splice(i,1);if(activeTabId===id)activeTabId=tabs[Math.max(0,i-1)]?.id||null;if(activeTab()){renderTabs();mountEditor();$("scriptName").value=activeTab().name}else{if(editorView){editorView.destroy();editorView=null}$("codeEditor").replaceChildren();renderTabs()}}
function newScript(){openTab({name:"NewScript.luau",code:starter});$("saveState").textContent="New tab"}
function saveCurrent(){const t=activeTab();if(!t)return; t.name=$("scriptName").value.trim()||"Untitled.luau";t.code=editorView.state.doc.toString();let item=scripts.find(s=>s.id===t.scriptId);if(!item){item={id:uid(),name:t.name,code:t.code,updated:Date.now()};scripts.unshift(item);t.scriptId=item.id}else Object.assign(item,{name:t.name,code:t.code,updated:Date.now()});persist();renderLibrary();renderTabs()}
function setView(view){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(view+"View").classList.add("active");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));$("pageName").textContent=view==="editor"?"Editor":view==="library"?"Script library":view==="settings"?"Settings":"Console";$("sidebar").classList.remove("open");if(view==="library")renderLibrary()}

let overlayEnablePending=false;
async function refreshOverlayPermission(){
 const status=$("overlayStatus"), toggle=$("overlayToggle");
 if(!native){toggle.disabled=true;status.textContent="Floating Overlay is available in the Android app only.";return false}
 try{
  const result=await Overlay.checkPermission();
  status.textContent=result.granted?"Permission granted. The floating Δ button can appear above other apps.":"Permission needed. Turn on Display over other apps for Delta Lab.";
  return result.granted;
 }catch(e){status.textContent="Could not check permission: "+(e.message||"unknown error");return false}
}
async function enableOverlay(){
 if(!native){$("overlayToggle").checked=false;$("overlayStatus").textContent="Install the Android app to use Floating Overlay.";return}
 try{
  const before=await Overlay.checkPermission();
  if(!before.granted){
   overlayEnablePending=true;
   $("overlayStatus").textContent="Opening Android permission settings… Return here after allowing Display over other apps.";
   await Overlay.requestPermission();
   const after=await Overlay.checkPermission();
   if(!after.granted)return;
  }
  overlayEnablePending=false;
  await Overlay.showOverlay();
  $("overlayStatus").textContent="Floating Overlay is on. Tap Δ to return to Delta Lab.";
 }catch(e){
  overlayEnablePending=false;
  $("overlayToggle").checked=false;
  $("overlayStatus").textContent="Could not enable overlay: "+(e.message||"unknown error");
 }
}
async function disableOverlay(){
 overlayEnablePending=false;
 try{if(native)await Overlay.hideOverlay();$("overlayStatus").textContent="Floating Overlay is off."}
 catch(e){$("overlayStatus").textContent="Could not hide overlay: "+(e.message||"unknown error")}
}
async function launchRoblox(){
 try{
  const status=await RobloxLauncher.isInstalled();
  if(!status.installed){alert("Roblox is not installed on this device. Install Roblox, then try again.");return false}
  await RobloxLauncher.openApp();
  $("saveState").textContent="Roblox opened";
  return true;
 }catch(e){alert("Could not check or open Roblox: "+(e.message||"unknown error"));return false}
}
async function openInRoblox(){
 try{
  const status=await RobloxLauncher.isInstalled();
  if(!status.installed){alert("Roblox is not installed on this device. Install Roblox, then try again.");return}
  const placeId=prompt("Enter the Roblox experience Place ID to open:");
  if(placeId===null)return;
  const clean=placeId.trim();
  if(!/^\d+$/.test(clean)){alert("Enter a valid numeric Roblox Place ID.");return}
  await RobloxLauncher.openPlace({placeId:clean});
  $("saveState").textContent="Opening Roblox experience "+clean;
 }catch(e){alert("Could not open Roblox experience: "+(e.message||"unknown error"))}
}
function renderLibrary(){const host=$("scriptList");host.replaceChildren();if(!scripts.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="No saved scripts yet. Create or import your first script.";host.append(empty);return}scripts.forEach(s=>{const row=document.createElement("div");row.className="script-row";const meta=document.createElement("div");meta.className="script-meta";const title=document.createElement("b");title.textContent=s.name;const sub=document.createElement("p");sub.textContent=(s.code.match(/\n/g)||[]).length+1+" lines";meta.append(title,sub);const open=document.createElement("button");open.textContent="Open";open.onclick=()=>{openTab(s);setView("editor")};const del=document.createElement("button");del.textContent="Delete";del.onclick=async()=>{if(!confirm("Delete "+s.name+"?"))return;scripts=scripts.filter(x=>x.id!==s.id);await persist();renderLibrary()};row.append(meta,open,del);host.append(row)})}
function download(name,data,type="text/plain"){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function exportCurrent(){const t=activeTab();if(!t)return;const content=editorView.state.doc.toString();if(native){try{const r=await SafExport.exportText({fileName:t.name,content});$("saveState").textContent="Exported to "+r.uri}catch(e){$("saveState").textContent="Export cancelled/failed: "+(e.message||"unknown error")}return}download(t.name,content,"text/plain;charset=utf-8")}
async function exportBackup(){const content=JSON.stringify({format:"delta-lab-backup",version:2,scripts},null,2);if(native){try{const r=await SafExport.exportText({fileName:"delta-lab-backup.json",content});$("saveState").textContent="Backup exported to "+r.uri}catch(e){$("saveState").textContent="Backup export cancelled/failed: "+(e.message||"unknown error")}return}download("delta-lab-backup.json",content,"application/json")}
async function importFile(file){if(!file)return;try{const text=await file.text();if(file.name.toLowerCase().endsWith(".json")){const parsed=JSON.parse(text),incoming=Array.isArray(parsed)?parsed:parsed.scripts;if(!Array.isArray(incoming))throw Error("Backup has no scripts array");for(const s of incoming)if(s&&typeof s.name==="string"&&typeof s.code==="string")scripts.unshift({id:uid(),name:s.name,code:s.code,updated:Date.now()});await persist();renderLibrary()}else{openTab({name:file.name,code:text});setView("editor")}$("saveState").textContent="Import complete — save to library"}catch(e){$("saveState").textContent="Import failed: "+e.message}}
function checkScript(){setView("console");const out=$("consoleOutput");out.replaceChildren();const add=(s,type="good")=>{const p=document.createElement("p");p.className="console-line "+type;p.textContent=s;out.append(p)};const code=editorView?.state.doc.toString()||"";add("Lines: "+(code.match(/\n/g)||[]).length+1);add("Luau syntax highlighting is active.");add("This is an editor, not a Luau runtime. No code was executed.");}
document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));$("launchRobloxNav").onclick=launchRoblox;$("openInRobloxBtn").onclick=openInRoblox;
$("overlayToggle").addEventListener("change",e=>e.target.checked?enableOverlay():disableOverlay());\ndocument.addEventListener("visibilitychange",async()=>{if(document.visibilityState==="visible"&&overlayEnablePending){const granted=await refreshOverlayPermission();if(granted){$("overlayToggle").checked=true;await enableOverlay()}else{$("overlayToggle").checked=false;overlayEnablePending=false}}});
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
$("newBtn").onclick=newScript;$("libraryNew").onclick=()=>{newScript();setView("editor")};
$("saveBtn").onclick=saveCurrent;$("scriptName").onchange=()=>{const t=activeTab();if(t){t.name=$("scriptName").value;renderTabs()}};
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(editorView?.state.doc.toString()||"");$("saveState").textContent="Copied"}catch{$("saveState").textContent="Clipboard unavailable"}};
$("importBtn").onclick=()=>$("fileInput").click();$("fileInput").onchange=e=>{importFile(e.target.files[0]);e.target.value=""};
$("exportBtn").onclick=exportCurrent;$("backupBtn").onclick=exportBackup;$("importLibraryBtn").onclick=()=>$("backupInput").click();$("backupInput").onchange=e=>{importFile(e.target.files[0]);e.target.value=""};
$("clearConsole").onclick=()=>$("consoleOutput").replaceChildren();const check=document.createElement("button");check.className="quiet-btn";check.textContent="Check editor";check.onclick=checkScript;document.querySelector(".toolbar-right").prepend(check);
await loadScripts();openTab({name:"NewScript.luau",code:starter});await refreshOverlayPermission();$("saveState").textContent="Local workspace ready";
