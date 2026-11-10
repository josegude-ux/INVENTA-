/* Presentation-only LAB. The selector never grants authorization. */
(function(){'use strict';
const role=document.getElementById('role'),state=document.getElementById('state'),results=document.getElementById('results');
let generation=0;
function element(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
async function draw(){
 const seq=++generation;results.setAttribute('aria-busy','true');
 try{
  const view=await Promise.resolve().then(()=>VISURA_K_LAB.project(role.value,state.value));
  if(seq!==generation)return;
  const panels=[];
  const a=document.createElement('section');a.className='panel';a.append(element('h2','Tramos asignados'));
  const al=document.createElement('ul');
  view.assignments.forEach(x=>al.append(element('li',x.label+' · '+x.operator)));a.append(al);panels.push(a);
  const b=document.createElement('section');b.className='panel';b.append(element('h2','Recuentos'));
  const summary=element('p',Object.entries(view.totals).map(([k,v])=>k+': '+v).join(' · '));b.append(summary);
  const list=document.createElement('ul');view.entries.forEach(x=>list.append(element('li',x.location+' · '+x.state)));
  if(!view.entries.length)list.append(element('li','Sin resultados para este filtro'));b.append(list);panels.push(b);
  results.replaceChildren(...panels);
 }catch(err){if(seq===generation)results.replaceChildren(element('p','Vista no disponible'));}
 finally{if(seq===generation)results.setAttribute('aria-busy','false');}
}
role.addEventListener('change',draw);state.addEventListener('change',draw);
document.getElementById('reset').addEventListener('click',()=>{role.value='supervisor';state.value='all';draw();});
draw();
})();