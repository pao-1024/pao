// ESP32 header names follow the vendored Espressif symbol and hardware/README.md.
const j1 = ['3V3','3V3','CHIP_PU','GPIO4','GPIO5','GPIO6','GPIO7','GPIO15','GPIO16','GPIO17','GPIO18','GPIO8','GPIO3','GPIO46','GPIO9','GPIO10','GPIO11','GPIO12','GPIO13','GPIO14','5V','GND'];
const j3 = ['GND','GPIO43','GPIO44','GPIO1','GPIO2','GPIO42','GPIO41','GPIO40','GPIO39','GPIO38','GPIO37','GPIO36','GPIO35','GPIO0','GPIO45','GPIO48','GPIO47','GPIO21','GPIO20','GPIO19','GND','GND'];
const reserved = new Set(['CHIP_PU','GPIO0','GPIO3','GPIO45','GPIO46','GPIO19','GPIO20','GPIO35','GPIO36','GPIO37','GPIO48']);
export const pinSets = {
  esp: [j1,j3].flatMap((row,side)=>row.map((name,i)=>({id:`J${side?3:1}-${i+1}`,name,side,row:i,kind:name==='GND'?'gnd':name==='3V3'?'v33':name==='5V'?'v5':'io',required:false,blocked:reserved.has(name)}))),
  oled: modulePins(['GND','VCC','SCL','SDA'],['gnd','v33','in','io']),
  mic: modulePins(['VDD','GND','L_R','WS','SCK','SD'],['v33','gnd','gnd','in','in','out']),
  speaker: modulePins(['VIN','GND','SD_MODE','GAIN','DIN','BCLK','LRC','OUT_PLUS','OUT_MINUS'],['v33','gnd','v33','gnd','in','in','in','power-out','power-out']),
  motor: modulePins(['VCC','GND','IN1','IN2','IN3','IN4','RIGHT_PLUS','RIGHT_MINUS','LEFT_PLUS','LEFT_MINUS'],['v5','gnd','in','in','in','in','power-out','power-out','power-out','power-out']),
};
function modulePins(names,kinds){return names.map((name,i)=>({id:name,name,kind:kinds[i],side:0,row:i,required:true}));}
export function endpoint(node,pin){return `${node}:${pin}`;}
export function resolvePin(nodes,key){const [id,pinId]=key.split(':');const node=nodes.find(n=>n.id===Number(id));const pin=node&&pinSets[node.type]?.find(p=>p.id===pinId);return pin?{node,pin}:null;}

export function nets(nodes,connections){
  const parent=new Map();
  const find=k=>{if(!parent.has(k))parent.set(k,k);if(parent.get(k)!==k)parent.set(k,find(parent.get(k)));return parent.get(k);};
  const join=(a,b)=>parent.set(find(a),find(b));
  // Duplicate supply pins on one DevKit are electrically the same net.
  for(const n of nodes){for(const name of ['3V3','GND']){const pins=pinSets[n.type].filter(p=>n.type==='esp'&&p.name===name);pins.slice(1).forEach(p=>join(endpoint(n.id,pins[0].id),endpoint(n.id,p.id)));}}
  for(const c of connections)if(resolvePin(nodes,c.a)&&resolvePin(nodes,c.b))join(c.a,c.b);
  const groups=new Map();for(const key of parent.keys()){const root=find(key);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(key);}
  return [...groups.values()];
}
export function connectionError(nodes,connections,a,b){
  const pa=resolvePin(nodes,a),pb=resolvePin(nodes,b);
  if(!pa||!pb)return '引脚不存在';
  if(a===b)return '不能连接同一个引脚';
  if(connections.some(c=>(c.a===a&&c.b===b)||(c.a===b&&c.b===a)))return '这两个引脚已经连接';
  if(pa.pin.blocked||pb.pin.blocked)return '该引脚在当前板型保留给启动、USB、PSRAM 或板载资源';
  const merged=nets(nodes,[...connections,{a,b}]).find(g=>g.includes(a));
  const pins=merged.map(k=>resolvePin(nodes,k).pin);
  const rails=new Set(pins.filter(p=>['gnd','v33','v5'].includes(p.kind)).map(p=>p.kind));
  if(rails.size>1)return '拒绝连接：不能短接 GND、3.3 V 和 5 V 网络';
  if(rails.size&&pins.some(p=>['io','in','out','power-out'].includes(p.kind)))return '此编辑器不允许把信号端直接接到电源网络';
  if(pins.some(p=>p.kind==='power-out'))return '功率输出需连接匹配负载；当前模块库未提供负载模型';
  if(pins.filter(p=>p.kind==='out').length>1)return '不能将多个输出端连接在同一网络';
  return '';
}
export function referenceConnections(nodes){
  const esp=nodes.find(n=>n.type==='esp');if(!esp)return [];
  const map={oled:{GND:'GND',VCC:'3V3',SDA:'GPIO41',SCL:'GPIO42'},mic:{VDD:'3V3',GND:'GND',L_R:'GND',WS:'GPIO4',SCK:'GPIO5',SD:'GPIO6'},speaker:{VIN:'3V3',GND:'GND',SD_MODE:'3V3',GAIN:'GND',DIN:'GPIO7',BCLK:'GPIO15',LRC:'GPIO16'},motor:{IN1:'GPIO11',IN2:'GPIO12',IN3:'GPIO13',IN4:'GPIO14',GND:'GND'}};
  const result=[];
  for(const n of nodes){for(const [pin,name] of Object.entries(map[n.type]||{})){const ep=pinSets.esp.find(p=>p.name===name);result.push({id:`${esp.id}-${n.id}-${pin}`,a:endpoint(esp.id,ep.id),b:endpoint(n.id,pin)});}}
  return result;
}
export function missingPins(nodes,connections){return nodes.flatMap(n=>pinSets[n.type].filter(p=>p.required&&!connections.some(c=>c.a===endpoint(n.id,p.id)||c.b===endpoint(n.id,p.id))).map(p=>endpoint(n.id,p.id)));}
export function pinLabel(nodes,key){const p=resolvePin(nodes,key);return p?`#${p.node.id} ${p.node.type.toUpperCase()} · ${p.pin.name}${p.node.type==='esp'?` (${p.pin.id})`:''}`:key;}
export function netColor(nodes,connections,key){const group=nets(nodes,connections).find(g=>g.includes(key))||[key];const kinds=group.map(k=>resolvePin(nodes,k)?.pin.kind);return kinds.includes('gnd')?'#64756c':kinds.includes('v33')?'#c5793b':kinds.includes('v5')?'#bd4d4d':'#398b88';}

// Carrier connector pads, not verified module footprints. Dimensions are in mm.
export function placement(node,index){return node.placement||{x:node.type==='esp'?12:55,y:node.type==='esp'?10:12+Math.max(0,index-1)*18};}
export function padPoint(nodes,key){const p=resolvePin(nodes,key);if(!p)return null;const pos=placement(p.node,nodes.indexOf(p.node));return {x:pos.x+(p.node.type==='esp'?p.pin.side*25.4:p.pin.row*2.54),y:pos.y+(p.node.type==='esp'?p.pin.row*2.54:0)};}
export function routePoints(nodes,connection,trace){return [padPoint(nodes,connection.a),...trace.points,padPoint(nodes,connection.b)];}
export function boardIssues(nodes,connections,traces,board){
  const issues=[];
  for(const n of nodes)for(const p of pinSets[n.type]){const pt=padPoint(nodes,endpoint(n.id,p.id));if(pt.x<1||pt.y<1||pt.x>board.width-1||pt.y>board.height-1)issues.push(`${pinLabel(nodes,endpoint(n.id,p.id))} 焊盘越界或距板边不足 1 mm`);}
  for(const t of traces){const c=connections.find(c=>c.id===t.connection);if(!c)continue;for(const p of routePoints(nodes,c,t))if(p.x<0||p.y<0||p.x>board.width||p.y>board.height)issues.push(`走线 ${t.connection} 超出板框`);}
  return [...new Set(issues)];
}
