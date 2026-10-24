#pragma once

// 板载控制页，由 GET / 返回。摇杆按住期间每 150 ms 续发一次 400 ms 的运动指令，
// 松手、切页或断网后指令自然到期停车，不依赖页面发出停止请求。
// 开炮键按住充能、松手发射；充能有 15 s 上限，页面失联时固件到期自动断电且不发射。
inline constexpr char kControlPage[] = R"PAO(<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>PAO 遥控</title>
<style>
:root{color-scheme:dark;--bg:#0a0d12;--panel:#10151c;--line:#222c38;--text:#d8e2ec;--muted:#7c8a99;--accent:#4cc2ff;--warn:#ffa63d;--bad:#ff6b6b}
*{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
html,body{overscroll-behavior:none}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif}
main{max-width:760px;margin:0 auto;padding:16px;display:grid;gap:12px;grid-template-columns:1fr 1fr}
header,p.hint{grid-column:1/-1}
h1{margin:0;font-size:20px}header{display:flex;justify-content:space-between;align-items:center}
.status{font-size:12px;color:var(--muted)}.status.ok{color:#4fd18b}.status.bad{color:var(--bad)}
section{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:12px}
h2{margin:0;align-self:flex-start;font-size:13px;color:var(--muted);font-weight:600}
.stick{position:relative;width:220px;height:220px;border-radius:50%;touch-action:none;cursor:grab;
  background:radial-gradient(circle,#18212c 0 34%,#121921 35% 100%);border:1px solid var(--line);box-shadow:inset 0 0 30px #0006}
.stick::before,.stick::after{content:"";position:absolute;background:#1f2a36;left:50%;top:12px;bottom:12px;width:1px}
.stick::after{top:50%;left:12px;right:12px;bottom:auto;width:auto;height:1px}
.knob{position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px;border-radius:50%;z-index:1;
  background:radial-gradient(circle at 35% 30%,#3a4b5f,#1b2430);border:1px solid #3b4d61;box-shadow:0 6px 16px #0008;transition:transform .15s}
.stick.active{cursor:grabbing}.stick.active .knob{transition:none;border-color:var(--accent);box-shadow:0 0 18px #4cc2ff55,0 6px 16px #0008}
.readout{display:flex;gap:16px;font:13px ui-monospace,monospace;color:var(--muted)}.readout b{color:var(--text);font-weight:600}
.gauge{width:100%;height:6px;border-radius:3px;background:#1c2530;overflow:hidden}.gauge div{height:100%;width:0;background:var(--accent)}
label{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;color:var(--muted)}
input[type=range]{flex:1;accent-color:var(--accent)}output{font-family:ui-monospace,monospace;color:var(--text);min-width:48px;text-align:right}
button{font:inherit;color:var(--text);background:#161d26;border:1px solid var(--line);border-radius:12px;cursor:pointer;touch-action:none}
.fire{position:relative;overflow:hidden;width:180px;height:180px;border-radius:50%;font-size:20px;font-weight:700;letter-spacing:.1em;
  background:#2b1e0e;border:2px solid #7a5420;box-shadow:0 6px 18px #0008}
.fire span{position:relative;z-index:1}.fire small{display:block;font-size:12px;font-weight:400;color:var(--muted);letter-spacing:0}
.fire .fill{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,#b8733388,#ffa63dcc)}
.fire.charging{border-color:var(--warn);box-shadow:0 0 24px #ffa63d66}
.fire.flash{animation:flash .35s}@keyframes flash{from{background:#ffd9a0}to{background:#2b1e0e}}
.disarm{padding:8px 18px;background:#3a1820;border-color:#6b2a35;font-size:13px}
p.hint{margin:0;font-size:12px;color:var(--muted)}
@media (max-width:600px){main{grid-template-columns:1fr}}
</style></head><body><main>
<header><h1>PAO 遥控</h1><span id="status" class="status">连接中</span></header>
<section><h2>底盘</h2>
<div class="stick" id="stick"><div class="knob" id="knob"></div></div>
<div class="readout"><span>速度 <b id="fwdOut">0</b></span><span>转向 <b id="turnOut">0</b></span></div>
<div class="gauge"><div id="gauge"></div></div>
<label>最高速度<input id="max" type="range" min="20" max="100" value="80"><output id="maxOut">80%</output></label>
<label>加速时间<input id="ramp" type="range" min="0" max="3000" step="100" value="1000"><output id="rampOut">1.0 s</output></label>
</section>
<section><h2>电磁炮</h2>
<button class="fire" id="fire"><div class="fill" id="fill"></div><span>开炮<small id="fireHint">按住充能 · 松手发射</small></span></button>
<button class="disarm" id="disarm">断电</button>
</section>
<p class="hint">摇杆往前推前进、左右推转向，越久越快；松手立即停车。键盘：WASD / 方向键驾驶，按住空格充能、松开开炮。</p>
</main><script>
const $=id=>document.getElementById(id),statusEl=$("status");
function setStatus(text,cls){statusEl.textContent=text;statusEl.className="status "+(cls||"")}
async function call(path,params){
  const query=new URLSearchParams(params||{}).toString();
  try{const r=await fetch(path+(query?"?"+query:""),{method:"POST"});const t=await r.text();
    if(!r.ok){setStatus(t||("错误 "+r.status),"bad");return null}setStatus("已连接","ok");return t}
  catch(e){setStatus("连接断开","bad");return null}}
for(const [input,fmt] of [["max",v=>v+"%"],["ramp",v=>(v/1000).toFixed(1)+" s"]]){
  const el=$(input),update=()=>$(input+"Out").textContent=fmt(el.value);el.oninput=update;update()}

// 摇杆给出目标值，实际输出按“加速时间”逐渐逼近目标；回中或反向时快速减速，松手直接停车。
const stick=$("stick"),knob=$("knob"),R=68;
let target={f:0,t:0},out={f:0,t:0},active=false,last=performance.now(),lastSend=0,stopped=true;
function setKnob(x,y){knob.style.transform=`translate(${x*R}px,${y*R}px)`}
function fromPointer(e){const r=stick.getBoundingClientRect();
  let x=(e.clientX-r.left-r.width/2)/R,y=(e.clientY-r.top-r.height/2)/R;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m}
  setKnob(x,y);
  // 中心 8% 死区，外圈平方曲线，小推杆量更容易微调。
  const shape=v=>Math.abs(v)<.08?0:Math.sign(v)*((Math.abs(v)-.08)/.92)**2;
  target={f:shape(-y),t:shape(-x)}}
stick.onpointerdown=e=>{active=true;stick.classList.add("active");fromPointer(e);stick.setPointerCapture(e.pointerId)};
stick.onpointermove=e=>{if(active)fromPointer(e)};
stick.onpointerup=stick.onpointercancel=()=>{active=false;stick.classList.remove("active");setKnob(0,0);release()};
function release(){target={f:0,t:0};out={f:0,t:0};if(!stopped){stopped=true;call("/api/stop")}}
function approach(cur,goal,dt){
  const rampS=$("ramp").value/1000;
  if(Math.sign(goal)!==Math.sign(cur)||Math.abs(goal)<Math.abs(cur)){const step=dt*4;return Math.abs(goal-cur)<=step?goal:cur+Math.sign(goal-cur)*step}
  if(rampS===0)return goal;const step=dt/rampS;return Math.abs(goal-cur)<=step?goal:cur+Math.sign(goal-cur)*step}
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.1,(now-last)/1000);last=now;
  // 转向上限为最高速度的一半，转弯更柔和。
  out={f:approach(out.f,target.f,dt),t:approach(out.t,target.t*.5,dt*1.5)};
  const max=$("max").value,f=Math.round(out.f*max),t=Math.round(out.t*max);
  $("fwdOut").textContent=f;$("turnOut").textContent=t;$("gauge").style.width=Math.min(100,Math.hypot(f,t))+"%";
  if((f||t)&&now-lastSend>150){lastSend=now;stopped=false;call("/api/drive",{forward:f,turn:t,duration_ms:400})}}
requestAnimationFrame(loop);

const keys={KeyW:[1,0],ArrowUp:[1,0],KeyS:[-1,0],ArrowDown:[-1,0],KeyA:[0,1],ArrowLeft:[0,1],KeyD:[0,-1],ArrowRight:[0,-1]},down=new Set();
function fromKeys(){if(active)return;let f=0,t=0;for(const k of down){f+=keys[k][0];t+=keys[k][1]}
  f=Math.sign(f);t=Math.sign(t);setKnob(-t*.7,-f*.7);f||t?target={f,t}:(setKnob(0,0),release())}

// 开炮键：按下开始充能（15 s 上限），松手先断电再立即发射。
const fire=$("fire"),fill=$("fill"),hint=$("fireHint"),MAX_CHARGE=15000;let chargeAt=0;
async function startCharge(){if(chargeAt)return;chargeAt=performance.now();fire.classList.add("charging");
  await call("/api/launcher/charge",{duration_ms:MAX_CHARGE})}
async function releaseFire(){if(!chargeAt)return;const held=performance.now()-chargeAt;chargeAt=0;fire.classList.remove("charging");
  fill.style.height="0";hint.textContent="按住充能 · 松手发射";
  await call("/api/launcher/stop");
  if(held>=MAX_CHARGE){setStatus("充能超时已断电，未发射","bad");return}
  if(await call("/api/launcher/fire",{charge_ms:0})!==null){fire.classList.remove("flash");void fire.offsetWidth;fire.classList.add("flash")}}
(function chargeLoop(){requestAnimationFrame(chargeLoop);if(!chargeAt)return;const held=performance.now()-chargeAt;
  fill.style.height=Math.min(100,held/MAX_CHARGE*100)+"%";hint.textContent=(held/1000).toFixed(1)+" s"})();
fire.onpointerdown=e=>{startCharge();fire.setPointerCapture(e.pointerId)};
fire.onpointerup=fire.onpointercancel=releaseFire;
$("disarm").onclick=()=>{chargeAt=0;fire.classList.remove("charging");fill.style.height="0";hint.textContent="按住充能 · 松手发射";call("/api/launcher/stop")};

addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();if(!e.repeat)startCharge();return}
  if(keys[e.code]){e.preventDefault();down.add(e.code);fromKeys()}});
addEventListener("keyup",e=>{if(e.code==="Space"){releaseFire();return}if(keys[e.code]){down.delete(e.code);fromKeys()}});
addEventListener("blur",()=>{down.clear();if(!active){setKnob(0,0);release()}});

async function poll(){try{await(await fetch("/api/status")).json();setStatus("已连接","ok")}catch(e){setStatus("连接断开","bad")}}
setInterval(poll,1000);poll();
</script></body></html>
)PAO";
