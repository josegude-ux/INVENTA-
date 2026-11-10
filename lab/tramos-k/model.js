/* VISURA INVENTA LAB: immutable sample data; no production API or write path. */
(function(root){'use strict';
const assignments=Object.freeze([
 Object.freeze({id:'k-a',operator:'op-a',label:'K01–K03',locations:['K01','K02','K03']}),
 Object.freeze({id:'k-b',operator:'op-b',label:'K04–K06',locations:['K04','K05','K06']})
]);
const entries=Object.freeze([
 Object.freeze({id:'a-1',operator:'op-a',location:'K01-01',state:'confirmed'}),
 Object.freeze({id:'a-2',operator:'op-a',location:'K02-01',state:'uncertain'}),
 Object.freeze({id:'a-3',operator:'op-a',location:'K03-01',state:'conflict'}),
 Object.freeze({id:'b-1',operator:'op-b',location:'K04-01',state:'pending'}),
 Object.freeze({id:'b-2',operator:'op-b',location:'K05-01',state:'blocked'})
]);
const states=['pending','uncertain','confirmed','blocked','conflict'];
function project(role,filter){
 if(!['supervisor','op-a','op-b'].includes(role))throw Error('INVALID_DEMO_ROLE');
 if(filter!=='all'&&!states.includes(filter))throw Error('INVALID_FILTER');
 const visibleAssignments=assignments.filter(a=>role==='supervisor'||a.operator===role);
 const scope=entries.filter(e=>role==='supervisor'||e.operator===role);
 const totals=Object.fromEntries(states.map(s=>[s,scope.filter(e=>e.state===s).length]));
 return Object.freeze({assignments:visibleAssignments,entries:scope.filter(e=>filter==='all'||e.state===filter),totals});
}
root.VISURA_K_LAB=Object.freeze({project,states:Object.freeze(states)});
})(globalThis);