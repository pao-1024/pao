import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionError,referenceConnections,nets,missingPins,padPoint,boardIssues,routePoints} from './circuit.mjs';
const nodes=[{id:1,type:'esp'},{id:2,type:'oled'},{id:3,type:'mic'}];
test('reference wiring uses real header pins and leaves no OLED inputs open',()=>{
  const wires=referenceConnections(nodes);
  assert.ok(wires.some(w=>w.a==='1:J3-7'&&w.b==='2:SDA'));
  assert.deepEqual(missingPins(nodes,wires),[]);
  assert.ok(nets(nodes,wires).some(g=>g.includes('2:GND')&&g.includes('3:GND')));
});
test('reject duplicate, reserved, missing and transitive rail shorts',()=>{
  const wires=[{a:'1:J1-1',b:'2:VCC'}];
  assert.match(connectionError(nodes,wires,'2:VCC','1:J1-1'),/已经/);
  assert.match(connectionError(nodes,wires,'2:VCC','1:J1-21'),/短接/);
  assert.match(connectionError(nodes,wires,'2:VCC','1:J1-22'),/短接/);
  assert.match(connectionError(nodes,[],'1:J3-13','2:SDA'),/保留/);
  assert.match(connectionError(nodes,[],'1:missing','2:SDA'),/不存在/);
  assert.equal(connectionError(nodes,[],'1:J3-7','2:SDA'),'');
});
test('board positions use mm and detect bounds after placement changes',()=>{
  const placed=[{id:1,type:'esp',placement:{x:10,y:10}}];
  assert.equal(padPoint(placed,'1:J1-2').y,12.54);
  assert.deepEqual(boardIssues(placed,[],[],{width:100,height:80}),[]);
  placed[0].placement.x=99;
  assert.ok(boardIssues(placed,[],[],{width:100,height:80}).length>0);
});
test('moving a connector updates route endpoints without changing waypoints',()=>{
  const placed=[{id:1,type:'esp',placement:{x:10,y:10}},{id:2,type:'oled',placement:{x:55,y:12}}];
  const wire={a:'1:J1-1',b:'2:VCC'},trace={points:[{x:25,y:5}]};
  const before=routePoints(placed,wire,trace);
  placed[0].placement.x=15;
  const after=routePoints(placed,wire,trace);
  assert.equal(after[0].x-before[0].x,5);
  assert.deepEqual(after.slice(1),before.slice(1));
});
test('starter carrier pads fit inside its default board',()=>{
  const starter=['esp','oled','mic','speaker','motor'].map((type,i)=>({id:i+1,type}));
  assert.deepEqual(boardIssues(starter,referenceConnections(starter),[],{width:100,height:80}),[]);
});
