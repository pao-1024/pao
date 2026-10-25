#pragma once

// 板载控制页。方向键按住期间通过 WebSocket 每 150 ms 续发一次 400 ms 的运动指令；
// 页面退出或断网后指令到期停车。运动渐变和配置保存在固件底盘中。
inline constexpr char kControlPage[] = R"PAO(<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>PAO 遥控</title>
<style>
:root{color-scheme:dark;--bg:#0a0d12;--panel:#10151c;--line:#263240;--text:#d8e2ec;--muted:#91a3b5;--accent:#4cc2ff;--good:#4fd18b;--bad:#ff6b6b}
*{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
html,body{overscroll-behavior:none}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif}
main{max-width:760px;margin:auto;padding:16px;display:grid;gap:12px;grid-template-columns:1fr 1fr}
header,p.hint{grid-column:1/-1}
header{display:flex;justify-content:space-between;align-items:center}h1{margin:0;font-size:20px}
.status{font-size:12px;color:var(--muted)}.status.ok{color:var(--good)}.status.bad{color:var(--bad)}
section{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:13px}
h2{margin:0;align-self:flex-start;font-size:13px;color:var(--muted);font-weight:600}
.pad{display:grid;grid-template-columns:repeat(3,76px);grid-template-rows:repeat(3,68px);gap:5px;grid-template-areas:". up ." "left stop right" ". down ."}
button{font:inherit;color:var(--text);background:#18222d;border:1px solid #344454;border-radius:12px;cursor:pointer;touch-action:none}
button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.direction{font-size:21px;line-height:1.1;font-weight:650}.direction small{display:block;font-size:11px;font-weight:400;color:var(--muted);margin-top:5px}
.direction.active{background:#19405a;border-color:var(--accent);box-shadow:0 0 0 2px #4cc2ff35}
.up{grid-area:up}.down{grid-area:down}.left{grid-area:left}.right{grid-area:right}
.stop{grid-area:stop;color:#ffb9b9;border-color:#805050;background:#342225;font-weight:700}
.readout{font-size:13px;color:var(--muted)}.readout b{color:var(--text)}
label{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;color:var(--muted)}
input[type=range]{flex:1;min-width:70px;accent-color:var(--accent)}output{font-family:ui-monospace,monospace;color:var(--text);min-width:48px;text-align:right}
.settings{align-items:stretch}.settings fieldset{border:0;padding:0;margin:0;display:grid;gap:12px}.settings fieldset:disabled{opacity:.5}
.config-line{display:flex;align-items:center;justify-content:space-between;gap:8px}.config-line button{padding:5px 9px;font-size:12px}
.fire{position:relative;overflow:hidden;width:180px;height:180px;border-radius:50%;font-size:20px;font-weight:700;letter-spacing:.1em;background:#2b1e0e;border:2px solid #7a5420;box-shadow:0 6px 18px #0008}
.fire small{display:block;font-size:12px;font-weight:400;color:var(--muted);letter-spacing:0}
.fire.flash{animation:flash .35s}@keyframes flash{from{background:#ffd9a0}to{background:#2b1e0e}}
p.hint{margin:0;font-size:12px;color:var(--muted)}
@media(max-width:600px){main{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.fire.flash{animation:none}}
</style></head><body><main>
<header><h1>PAO 遥控</h1><span id="status" class="status">连接中</span></header>
<section><h2>底盘</h2>
<div class="readout">前方障碍物 <b id="distance" aria-live="polite">读取中…</b></div>
<div class="pad" aria-label="小车方向">
<button class="direction up" data-dir="forward" aria-label="按住前进">↑<small>前进</small></button>
<button class="direction left" data-dir="left" aria-label="按住逆时针旋转">↶<small>逆时针</small></button>
<button class="stop" id="stop" aria-label="立即停止">停</button>
<button class="direction right" data-dir="right" aria-label="按住顺时针旋转">↷<small>顺时针</small></button>
<button class="direction down" data-dir="backward" aria-label="按住后退">↓<small>后退</small></button>
</div>
<label>运动输出<input id="power" type="range" min="20" max="100" value="80"><output id="powerOut">80%</output></label>
</section>
<section><h2>电磁炮</h2><button class="fire" id="fire">开炮<small>发射后约 10 s 充满</small></button></section>
<section class="settings"><h2>运动校准</h2>
<fieldset id="configFields" disabled>
<label>输出渐变<input id="ramp" type="range" min="0" max="3000" step="100" value="1000"><output id="rampOut">1.0 s</output></label>
<label>左轮比例<input id="leftScale" type="range" min="0" max="1" step="0.01" value="1"><output id="leftScaleOut">1.00</output></label>
<label>右轮比例<input id="rightScale" type="range" min="0" max="1" step="0.01" value="1"><output id="rightScaleOut">1.00</output></label>
</fieldset><div class="config-line"><span id="configStatus" class="status" role="status">读取配置中</span><button id="retry" hidden>重试保存</button></div>
</section>
<p class="hint">按住方向键驾驶，松开平滑停车。中央“停”立即清零输出；键盘 WASD / 方向键驾驶，空格开炮。校准值在调节结束后保存到设备。</p>
</main><script>
const $=id=>document.getElementById(id);
const statusEl=$("status"),configStatus=$("configStatus");
function setStatus(message,kind){statusEl.textContent=message;statusEl.className="status "+(kind||"")}
function setConfigStatus(message,kind){configStatus.textContent=message;configStatus.className="status "+(kind||"")}
let socket,sequence=0;const pending=new Map();
function call(path,params){if(!socket||socket.readyState!==WebSocket.OPEN)return Promise.reject(Error("连接断开"));
  const connection=socket,id=sequence=sequence%2147483647+1;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{
    pending.delete(id);reject(Error("WS 请求超时"));connection.close()
  },3000);pending.set(id,{resolve,reject,timer});
  connection.send(JSON.stringify({id,path,query:new URLSearchParams(params||{}).toString()}))})}
function connect(){const connection=socket=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}/ws`);
  connection.onopen=()=>{setStatus("WS 已连接","ok");loadConfig();pollDistance(connection)};
  connection.onmessage=event=>{let message;try{message=JSON.parse(event.data)}catch(e){connection.close();return}
    const request=pending.get(message.id);if(!request)return;
    pending.delete(message.id);clearTimeout(request.timer);
    if(message.ok)request.resolve(message.data);else request.reject(Error(message.error||"请求失败"))};
  connection.onclose=()=>{for(const request of pending.values()){
    clearTimeout(request.timer);request.reject(Error("连接断开"))}pending.clear();clearControls();
    $("distance").textContent="连接断开";$("distance").style.color="var(--bad)";
    setStatus("WS 断开，正在重连","bad");setTimeout(connect,1000)};
  connection.onerror=()=>connection.close()}
function reportError(error){setStatus(error.message||"连接断开","bad")}

const directions={forward:{path:"/api/move",sign:1},backward:{path:"/api/move",sign:-1},
  left:{path:"/api/rotate",sign:1},right:{path:"/api/rotate",sign:-1}};
const keys={KeyW:"forward",ArrowUp:"forward",KeyS:"backward",ArrowDown:"backward",
  KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right"};
const held=new Map();let pointerDir=null,currentPath=null,lastDir=null,lastSpeed=0,lastSent=0;
let pendingMotion=null,sendingMotion=false;
async function queueMotion(path,params){pendingMotion={path,params};if(sendingMotion)return;
  sendingMotion=true;while(pendingMotion){const next=pendingMotion;pendingMotion=null;
    try{await call(next.path,next.params);setStatus("WS 已连接","ok")}catch(e){reportError(e)}}sendingMotion=false}
function selectedDir(){return pointerDir||Array.from(held.values()).at(-1)||null}
function markDirection(dir){document.querySelectorAll(".direction").forEach(button=>
  button.classList.toggle("active",button.dataset.dir===dir))}
function syncMotion(force=false){const dir=selectedDir();markDirection(dir);
  if(!dir){if(currentPath){queueMotion(currentPath,{speed:0,duration_ms:400});currentPath=null;lastDir=null}return}
  const now=performance.now(),motion=directions[dir],speed=motion.sign*Number($("power").value);
  if(force||dir!==lastDir||speed!==lastSpeed||now-lastSent>=150){
    queueMotion(motion.path,{speed,duration_ms:400});lastSent=now;lastDir=dir;lastSpeed=speed;currentPath=motion.path}}
function clearControls(){pointerDir=null;held.clear();currentPath=null;lastDir=null;pendingMotion=null;markDirection(null)}
function emergencyStop(){clearControls();queueMotion("/api/stop")}
for(const button of document.querySelectorAll(".direction")){
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointerDir=button.dataset.dir;
    button.setPointerCapture(e.pointerId);syncMotion(true)};
  button.onpointerup=button.onpointercancel=()=>{if(pointerDir===button.dataset.dir){pointerDir=null;syncMotion(true)}};
}
$("stop").onclick=emergencyStop;
$("power").oninput=()=>{$("powerOut").textContent=$("power").value+"%";syncMotion(true)};
setInterval(()=>syncMotion(),50);

function showConfig(){ $("rampOut").textContent=(Number($("ramp").value)/1000).toFixed(1)+" s";
  $("leftScaleOut").textContent=Number($("leftScale").value).toFixed(2);
  $("rightScaleOut").textContent=Number($("rightScale").value).toFixed(2)}
async function loadConfig(){try{const config=await call("/api/motion-config");
  if(!configDirty){$("ramp").value=config.ramp_time_ms;
    $("leftScale").value=config.left_scale;$("rightScale").value=config.right_scale;
    showConfig();setConfigStatus("已从设备加载","ok");$("retry").hidden=true}
  $("configFields").disabled=false}
  catch(e){setConfigStatus("读取配置失败，请刷新页面","bad")}}
let configDirty=false,pendingSave=false,saving=false;
async function saveConfig(){pendingSave=true;if(saving)return;saving=true;
  while(pendingSave){pendingSave=false;
    const config={ramp_time_ms:$("ramp").value,left_scale:$("leftScale").value,right_scale:$("rightScale").value};
    setConfigStatus("保存中");$("retry").hidden=true;
    try{await call("/api/motion-config",config);
      const shown={ramp_time_ms:$("ramp").value,left_scale:$("leftScale").value,right_scale:$("rightScale").value};
      if(!pendingSave){const same=JSON.stringify(shown)===JSON.stringify(config);
        configDirty=!same;setConfigStatus(same?"已保存到设备":"未保存",same?"ok":"")}}
    catch(e){setConfigStatus("保存失败，请重试","bad");$("retry").hidden=false}}
  saving=false}
for(const id of ["ramp","leftScale","rightScale"]){$(id).oninput=()=>{configDirty=true;showConfig();setConfigStatus("未保存")};$(id).onchange=saveConfig}
$("retry").onclick=saveConfig;

const fire=$("fire");fire.onclick=async()=>{try{await call("/api/launcher/fire");
  fire.classList.remove("flash");void fire.offsetWidth;fire.classList.add("flash")}catch(e){reportError(e)}};
addEventListener("keydown",e=>{if(e.target instanceof Element&&e.target.closest("input,button"))return;
  if(e.code==="Space"){e.preventDefault();if(!e.repeat)fire.click();return}
  if(keys[e.code]){e.preventDefault();if(!held.has(e.code)){held.set(e.code,keys[e.code]);syncMotion(true)}}});
addEventListener("keyup",e=>{if(keys[e.code]){held.delete(e.code);syncMotion(true)}});
addEventListener("blur",emergencyStop);
document.addEventListener("visibilitychange",()=>{if(document.hidden)emergencyStop()});
addEventListener("pagehide",()=>{fetch("/api/stop",{method:"POST",keepalive:true}).catch(()=>{})});
async function pollDistance(connection){if(socket!==connection||connection.readyState!==WebSocket.OPEN)return;
  const output=$("distance");try{const state=await call("/api/distance");
    const valid=!state.error&&Number.isFinite(state.distance_cm);
    output.textContent=valid?state.distance_cm.toFixed(1)+" cm":
      state.error==="ESP_ERR_TIMEOUT"?"测距超时（未收到回波）":"测距失败："+(state.error||"无有效读数");
    output.style.color=valid?"":"var(--bad)"}
  catch(e){output.textContent="读取失败（连接超时或断开）";output.style.color="var(--bad)"}
  finally{if(socket===connection)setTimeout(()=>pollDistance(connection),1000)}}
connect();
</script></body></html>
)PAO";
