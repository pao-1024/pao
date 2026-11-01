#pragma once

// 板载控制页。方向键按住期间通过 WebSocket 每 150 ms 续发一次 400 ms 的运动指令；
// 页面退出或断网后指令到期停车。运动配置保存在设备中。
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
.explore-controls{display:flex;gap:8px;width:100%}.explore-controls button{flex:1;padding:9px}
label{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;color:var(--muted)}
input[type=range]{flex:1;min-width:70px;accent-color:var(--accent)}output{font-family:ui-monospace,monospace;color:var(--text);min-width:48px;text-align:right}
.settings{grid-column:1/-1;align-items:stretch}.settings fieldset{border:0;padding:0;margin:0;display:grid;gap:12px}.settings fieldset:disabled{opacity:.5}
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
<div class="explore-controls"><button id="exploreStart">开始探索</button><button id="exploreStop">退出探索</button></div>
<div class="readout">自动探索 <b id="exploreState" aria-live="polite">读取中…</b></div>
</section>
<section><h2>电磁炮</h2><button class="fire" id="fire">开炮<small>充能请看模块指示灯</small></button></section>
<section class="settings"><h2>运动设置</h2>
<fieldset id="configFields" disabled>
<label>前进／后退最大输出<input id="movePower" type="range" min="20" max="100" value="80"><output id="movePowerOut">80%</output></label>
<label>旋转最大输出<input id="rotatePower" type="range" min="20" max="100" value="80"><output id="rotatePowerOut">80%</output></label>
<label>输出渐变<input id="ramp" type="range" min="0" max="3000" step="100" value="1000"><output id="rampOut">1.0 s</output></label>
<label>最小有效输出<input id="minOutput" type="range" min="0" max="99" step="1" value="0"><output id="minOutputOut">0%</output></label>
<label>左轮比例<input id="leftScale" type="range" min="0" max="1" step="0.01" value="1"><output id="leftScaleOut">1.00</output></label>
<label>右轮比例<input id="rightScale" type="range" min="0" max="1" step="0.01" value="1"><output id="rightScaleOut">1.00</output></label>
</fieldset><div class="config-line"><span id="configStatus" class="status" role="status">读取配置中</span><button id="retry" hidden>重试保存</button></div>
</section>
<section class="settings"><h2>测距警报</h2>
<fieldset id="alarmFields" disabled>
<label>触发距离<input id="alarmDistance" type="range" min="2" max="100" step="1" value="10"><output id="alarmDistanceOut">10 cm</output></label>
</fieldset><div class="config-line"><span id="alarmStatus" class="status" role="status">读取配置中</span><button id="alarmRetry" hidden>重试保存</button></div>
</section>
<p class="hint">按住方向键驾驶，松开平滑停车。中央“停”立即清零输出并退出探索；键盘 WASD / 方向键驾驶，空格开炮。探索按前方测距短时前进和转向，最长两分钟，测距失败即停车。最小有效输出须低于前进和旋转最大输出；设置在调节结束后保存到设备。测距不大于触发距离时播放警报，恢复到触发距离以上 2 cm 后解除。</p>
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
function connect(){const connection=socket=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}${location.pathname.replace(/[^/]*$/, "")}ws`);
  connection.onopen=()=>{setStatus("WS 已连接","ok");loadConfig();loadAlarmConfig();pollDistance(connection);pollExplore(connection)};
  connection.onmessage=event=>{let message;try{message=JSON.parse(event.data)}catch(e){connection.close();return}
    const request=pending.get(message.id);if(!request)return;
    pending.delete(message.id);clearTimeout(request.timer);
    if(message.ok)request.resolve(message.data);else request.reject(Error(message.error||"请求失败"))};
  connection.onclose=async()=>{for(const request of pending.values()){
    clearTimeout(request.timer);request.reject(Error("连接断开"))}pending.clear();clearControls();
    $("distance").textContent="连接断开";$("distance").style.color="var(--bad)";
    $("exploreState").textContent="连接断开";
    let busy=false;try{const response=await fetch("/_single_device/status",{cache:"no-store",signal:AbortSignal.timeout(3000)});
      if(response.ok){const state=await response.json();busy=state.available===false&&state.owned===false}}catch(e){}
    setStatus(busy?"设备正在被其他浏览器使用，空闲后自动重试":"WS 断开，正在重连","bad");setTimeout(connect,busy?5000:1000)};
  connection.onerror=()=>connection.close()}
function reportError(error){setStatus(error.message||"连接断开","bad")}

const directions={forward:"forward",backward:"backward",left:"turn_left",right:"turn_right"};
const keys={KeyW:"forward",ArrowUp:"forward",KeyS:"backward",ArrowDown:"backward",
  KeyA:"left",ArrowLeft:"left",KeyD:"right",ArrowRight:"right"};
const held=new Map();let pointerDir=null,currentDir=null,lastDir=null,lastSent=0;
let pendingMotion=null,sendingMotion=false;
async function queueMotion(path,params){pendingMotion={path,params};if(sendingMotion)return;
  sendingMotion=true;while(pendingMotion){const next=pendingMotion;pendingMotion=null;
    try{await call(next.path,next.params);setStatus("WS 已连接","ok")}catch(e){reportError(e)}}sendingMotion=false}
function selectedDir(){return pointerDir||Array.from(held.values()).at(-1)||null}
function markDirection(dir){document.querySelectorAll(".direction").forEach(button=>
  button.classList.toggle("active",button.dataset.dir===dir))}
function syncMotion(force=false){const dir=selectedDir();markDirection(dir);
  if(!dir){if(currentDir){queueMotion("/api/chassis",{action:"stop"});currentDir=null;lastDir=null}return}
  const now=performance.now();
  if(force||dir!==lastDir||now-lastSent>=150){
    queueMotion("/api/chassis",{action:directions[dir],duration_ms:400});
    lastSent=now;lastDir=dir;currentDir=dir}}
function clearControls(){pointerDir=null;held.clear();currentDir=null;lastDir=null;pendingMotion=null;markDirection(null)}
function emergencyStop(){clearControls();call("/api/chassis",{action:"emergency_stop"}).catch(reportError)}
for(const button of document.querySelectorAll(".direction")){
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointerDir=button.dataset.dir;
    button.setPointerCapture(e.pointerId);syncMotion(true)};
  button.onpointerup=button.onpointercancel=()=>{if(pointerDir===button.dataset.dir){pointerDir=null;syncMotion(true)}};
}
$("stop").onclick=emergencyStop;
$("exploreStart").onclick=async()=>{try{await call("/api/explore/start");setStatus("探索已开始","ok")}catch(e){reportError(e)}};
$("exploreStop").onclick=async()=>{try{await call("/api/explore/stop");setStatus("探索已停止","ok")}catch(e){reportError(e)}};
setInterval(()=>syncMotion(),50);

function showConfig(){
  $("rampOut").textContent=(Number($("ramp").value)/1000).toFixed(1)+" s";
  $("minOutputOut").textContent=$("minOutput").value+"%";
  $("leftScaleOut").textContent=Number($("leftScale").value).toFixed(2);
  $("rightScaleOut").textContent=Number($("rightScale").value).toFixed(2);
  $("movePowerOut").textContent=$("movePower").value+"%";
  $("rotatePowerOut").textContent=$("rotatePower").value+"%"}
function currentConfig(){return {ramp_time_ms:$("ramp").value,left_scale:$("leftScale").value,
  right_scale:$("rightScale").value,move_output:$("movePower").value,
  rotate_output:$("rotatePower").value,min_output:$("minOutput").value}}
async function loadConfig(){try{const config=await call("/api/motion-config");
  if(!configDirty){
    $("ramp").value=config.ramp_time_ms;$("minOutput").value=config.min_output;
    $("leftScale").value=config.left_scale;$("rightScale").value=config.right_scale;
    $("movePower").value=config.move_output;$("rotatePower").value=config.rotate_output;
    showConfig();setConfigStatus("已从设备加载","ok");$("retry").hidden=true}
  $("configFields").disabled=false}
  catch(e){setConfigStatus("读取配置失败，请刷新页面","bad")}}
let configDirty=false,pendingSave=false,saving=false;
async function saveConfig(){pendingSave=true;if(saving)return;saving=true;
  while(pendingSave){pendingSave=false;
    const config=currentConfig();
    setConfigStatus("保存中");$("retry").hidden=true;
    try{await call("/api/motion-config",config);
      const shown=currentConfig();
      if(!pendingSave){const same=JSON.stringify(shown)===JSON.stringify(config);
        configDirty=!same;setConfigStatus(same?"已保存到设备":"未保存",same?"ok":"")}}
    catch(e){setConfigStatus(e.message||"保存失败，请重试","bad");$("retry").hidden=false}}
  saving=false}
for(const id of ["ramp","minOutput","leftScale","rightScale","movePower","rotatePower"]){
  $(id).oninput=()=>{configDirty=true;showConfig();setConfigStatus("未保存")};
  $(id).onchange=saveConfig}
$("retry").onclick=saveConfig;

let alarmDirty=false,pendingAlarmSave=false,savingAlarm=false;
function showAlarmConfig(){$("alarmDistanceOut").textContent=$("alarmDistance").value+" cm"}
function setAlarmStatus(message,kind){const output=$("alarmStatus");output.textContent=message;output.className="status "+(kind||"")}
async function loadAlarmConfig(){try{const config=await call("/api/alarm-config");
  if(!alarmDirty){$("alarmDistance").value=config.distance_cm;showAlarmConfig();setAlarmStatus("已从设备加载","ok");$("alarmRetry").hidden=true}
  $("alarmFields").disabled=false}
  catch(e){setAlarmStatus("读取配置失败，请刷新页面","bad")}}
async function saveAlarmConfig(){pendingAlarmSave=true;if(savingAlarm)return;savingAlarm=true;
  while(pendingAlarmSave){pendingAlarmSave=false;
    const distance_cm=$("alarmDistance").value;
    setAlarmStatus("保存中");$("alarmRetry").hidden=true;
    try{await call("/api/alarm-config",{distance_cm});
      if(!pendingAlarmSave){const same=$("alarmDistance").value===distance_cm;
        alarmDirty=!same;setAlarmStatus(same?"已保存到设备":"未保存",same?"ok":"")}}
    catch(e){setAlarmStatus(e.message||"保存失败，请重试","bad");$("alarmRetry").hidden=false}}
  savingAlarm=false}
$("alarmDistance").oninput=()=>{alarmDirty=true;showAlarmConfig();setAlarmStatus("未保存")};
$("alarmDistance").onchange=saveAlarmConfig;
$("alarmRetry").onclick=saveAlarmConfig;

const fire=$("fire");fire.onclick=async()=>{try{await call("/api/launcher/fire");
  fire.classList.remove("flash");void fire.offsetWidth;fire.classList.add("flash")}catch(e){reportError(e)}};
addEventListener("keydown",e=>{if(e.target instanceof Element&&e.target.closest("input,button"))return;
  if(e.code==="Space"){e.preventDefault();if(!e.repeat)fire.click();return}
  if(keys[e.code]){e.preventDefault();if(!held.has(e.code)){held.set(e.code,keys[e.code]);syncMotion(true)}}});
addEventListener("keyup",e=>{if(keys[e.code]){held.delete(e.code);syncMotion(true)}});
addEventListener("blur",emergencyStop);
document.addEventListener("visibilitychange",()=>{if(document.hidden)emergencyStop()});
addEventListener("pagehide",emergencyStop);
async function pollDistance(connection){if(socket!==connection||connection.readyState!==WebSocket.OPEN)return;
  const output=$("distance");try{const state=await call("/api/distance");
    const valid=!state.error&&Number.isFinite(state.distance_cm);
    output.textContent=valid?state.distance_cm.toFixed(1)+" cm":
      state.error==="ESP_ERR_TIMEOUT"?"测距超时（未收到回波）":"测距失败："+(state.error||"无有效读数");
    output.style.color=valid?"":"var(--bad)"}
  catch(e){output.textContent="读取失败（连接超时或断开）";output.style.color="var(--bad)"}
  finally{if(socket===connection)setTimeout(()=>pollDistance(connection),1000)}}
const exploreLabels={idle:"已退出",checking:"测前方",forward:"前进",settling:"停车",turning:"旋转",fault:"故障停车"};
const exploreReasons={cancelled:"手动接管",stopped:"主动退出",sensor_error:"测距失败",too_close:"距离过近",no_path:"没有找到通路",time_limit:"达到两分钟上限",watchdog:"运动超时"};
async function pollExplore(connection){if(socket!==connection||connection.readyState!==WebSocket.OPEN)return;
  const output=$("exploreState");try{const state=await call("/api/explore/status");
    output.textContent=(exploreLabels[state.state]||state.state)+(exploreReasons[state.reason]?" · "+exploreReasons[state.reason]:"");
    output.style.color=state.state==="fault"?"var(--bad)":""}
  catch(e){output.textContent="状态读取失败";output.style.color="var(--bad)"}
  finally{if(socket===connection)setTimeout(()=>pollExplore(connection),1000)}}
connect();
</script></body></html>
)PAO";
