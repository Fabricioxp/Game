
'use strict';

/* ============================================================
   O HOSPITAL — EDITOR MOBILE
   Formato de projeto simples, extensível e independente.
   ============================================================ */

const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d');
let DPR=1, view={x:0,y:0,zoom:1}, gridOn=true, activeTab='assets';
let selectedId=null, dragging=null, dragOffset={x:0,y:0}, pointerId=null;
let undoStack=[],redoStack=[];

const ASSETS=[
 {cat:'AMBIENTE',items:[
  ['wall','🧱','Parede','Estrutura sólida'],
  ['door','🚪','Porta','Porta interativa'],
  ['window','🪟','Janela','Janela decorativa'],
  ['floor','⬛','Piso','Piso hospitalar']
 ]},
 {cat:'MÓVEIS',items:[
  ['bed','🛏️','Cama','Cama hospitalar'],
  ['stretcher','🛌','Maca','Maca hospitalar'],
  ['desk','🗃️','Mesa/Balcão','Mesa de recepção'],
  ['chair','🪑','Cadeira','Assento'],
  ['locker','🗄️','Armário','Armário com colisão'],
  ['shelf','📚','Estante','Estante de suprimentos'],
  ['crate','📦','Caixa','Caixa/entulho'],
  ['generator','⚡','Gerador','Gerador de energia']
 ]},
 {cat:'DECORAÇÃO',items:[
  ['lamp','💡','Lâmpada','Fonte de luz'],
  ['blood','🩸','Sangue','Mancha ambiental'],
  ['corpse','☠️','Cadáver','Corpo de cenário'],
  ['spore','🍄','Esporos','Colônia/fungo'],
  ['trash','🗑️','Lixo','Decoração'],
  ['paper','📄','Papel','Documento/nota']
 ]},
 {cat:'GAMEPLAY',items:[
  ['player','🧍','Jogador','Ponto inicial'],
  ['enemy','🧟','Infectado','Inimigo configurável'],
  ['item','🔑','Item','Chave/cartão/item'],
  ['weapon','🔪','Arma','Faca/arma'],
  ['safe','🔐','Cofre','Puzzle de código'],
  ['trigger','⚙️','Evento','Área/evento automático']
 ]}
];

function customAssetDefs(){return (typeof project!=='undefined' && project && Array.isArray(project.extensions?.assets))?project.extensions.assets:[]}
function allAssetMeta(){return [...ASSETS.flatMap(c=>c.items.map(a=>({id:a[0],icon:a[1],name:a[2],desc:a[3],custom:false}))),...customAssetDefs().map(a=>({id:a.type,icon:a.icon||'🧩',name:a.name||a.type,desc:a.desc||'Recurso personalizado',custom:true}))]}
function assetMeta(type){return allAssetMeta().find(a=>a.id===type)}

const templates={
 wall:{w:1,h:1,solid:true},
 door:{w:1,h:.35,solid:true,open:false,locked:false,requires:''},
 window:{w:1,h:.15,solid:true},
 floor:{w:1,h:1,solid:false},
 bed:{w:2,h:1,solid:true,interactive:true,message:'Uma cama hospitalar abandonada.'},
 stretcher:{w:2,h:.8,solid:true,interactive:true,message:'Uma maca vazia.'},
 desk:{w:2,h:1,solid:true,interactive:false},
 chair:{w:.7,h:.7,solid:true},
 locker:{w:1,h:.6,solid:true,interactive:true,hideSpot:true,message:'Um armário antigo.'},
 shelf:{w:1.8,h:.5,solid:true},
 crate:{w:1,h:1,solid:true},
 generator:{w:1.4,h:1.1,solid:true,interactive:true},
 lamp:{w:.4,h:.4,solid:false,light:true,radius:4,intensity:.8},
 blood:{w:1,h:.7,solid:false},
 corpse:{w:1.5,h:.7,solid:false},
 spore:{w:1,h:1,solid:false},
 trash:{w:.7,h:.7,solid:true},
 paper:{w:.5,h:.5,solid:false,interactive:true,message:'Há algo escrito neste papel.'},
 player:{w:.6,h:.8,solid:true},
 enemy:{w:.7,h:.8,solid:true,ai:'patrol',speed:1.8,vision:6,hearing:7,damage:15},
 item:{w:.5,h:.5,solid:false,interactive:true,itemId:'chave',message:'Você encontrou um item.'},
 weapon:{w:.5,h:.5,solid:false,interactive:true,itemId:'faca',message:'Você encontrou uma arma.'},
 safe:{w:1,h:.7,solid:true,interactive:true,code:'1409',message:'Um cofre trancado.'},
 trigger:{w:2,h:2,solid:false,eventType:'enter'}
};

function uid(){return 'o_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function defaultProject(){
 return {
  version:1,name:'O HOSPITAL — Capítulo 1',map:{width:37,height:27,tile:48},
  settings:{grid:true,background:'#111713'},
  globalCode:`// Código global opcional\\n// Exemplo:\\n// if (game.power) game.openDoor('porta_uti');`,
  objects:[
   obj('floor',8,9,{w:21,h:5,solid:false,name:'Recepção / Arquivo'}),
   obj('floor',13,1,{w:11,h:7,solid:false,name:'Ala de Emergência'}),
   obj('floor',4,9,{w:4,h:9,solid:false,name:'Enfermaria'}),
   obj('floor',29,9,{w:5,h:9,solid:false,name:'Farmácia'}),
   obj('floor',13,14,{w:11,h:5,solid:false,name:'UTI'}),
   obj('floor',13,20,{w:11,h:5,solid:false,name:'Manutenção'}),
   obj('desk',18,10,{w:3,h:1,name:'Balcão da Recepção'}),
   obj('bed',6,11,{name:'Leito 01'}),obj('bed',6,14,{name:'Leito 02'}),obj('bed',6,17,{name:'Leito 03'}),
   obj('shelf',30,11,{name:'Prateleira A'}),obj('shelf',32,11,{name:'Prateleira B'}),
   obj('generator',22,22,{name:'Gerador Principal',interactive:true,message:'O painel do gerador pede uma sequência.'}),
   obj('safe',27,11,{name:'Cofre de Emergência',code:'1409'}),
   obj('door',18.5,8,{name:'Porta Corta-Fogo',locked:true,requires:'energia'}),
   obj('door',8,11,{name:'Porta da Enfermaria'}),
   obj('door',29,11,{name:'Porta da Farmácia',locked:true,requires:'chave_farmacia'}),
   obj('door',18,14,{name:'Porta da UTI'}),
   obj('door',18,19,{name:'Porta da Manutenção'}),
   obj('player',19,12,{name:'Jogador'}),
   obj('enemy',24,12,{name:'Infectado — Patrulha',ai:'patrol'}),
   obj('enemy',10,12,{name:'Infectado — Cego',ai:'hearing',vision:0,hearing:9}),
   obj('paper',15,4,{name:'Prontuário 237',message:'Registro 237 — algo deu errado durante a evacuação.'}),
   obj('item',31,14,{name:'Chave da Farmácia',itemId:'chave_farmacia',message:'Você pegou a chave da farmácia.'}),
   obj('weapon',6,15,{name:'Faca',itemId:'faca',message:'Uma faca útil para defesa silenciosa.'})
  ]
 };
}
function obj(type,x,y,extra={}){
 const ca=customAssetDefs().find(a=>a.type===type);let o={id:uid(),type,x,y,...clone(templates[type]||{}),...(ca?{w:ca.w,h:ca.h,solid:!!ca.solid,interactive:!!ca.interactive,light:!!ca.light,color:ca.color,custom:true}:{ }),...extra};
 o.name=o.name||assetMeta(type)?.name||type;
 return o;
}
let project=defaultProject();
const EDITOR_VERSION='3.1.0';
const RESERVED_TYPES=new Set(['constructor','prototype','__proto__','object','function','script','eval']);
function ensureExtensions(p){p.extensions=p.extensions||{};p.extensions.assets=Array.isArray(p.extensions.assets)?p.extensions.assets:[];p.extensions.functions=Array.isArray(p.extensions.functions)?p.extensions.functions:[]}
function safeId(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9_áéíóúãõç-]/gi,'_').replace(/-+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)}
function allObjectTypes(){ensureExtensions(project);return new Set([...Object.keys(templates),...project.extensions.assets.map(a=>a.type)])}
function validateCodeSyntax(code,args=['game','args']){const src=String(code||'');if(src.length>20000)return 'Código excede 20.000 caracteres';if(/while\s*\(\s*true\s*\)|for\s*\(\s*;;\s*\)/i.test(src))return 'Laço potencialmente infinito bloqueado';try{new Function(...args,src);return null}catch(e){return e.message||'Erro de sintaxe'}}
function normalizeProject(p){ensureProject(p);ensureExtensions(p);const used=new Set(),issues=[];for(const o of p.objects){if(!o||typeof o!=='object')continue;let id=safeId(o.id)||uid();while(used.has(id))id=uid();if(id!==o.id)issues.push('ID corrigido: '+(o.name||o.type||'objeto'));o.id=id;used.add(id);o.x=Number.isFinite(Number(o.x))?Number(o.x):1;o.y=Number.isFinite(Number(o.y))?Number(o.y):1;o.w=Math.max(.1,Number.isFinite(Number(o.w))?Number(o.w):1);o.h=Math.max(.1,Number.isFinite(Number(o.h))?Number(o.h):1);o.x=Math.max(o.w/2,Math.min(p.map.width-o.w/2,o.x));o.y=Math.max(o.h/2,Math.min(p.map.height-o.h/2,o.y));if(!allTypesFor(p).has(o.type))issues.push('Tipo desconhecido: '+o.type)}p.extensions.assets=p.extensions.assets.filter(a=>a&&safeId(a.type)&&!RESERVED_TYPES.has(safeId(a.type)));const seenA=new Set();p.extensions.assets=p.extensions.assets.filter(a=>{a.type=safeId(a.type);if(!a.type||seenA.has(a.type)||Object.keys(templates).includes(a.type))return false;seenA.add(a.type);a.w=Math.max(.1,Number(a.w)||1);a.h=Math.max(.1,Number(a.h)||1);return true});p.extensions.functions=p.extensions.functions.filter(f=>f&&safeId(f.id));return issues}
function allTypesFor(p){return new Set([...Object.keys(templates),...(p.extensions?.assets||[]).map(a=>a.type)])}
function validateProjectDetailed(p=project){const issues=[];ensureProject(p);ensureExtensions(p);if(validateCodeSyntax(p.globalCode,['game']))issues.push('Código global inválido');const ids=new Set();for(const o of p.objects){if(!o||typeof o!=='object')issues.push('Objeto inválido');else{if(ids.has(o.id))issues.push('ID duplicado: '+o.id);ids.add(o.id);if(!Number.isFinite(Number(o.x))||!Number.isFinite(Number(o.y)))issues.push('Posição inválida: '+(o.name||o.type));if(Number(o.w)<=0||Number(o.h)<=0)issues.push('Dimensão inválida: '+(o.name||o.type));if(!allTypesFor(p).has(o.type))issues.push('Tipo não registrado: '+o.type);if(validateCodeSyntax(o.code))issues.push('Código inválido no objeto: '+(o.name||o.type))}}for(const a of p.extensions.assets){if(RESERVED_TYPES.has(a.type)||!/^[a-z][a-z0-9_]*$/i.test(a.type))issues.push('ID de recurso inválido: '+a.type);if(validateCodeSyntax(a.code))issues.push('Código inválido no recurso: '+a.name)}for(const f of p.extensions.functions){if(!/^[a-z][a-z0-9_]*$/i.test(f.id)||RESERVED_TYPES.has(f.id))issues.push('ID de função inválido: '+f.id);if(validateCodeSyntax(f.code,['game','args']))issues.push('Código inválido na função: '+f.id)}return issues}

function ensureProject(p){
 if(!p||typeof p!=='object'||!Array.isArray(p.objects)||!p.map)throw new Error('Projeto inválido');
 p.version=Number(p.version||1);p.name=p.name||'Novo Hospital';
 p.meta=p.meta||{};p.meta.name=p.meta.name||p.name;p.meta.version=p.meta.version||'1.0.0';p.meta.description=p.meta.description||'';p.meta.cover=p.meta.cover||'';p.meta.editorVersion=EDITOR_VERSION;
 p.settings=p.settings||{grid:true,background:'#111713'};ensureExtensions(p);return p;
}
ensureProject(project);project.extensions=project.extensions||{assets:[],functions:[]};normalizeProject(project);
function projectFileName(suffix){return (project.meta?.name||project.name||'hospital').replace(/[^a-z0-9áéíóúãõç _-]/gi,'_').trim().replace(/\s+/g,'_')+suffix}
function downloadBlob(text,name,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function projectPayload(){ensureProject(project);return JSON.stringify(project,null,2)}
function saveProjectFile(){const issues=validateProjectDetailed(project);if(issues.length){toast('Corrija os problemas em CRIAR / EXTENSÕES → VERIFICAR antes de baixar.');return}normalizeProject(project);downloadBlob(projectPayload(),projectFileName('.ohospital.json'),'application/json');toast('Projeto editável baixado. Guarde esse arquivo.');}
function updateProjectUI(){const m=project.meta||{};$('projectBadge').textContent=(m.name||project.name)+' · v'+(m.version||'1.0.0');$('status').textContent='Projeto: '+(m.name||project.name)+' · v'+(m.version||'1.0.0');$('projectBadge').style.display='block'}
function openProjectModal(){const m=project.meta||{};$('metaName').value=m.name||project.name;$('metaVersion').value=m.version||'1.0.0';$('metaDescription').value=m.description||'';$('coverPreview').src=m.cover||'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#18211d"/><text x="60" y="65" text-anchor="middle" font-size="48">🏥</text></svg>');$('autoSave').checked=localStorage.getItem('hospital_editor_autosave')==='1';$('projectModal').classList.add('open')}
function applyProjectMeta(){pushHistory();project.meta=project.meta||{};project.meta.name=$('metaName').value.trim()||'Novo Hospital';project.meta.version=$('metaVersion').value.trim()||'1.0.0';project.meta.description=$('metaDescription').value.trim();project.meta.editorVersion=EDITOR_VERSION;project.name=project.meta.name;localStorage.setItem('hospital_editor_autosave',$('autoSave').checked?'1':'0');if($('autoSave').checked)localStorage.setItem('hospital_editor_draft',projectPayload());else localStorage.removeItem('hospital_editor_draft');updateProjectUI();toast('Configurações salvas.');}
function autosave(){if(localStorage.getItem('hospital_editor_autosave')==='1')try{localStorage.setItem('hospital_editor_draft',projectPayload())}catch(e){toast('Não foi possível salvar o rascunho local. Use BAIXAR.')}}
function validateImportedProject(p){ensureProject(p);if(p.objects.length>5000)throw new Error('Projeto grande demais');const issues=normalizeProject(p);const hard=validateProjectDetailed(p);if(hard.length)throw new Error(hard.slice(0,4).join(' | '));return p}

function pushHistory(){
 undoStack.push(clone(project)); if(undoStack.length>40)undoStack.shift(); redoStack=[];
}
function restore(p){project=p;selectedId=null;renderAssets();renderProps();draw()}
function undo(){if(!undoStack.length)return toast('Nada para desfazer.');redoStack.push(clone(project));restore(undoStack.pop())}
function redo(){if(!redoStack.length)return toast('Nada para refazer.');undoStack.push(clone(project));restore(redoStack.pop())}

function resize(){
 const r=canvas.getBoundingClientRect();DPR=Math.min(devicePixelRatio||1,2);
 canvas.width=r.width*DPR;canvas.height=r.height*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);draw()
}
addEventListener('resize',resize);addEventListener('orientationchange',()=>setTimeout(()=>{resize();fitMap();},120));resize();

function worldFromScreen(sx,sy){
 return {x:(sx-view.x)/view.zoom/project.map.tile,y:(sy-view.y)/view.zoom/project.map.tile}
}
function screenFromWorld(x,y){
 return {x:view.x+x*project.map.tile*view.zoom,y:view.y+y*project.map.tile*view.zoom}
}
function fitMap(){
 const w=canvas.clientWidth,h=canvas.clientHeight,tw=project.map.width*project.map.tile,th=project.map.height*project.map.tile;
 view.zoom=Math.min(w/tw,h/th)*.9;view.x=(w-tw*view.zoom)/2;view.y=(h-th*view.zoom)/2;draw()
}
function objectAt(wx,wy){
 let found=null;
 for(let i=project.objects.length-1;i>=0;i--){
  const o=project.objects[i];
  if(wx>=o.x-o.w/2&&wx<=o.x+o.w/2&&wy>=o.y-o.h/2&&wy<=o.y+o.h/2){found=o;break}
 }
 return found;
}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);
 ctx.fillStyle=project.settings.background||'#111713';ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.zoom,view.zoom);
 const t=project.map.tile;
 ctx.fillStyle='#151d18';ctx.fillRect(0,0,project.map.width*t,project.map.height*t);
 if(gridOn){
  ctx.strokeStyle='#26312b';ctx.lineWidth=1;
  for(let x=0;x<=project.map.width;x++){ctx.beginPath();ctx.moveTo(x*t,0);ctx.lineTo(x*t,project.map.height*t);ctx.stroke()}
  for(let y=0;y<=project.map.height;y++){ctx.beginPath();ctx.moveTo(0,y*t);ctx.lineTo(project.map.width*t,y*t);ctx.stroke()}
 }
 const sorted=[...project.objects].sort((a,b)=>(a.y+a.h)-(b.y+b.h));
 for(const o of sorted)drawObj(o,t);
 ctx.restore();
}
function drawObj(o,t){
 const x=o.x*t,y=o.y*t,w=o.w*t,h=o.h*t;
 const selected=o.id===selectedId;
 if(o.type==='floor'){ctx.fillStyle=o.name?.includes('UTI')?'#18221e':'#1b2420';ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeStyle='#39453f';ctx.strokeRect(x-w/2,y-h/2,w,h);return}
 const colors={wall:'#68746d',door:o.open?'#718b78':'#493f39',bed:'#70847a',stretcher:'#84918a',desk:'#5d665e',chair:'#606b64',locker:'#56635c',shelf:'#53665b',crate:'#665c4f',generator:'#60685f',lamp:'#d5c58b',blood:'#632f31',corpse:'#3e4742',spore:'#6d7d4b',trash:'#4d5751',paper:'#c7c0a6',player:'#9db7aa',enemy:'#8f5c5c',item:'#d2bf65',weapon:'#b5b5ad',safe:'#5b6260',trigger:'#536e86'};
 let c=colors[o.type]||o.color||customAssetDefs().find(a=>a.type===o.type)?.color||'#748078';
 if(o.type==='blood'||o.type==='spore'){ctx.globalAlpha=.65}
 ctx.fillStyle=c;ctx.fillRect(x-w/2,y-h/2,w,h);ctx.globalAlpha=1;
 ctx.strokeStyle=selected?'#f2d48c':'#222a26';ctx.lineWidth=selected?3:1;ctx.strokeRect(x-w/2,y-h/2,w,h);
 const icons={wall:'',door:o.open?'↔':'🚪',bed:'🛏',stretcher:'▱',desk:'▤',chair:'•',locker:'▥',shelf:'▤',crate:'□',generator:'⚡',lamp:'●',blood:'',corpse:'☠',spore:'•',trash:'×',paper:'▤',player:'●',enemy:'☠',item:'◆',weapon:'⌁',safe:'▣',trigger:'⚙',window:'□'};
 const icon=icons[o.type];if(icon){ctx.font=Math.max(10,t*.32)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e7eee9';ctx.fillText(icon,x,y)}
 if(selected){ctx.setLineDash([5,4]);ctx.strokeStyle='#c7d9cc';ctx.strokeRect(x-w/2-4,y-h/2-4,w+8,h+8);ctx.setLineDash([])}
}

function renderAssets(){
 const q=$('search').value.toLowerCase();
 if(activeTab==='layers'){
  $('leftContent').innerHTML=project.objects.map((o,i)=>`<button class="asset" data-id="${o.id}"><span class="ico">${iconFor(o.type)}</span><span>${escapeHtml(o.name||o.type)}<small>${o.type} · ${Math.round(o.x)},${Math.round(o.y)}</small></span></button>`).join('')||'<div class="empty">Nenhum objeto no mapa.</div>';
  $('leftContent').querySelectorAll('.asset').forEach(b=>b.onclick=()=>select(b.dataset.id));
  return;
 }
 let out='';
 for(const c of ASSETS){const items=c.items.filter(a=>(a[1]+' '+a[2]+' '+a[3]).toLowerCase().includes(q));if(!items.length)continue;out+=`<div class="sectionTitle">${c.cat}</div>`;for(const a of items)out+=`<button class="asset" data-type="${a[0]}"><span class="ico">${a[1]}</span><span><b>${a[2]}</b><small>${a[3]}</small></span></button>`;}
 const custom=customAssetDefs().filter(a=>(a.icon+' '+a.name+' '+a.desc+' '+a.type).toLowerCase().includes(q));if(custom.length){out+=`<div class="sectionTitle">MEUS RECURSOS</div>`;for(const a of custom)out+=`<button class="asset" data-type="${escapeHtml(a.type)}"><span class="ico">${escapeHtml(a.icon||'🧩')}</span><span><b>${escapeHtml(a.name||a.type)}</b><small>${escapeHtml(a.desc||'Recurso personalizado')}</small></span></button>`;}
 $('leftContent').innerHTML=out||'<div class="empty">Nenhum recurso encontrado.</div>';
 $('leftContent').querySelectorAll('.asset').forEach(b=>b.onclick=()=>place(b.dataset.type));
}
function iconFor(type){return assetMeta(type)?.icon||'◻'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function select(id){selectedId=id;renderProps();draw()}
function selected(){return project.objects.find(o=>o.id===selectedId)}
function place(type){
 pushHistory();
 const center=worldFromScreen(canvas.clientWidth/2,canvas.clientHeight/2);
 const ca=customAssetDefs().find(a=>a.type===type);if(ca?.unique&&project.objects.some(x=>x.type===type))return toast('Este recurso foi definido como único e já está no mapa.');const o=obj(type,Math.round(center.x),Math.round(center.y));
 project.objects.push(o);selectedId=o.id;renderAssets();renderProps();draw();autosave();toast('Recurso colocado. Arraste-o para posicionar.')
}
function deleteSelected(){
 const o=selected();if(!o)return toast('Selecione um objeto primeiro.');
 pushHistory();project.objects=project.objects.filter(x=>x.id!==o.id);selectedId=null;renderProps();renderAssets();draw();autosave();toast('Objeto removido.')
}
function updateProp(key,value){
 const o=selected();if(!o)return;
 if(['x','y','w','h','speed','vision','hearing','damage','radius','intensity'].includes(key)){const n=Number(value);if(!Number.isFinite(n))return toast('Valor numérico inválido.');value=n}
 if(['solid','interactive','open','locked','hideSpot','light','unique'].includes(key))value=!!value;
 if(['w','h'].includes(key)&&value<=0)return toast('A dimensão precisa ser maior que zero.');
 if(key==='code'){const err=validateCodeSyntax(String(value));if(err)return toast('Código inválido: '+err);}
 if(key==='safeCode'){o.safeCode=String(value);o.code=o.code||'';}else o[key]=value;
 normalizeProject(project);draw();renderAssets();autosave()
}

function renderProps(){
 const o=selected();
 if(!o){$('rightContent').innerHTML='<div class="empty">Selecione um objeto no mapa ou na aba CAMADAS.<br><br>Depois você poderá alterar posição, tamanho, colisão, interação, comportamento e código.</div>';return}
 let html=`<div class="prop"><label>NOME</label><input data-p="name" value="${escapeHtml(o.name)}"></div>
 <div class="prop row"><div><label>X</label><input data-p="x" type="number" step=".1" value="${o.x}"></div><div><label>Y</label><input data-p="y" type="number" step=".1" value="${o.y}"></div></div>
 <div class="prop row"><div><label>LARGURA</label><input data-p="w" type="number" step=".1" value="${o.w}"></div><div><label>ALTURA</label><input data-p="h" type="number" step=".1" value="${o.h}"></div></div>`;
 if(o.type!=='floor'&&o.type!=='blood'&&o.type!=='corpse'&&o.type!=='spore'&&o.type!=='trigger')html+=`<div class="prop"><label>COLISÃO</label><div class="check"><input data-p="solid" type="checkbox" ${o.solid?'checked':''}> Impede passagem</div></div>`;
 if(['door','bed','stretcher','locker','generator','paper','item','weapon','safe'].includes(o.type))html+=`<div class="prop"><label>INTERAÇÃO</label><div class="check"><input data-p="interactive" type="checkbox" ${o.interactive?'checked':''}> Jogador pode interagir</div></div>`;
 if(o.type==='door')html+=`<div class="prop"><label>PORTA</label><div class="check"><input data-p="open" type="checkbox" ${o.open?'checked':''}> Aberta</div><div class="check"><input data-p="locked" type="checkbox" ${o.locked?'checked':''}> Trancada</div></div><div class="prop"><label>REQUISITO</label><input data-p="requires" value="${escapeHtml(o.requires||'')}"></div>`;
 if(o.type==='enemy')html+=`<div class="prop"><label>IA</label><select data-p="ai"><option value="patrol" ${o.ai==='patrol'?'selected':''}>Patrulha</option><option value="chase" ${o.ai==='chase'?'selected':''}>Perseguidor</option><option value="hearing" ${o.ai==='hearing'?'selected':''}>Cego / Audição</option><option value="stalker" ${o.ai==='stalker'?'selected':''}>Stalker</option></select></div><div class="prop row"><div><label>VELOCIDADE</label><input data-p="speed" type="number" step=".1" value="${o.speed||1.8}"></div><div><label>DANO</label><input data-p="damage" type="number" value="${o.damage||15}"></div></div><div class="prop row"><div><label>VISÃO</label><input data-p="vision" type="number" value="${o.vision||0}"></div><div><label>AUDIÇÃO</label><input data-p="hearing" type="number" value="${o.hearing||7}"></div></div>`;
 if(o.type==='lamp')html+=`<div class="prop row"><div><label>RAIO</label><input data-p="radius" type="number" step=".1" value="${o.radius||4}"></div><div><label>INTENSIDADE</label><input data-p="intensity" type="number" step=".1" value="${o.intensity||.8}"></div></div>`;
 if(['bed','stretcher','locker','generator','paper','item','weapon','safe'].includes(o.type))html+=`<div class="prop"><label>MENSAGEM / INTERAÇÃO</label><textarea data-p="message">${escapeHtml(o.message||'')}</textarea></div>`;
 if(o.type==='item'||o.type==='weapon')html+=`<div class="prop"><label>ID DO ITEM</label><input data-p="itemId" value="${escapeHtml(o.itemId||'')}"></div>`;
 if(o.type==='safe')html+=`<div class="prop"><label>CÓDIGO DO COFRE</label><input data-p="safeCode" inputmode="numeric" value="${escapeHtml(o.safeCode||o.code||'')}"></div>`;
 const ca=customAssetDefs().find(a=>a.type===o.type);if(ca)html+=`<div class="prop"><label>RECURSO PERSONALIZADO</label><div class="check"><input data-p="solid" type="checkbox" ${o.solid?'checked':''}> Colisão</div><div class="check"><input data-p="interactive" type="checkbox" ${o.interactive?'checked':''}> Interativo</div><div class="prop"><label>ÍCONE</label><input data-p="icon" value="${escapeHtml(ca.icon||'🧩')}"></div></div>`;
 html+=`<div class="sectionTitle">CÓDIGO DO OBJETO</div><div class="prop"><textarea data-p="code" placeholder="// Executado ao interagir\\n">${escapeHtml(o.code||'')}</textarea></div>
 <div class="prop row"><button id="duplicate">DUPLICAR</button><button id="delete" style="border-color:#714747">EXCLUIR</button></div>`;
 $('rightContent').innerHTML=html;
 $('rightContent').querySelectorAll('[data-p]').forEach(el=>{
  const handler=()=>{const k=el.dataset.p,v=el.type==='checkbox'?el.checked:el.value;if(k==='code'){const err=validateCodeSyntax(v);if(err){toast('Código inválido: '+err);el.value=o.code||'';return}}pushHistory();updateProp(k,v)};
  el.addEventListener(el.tagName==='TEXTAREA'||el.tagName==='INPUT'?'change':'change',handler);
 });
 $('delete').onclick=deleteSelected;
 $('duplicate').onclick=()=>{pushHistory();const n=clone(o);n.id=uid();n.x+=.7;n.y+=.7;n.name=o.name+' (cópia)';project.objects.push(n);selectedId=n.id;renderProps();renderAssets();draw();autosave()}
}

function openExtensions(){ensureExtensions(project);document.querySelectorAll('[data-exttab]').forEach(b=>b.classList.toggle('active',b.dataset.exttab==='asset'));$('extAssetPane').style.display='block';$('extFunctionPane').style.display='none';$('extCheckPane').style.display='none';$('extensionModal').classList.add('open')}
function addCustomAsset(){ensureExtensions(project);const type=safeId($('extId').value);const existing=new Set([...Object.keys(templates),...project.extensions.assets.map(a=>a.type)]);if(!type||!/^[a-z][a-z0-9_]*$/i.test(type)||RESERVED_TYPES.has(type)||existing.has(type))return toast('ID inválido ou já utilizado. Escolha outro.');const w=Math.max(.1,Number($('extW').value)||1),h=Math.max(.1,Number($('extH').value)||1),code=$('extCode').value||'';const err=validateCodeSyntax(code);if(err)return toast('Código com erro: '+err);pushHistory();project.extensions.assets.push({type,kind:$('extKind').value,icon:$('extIcon').value||'🧩',name:$('extName').value.trim()||type,desc:$('extDesc').value.trim(),w,h,solid:$('extSolid').checked,interactive:$('extInteractive').checked,light:$('extLight').checked,color:$('extColor').value||'#59645d',code,unique:$('extUnique').checked});renderAssets();$('extensionModal').classList.remove('open');autosave();toast('Recurso '+type+' adicionado com segurança.')}
function addCustomFunction(){ensureExtensions(project);const id=safeId($('fnId').value),name=$('fnName').value.trim()||id,code=$('fnCode').value||'';if(!id||!/^[a-z][a-z0-9_]*$/i.test(id)||RESERVED_TYPES.has(id)||project.extensions.functions.some(f=>f.id===id))return toast('ID de função inválido ou já utilizado.');const err=validateCodeSyntax(code,['game','args']);if(err)return toast('Código com erro: '+err);pushHistory();project.extensions.functions.push({id,name,code});autosave();toast('Função '+id+' adicionada.')}
function runProjectValidation(){const issues=validateProjectDetailed(project);$('validationBox').className='validation '+(issues.length?'bad':'ok');$('validationBox').innerHTML=issues.length?'<b>⚠ Encontrados:</b><br>'+issues.slice(0,20).map(escapeHtml).join('<br>'):'<b>✓ Projeto consistente.</b><br>IDs, posições, tipos registrados e códigos básicos estão válidos.'}
function repairProject(){pushHistory();const issues=normalizeProject(project);const remaining=validateProjectDetailed(project);renderAssets();renderProps();draw();autosave();runProjectValidation();toast(remaining.length?'Alguns problemas ainda precisam de correção manual.':(issues.length?'Projeto normalizado.':'Nenhuma correção necessária.'))}

function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';clearTimeout(window.__toast);window.__toast=setTimeout(()=>$('toast').style.display='none',1700)}

async function enterImmersive(){
 const root=document.documentElement;
 let entered=false;
 try{
  const req=root.requestFullscreen||root.webkitRequestFullscreen||root.msRequestFullscreen;
  if(req){await req.call(root,{navigationUI:'hide'});entered=true;}
 }catch(e){}
 if(!entered){try{const req=document.body.requestFullscreen||document.body.webkitRequestFullscreen;if(req){await req.call(document.body);entered=true;}}catch(e){}}
 try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape');}catch(e){}
 document.body.classList.add('immersive');
 updateFullscreenUI();
 if(!entered)toast('Tela cheia pode ser bloqueada pelo navegador. Toque novamente ou use o menu do Chrome.');
}
async function exitImmersive(){
 try{if(document.fullscreenElement&&document.exitFullscreen) await document.exitFullscreen();}catch(e){}
 document.body.classList.remove('immersive');
 updateFullscreenUI();
}
async function toggleFullscreen(){
 if(document.fullscreenElement) return exitImmersive();
 return enterImmersive();
}
function updateFullscreenUI(){
 const b=$('fullscreenBtn');
 if(!b)return;
 const on=!!document.fullscreenElement;
 b.textContent=on?'⛶ SAIR':'⛶ TELA CHEIA';
 b.classList.toggle('primary',!on);
 document.body.classList.toggle('immersive',on);
}
document.addEventListener('fullscreenchange',updateFullscreenUI);
document.addEventListener('webkitfullscreenchange',updateFullscreenUI);
$('fullscreenBtn').onclick=toggleFullscreen;
$('gateFullscreen').onclick=enterImmersive;
canvas.addEventListener('pointerdown',e=>{
 pointerId=e.pointerId;canvas.setPointerCapture(pointerId);
 const rr=canvas.getBoundingClientRect(), sx=e.clientX-rr.left, sy=e.clientY-rr.top; const p=worldFromScreen(sx,sy),o=objectAt(p.x,p.y);
 if(o){select(o.id);pushHistory();dragging=o;dragOffset={x:p.x-o.x,y:p.y-o.y}}
 else selectedId=null;
 renderProps();draw();
});
canvas.addEventListener('pointermove',e=>{
 if(!dragging||e.pointerId!==pointerId)return;
 const rr=canvas.getBoundingClientRect(), sx=e.clientX-rr.left, sy=e.clientY-rr.top; const p=worldFromScreen(sx,sy);dragging.x=p.x-dragOffset.x;dragging.y=p.y-dragOffset.y;
 if(gridOn){dragging.x=Math.round(dragging.x*2)/2;dragging.y=Math.round(dragging.y*2)/2}dragging.x=Math.max(dragging.w/2,Math.min(project.map.width-dragging.w/2,dragging.x));dragging.y=Math.max(dragging.h/2,Math.min(project.map.height-dragging.h/2,dragging.y));renderProps();draw();$('coords').textContent=Math.round(p.x)+','+Math.round(p.y)
});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===pointerId){dragging=null;pointerId=null;autosave()}});
canvas.addEventListener('pointercancel',()=>{dragging=null;pointerId=null});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.25,Math.min(4,view.zoom*(e.deltaY<0?1.08:.92)));draw()},{passive:false});

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));renderAssets()});
$('search').oninput=renderAssets;
$('zoomIn').onclick=()=>{view.zoom=Math.min(4,view.zoom*1.15);draw()};
$('zoomOut').onclick=()=>{view.zoom=Math.max(.25,view.zoom/1.15);draw()};
$('gridBtn').onclick=()=>{gridOn=!gridOn;draw()};
$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
$('newBtn').onclick=()=>{if(confirm('Criar um novo projeto? As alterações não salvas serão perdidas.')){project={version:1,name:'Novo Hospital',meta:{name:'Novo Hospital',version:'1.0.0',description:'',cover:'',editorVersion:EDITOR_VERSION},extensions:{assets:[],functions:[]},map:{width:30,height:20,tile:48},settings:{grid:true,background:'#111713'},globalCode:'',objects:[]};undoStack=[];redoStack=[];selectedId=null;fitMap();renderAssets();renderProps();updateProjectUI();autosave();toast('Novo projeto criado.')}};
$('projectBtn').onclick=openProjectModal;
$('projectClose').onclick=()=>$('projectModal').classList.remove('open');
$('projectApply').onclick=()=>{applyProjectMeta();$('projectModal').classList.remove('open')};
$('coverInput').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>4*1024*1024){toast('Escolha uma imagem de até 4 MB.');e.target.value='';return}const r=new FileReader();r.onload=()=>{$('coverPreview').src=r.result;project.meta=project.meta||{};project.meta.cover=r.result;toast('Capa carregada. Clique em salvar configurações.')};r.readAsDataURL(f)};
$('projectDownload').onclick=saveProjectFile;
$('gameDownload').onclick=()=>{downloadBlob(makeGameHTML(),projectFileName('.html'),'text/html');toast('Jogo HTML exportado.')};
$('restoreDraft').onclick=()=>{const raw=localStorage.getItem('hospital_editor_draft');if(!raw)return toast('Não há rascunho salvo neste aparelho.');try{project=validateImportedProject(JSON.parse(raw));selectedId=null;fitMap();renderAssets();renderProps();updateProjectUI();$('projectModal').classList.remove('open');toast('Rascunho restaurado.')}catch(e){toast('Rascunho inválido.')}};
$('clearDraft').onclick=()=>{localStorage.removeItem('hospital_editor_draft');toast('Rascunho local apagado.')};
$('saveBtn').onclick=saveProjectFile;
$('loadBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const p=validateImportedProject(JSON.parse(r.result));project=p;selectedId=null;undoStack=[];redoStack=[];fitMap();renderAssets();renderProps();updateProjectUI();autosave();toast('Projeto carregado com sucesso.')}catch(err){toast('Arquivo inválido ou incompatível.')}};r.readAsText(f);e.target.value=''};
$('codeBtn').onclick=()=>{$('globalCode').value=project.globalCode||'';$('codeModal').classList.add('open')};
$('codeCancel').onclick=()=>$('codeModal').classList.remove('open');
$('codeApply').onclick=()=>{const code=$('globalCode').value||'';const err=validateCodeSyntax(code,['game']);if(err)return toast('Código global inválido: '+err);pushHistory();project.globalCode=code;autosave();$('codeModal').classList.remove('open');toast('Código global salvo no projeto.')} ;
$('testClose').onclick=()=>$('testModal').classList.remove('open');
$('gameBtn').onclick=()=>{downloadBlob(makeGameHTML(),projectFileName('.html'),'text/html');toast('Jogo HTML exportado.')};

$('testClose').onclick=()=>$('testModal').classList.remove('open');
$('extensionsBtn').onclick=openExtensions;$('extCancel').onclick=()=>$('extensionModal').classList.remove('open');$('extAdd').onclick=addCustomAsset;$('fnAdd').onclick=addCustomFunction;document.querySelectorAll('[data-exttab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-exttab]').forEach(x=>x.classList.toggle('active',x===b));$('extAssetPane').style.display=b.dataset.exttab==='asset'?'block':'none';$('extFunctionPane').style.display=b.dataset.exttab==='function'?'block':'none';$('extCheckPane').style.display=b.dataset.exttab==='check'?'block':'none';if(b.dataset.exttab==='check')runProjectValidation()});$('repairBtn').onclick=repairProject;

function makeGameHTML(){
 const data=JSON.stringify(project).replace(/</g,'\\u003c');
 const title=escapeHtml(project.meta?.name||project.name||'O Hospital');
 const version=escapeHtml(project.meta?.version||'1.0.0');
 const cover=project.meta?.cover||'';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>${title}</title><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#080c0a;color:#e8eee9;font-family:system-ui}canvas{display:block;width:100%;height:100%;touch-action:none}#hud{position:fixed;top:8px;left:8px;background:#080d0bcc;padding:7px 9px;border:1px solid #39463e;border-radius:8px;font-size:11px;z-index:4}#joy{position:fixed;left:14px;bottom:14px;width:124px;height:124px;border-radius:50%;background:#18221dcc;border:1px solid #758177;touch-action:none;z-index:5}#stick{position:absolute;width:50px;height:50px;left:36px;top:36px;border-radius:50%;background:#aebbb288}#use{position:fixed;right:18px;bottom:28px;width:72px;height:72px;border-radius:50%;background:#718d7c;color:#08100b;font-weight:800;border:1px solid #a9c0b0;z-index:5;touch-action:none}#run{position:fixed;right:100px;bottom:22px;width:55px;height:55px;border-radius:50%;background:#202b25dd;color:#fff;border:1px solid #64736a;z-index:5;touch-action:none}#cover{position:fixed;inset:0;background:#080c0af2;display:flex;align-items:center;justify-content:center;z-index:10;opacity:1;transition:opacity .7s}#cover.hide{opacity:0;pointer-events:none}#cover img{max-width:70vw;max-height:55vh;border-radius:14px;object-fit:contain;box-shadow:0 15px 60px #000}#start{position:fixed;bottom:12%;left:50%;transform:translateX(-50%);z-index:11;padding:13px 20px;border-radius:10px;background:#718d7c;color:#08100b;font-weight:800;border:1px solid #a9c0b0}
</style></head><body><canvas id="g"></canvas><div id="hud">${title} · v${version}</div><div id="joy"><div id="stick"></div></div><button id="run">🏃</button><button id="use">USAR</button>${cover?'<div id="cover"><img src="'+cover+'" alt="capa"><button id="start">COMEÇAR</button></div>':''}<script>
const P=${data},c=document.getElementById('g'),x=c.getContext('2d');let W,H,d=Math.min(devicePixelRatio||1,2),tile=P.map.tile||48,px=0,py=0,joy={x:0,y:0},running=false,inventory={},power=false,opened={},last=performance.now();
const playerObj=P.objects.find(o=>o.type==='player');px=playerObj?.x||2;py=playerObj?.y||2;
const flags={};const functions={};const customAssets=Array.isArray(P.extensions?.assets)?P.extensions.assets:[];const customFunctions=Array.isArray(P.extensions?.functions)?P.extensions.functions:[];const game={flags,inventory,functions,message:m=>alert(String(m)),setFlag:(k,v=true)=>flags[k]=v,getFlag:k=>flags[k],openDoor:id=>{const q=P.objects.find(o=>o.id===id);if(q&&q.type==='door')q.open=true},closeDoor:id=>{const q=P.objects.find(o=>o.id===id);if(q&&q.type==='door')q.open=false},give:id=>inventory[id]=true,has:id=>!!inventory[id]};for(const f of customFunctions){try{functions[f.id]=(args={})=>new Function('game','args',String(f.code||''))(game,args)}catch(e){console.warn('Função inválida',f.id,e)}}try{if(P.globalCode)new Function('game',String(P.globalCode))(game)}catch(e){console.error('Código global falhou',e)}
function rs(){W=innerWidth;H=innerHeight;c.width=W*d;c.height=H*d;x.setTransform(d,0,0,d,0,0)}addEventListener('resize',rs);rs();
function rect(o){return {l:o.x-o.w/2,r:o.x+o.w/2,t:o.y-o.h/2,b:o.y+o.h/2}}
function hit(a,b){return a.x>b.l&&a.x<b.r&&a.y>b.t&&a.y<b.b}
function blocked(nx,ny){for(const o of P.objects){if(!o.solid||o.type==='player')continue;if(o.type==='door'&&o.open)continue;const r=rect(o);if(nx>r.l-.28&&nx<r.r+.28&&ny>r.t-.28&&ny<r.b+.28)return true}return false}
function runHook(o){if(!o?.code)return;try{new Function('game','object',String(o.code))(game,o)}catch(e){console.error('Código do objeto falhou',o.name,e);alert('O código de '+(o.name||o.type)+' apresentou um erro. O jogo continuou sem quebrar.')}}
function interact(){let best=null,bd=1.35;for(const o of P.objects){if(!o.interactive)continue;let q=Math.hypot(px-o.x,py-o.y);if(q<bd){best=o;bd=q}}if(!best)return; if(best.type==='door'){if(best.locked&&best.requires&&!inventory[best.requires]&&!(best.requires==='energia'&&power)){alert('Está trancada. Requisito: '+best.requires);return}best.open=!best.open;runHook(best);return}if(best.type==='item'||best.type==='weapon'){inventory[best.itemId||best.name]=true;alert(best.message||'Item coletado.');best.interactive=false;runHook(best);return}if(best.type==='generator'){power=true;alert(best.message||'Energia restaurada.');runHook(best);return}if(best.type==='safe'){const code=prompt(best.message||'Código do cofre:');if(code===String(best.code||'')){inventory.cartao=true;alert('Cofre aberto. Você encontrou um cartão.')}else if(code!==null)alert('Código incorreto.');runHook(best);return}alert(best.message||best.name);runHook(best)}
function draw(){x.clearRect(0,0,W,H);let s=Math.min(W/(P.map.width*tile),H/(P.map.height*tile))*.86,t=tile*s,ox=(W-P.map.width*t)/2,oy=(H-P.map.height*t)/2;x.fillStyle='#101611';x.fillRect(0,0,W,H);
for(const o of P.objects){if(o.type==='floor'){x.fillStyle='#1a241f';x.fillRect(ox+(o.x-o.w/2)*t,oy+(o.y-o.h/2)*t,o.w*t,o.h*t);x.strokeStyle='#2d3831';x.strokeRect(ox+(o.x-o.w/2)*t,oy+(o.y-o.h/2)*t,o.w*t,o.h*t)}}
for(const o of P.objects){if(o.type==='floor'||o.type==='trigger'||o.type==='player')continue;let r=rect(o),xx=ox+r.l*t,yy=oy+r.t*t;x.fillStyle=o.type==='wall'?'#68746d':o.type==='door'?(o.open?'#718b78':'#5a463d'):o.type==='enemy'?'#8f5c5c':o.type==='bed'?'#70847a':o.type==='stretcher'?'#84918a':o.type==='locker'?'#56635c':o.type==='safe'?'#5b6260':o.type==='item'?'#d2bf65':o.type==='weapon'?'#b5b5ad':o.type==='lamp'?'#d5c58b':o.type==='blood'?'#632f31':o.type==='corpse'?'#3e4742':(o.color||'#59645d');x.fillRect(xx,yy,o.w*t,o.h*t);if(o.type==='enemy'){x.fillStyle='#ead6d6';x.beginPath();x.arc(ox+o.x*t,oy+o.y*t,Math.max(4,t*.18),0,7);x.fill()}}
// jogador
x.fillStyle='#a9c0b4';x.beginPath();x.arc(ox+px*t,oy+py*t,Math.max(6,t*.22),0,7);x.fill();
// lanterna simples
const grd=x.createRadialGradient(ox+px*t,oy+py*t,2,ox+px*t,oy+py*t,Math.max(W,H)*.32);grd.addColorStop(0,'#ffffff18');grd.addColorStop(1,'#000000c8');x.fillStyle=grd;x.fillRect(0,0,W,H)}
function loop(now){let dt=Math.min(.035,(now-last)/1000);last=now;let sp=(running?.085:.05)*dt*60,dx=joy.x*sp,dy=joy.y*sp;if(dx||dy){let nx=px+dx;if(!blocked(nx,py))px=nx;let ny=py+dy;if(!blocked(px,ny))py=ny}for(const o of P.objects.filter(a=>a.type==='enemy')){let dx=px-o.x,dy=py-o.y,dist=Math.hypot(dx,dy);if((o.ai==='chase'||o.ai==='stalker')&&dist<(o.vision||6)){let spd=.025*dt*60*(o.speed||1.8)/1.8;let nx=o.x+dx/dist*spd,ny=o.y+dy/dist*spd;if(!blocked(nx,o.y))o.x=nx;if(!blocked(o.x,ny))o.y=ny}}draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
const J=document.getElementById('joy'),S=document.getElementById('stick');let jid=null;function jm(e){let r=J.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),m=39;if(l>m){dx*=m/l;dy*=m/l}joy.x=dx/m;joy.y=dy/m;S.style.transform='translate('+dx+'px,'+dy+'px)'}J.onpointerdown=e=>{jid=e.pointerId;J.setPointerCapture(jid);jm(e)};J.onpointermove=e=>{if(e.pointerId===jid)jm(e)};J.onpointerup=J.onpointercancel=()=>{jid=null;joy.x=joy.y=0;S.style.transform='translate(0,0)'};document.getElementById('use').onpointerdown=e=>{e.preventDefault();interact()};document.getElementById('run').onpointerdown=()=>running=true;document.getElementById('run').onpointerup=document.getElementById('run').onpointercancel=()=>running=false;
const st=document.getElementById('start');if(st){st.onclick=()=>document.getElementById('cover').classList.add('hide')}
<\/script></body></html>`;
}

function makeTestHTML(){
 const data=JSON.stringify(project).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
 html,body{margin:0;height:100%;overflow:hidden;background:#090d0b;color:#e7eee9;font-family:system-ui}canvas{width:100%;height:100%;display:block}
 #hud{position:fixed;top:8px;left:8px;background:#080d0bcc;padding:7px;border:1px solid #39463e;border-radius:8px;font-size:11px}
 #joy{position:fixed;left:14px;bottom:14px;width:120px;height:120px;border-radius:50%;background:#1a241fbb;border:1px solid #758177;touch-action:none}
 #stick{position:absolute;width:48px;height:48px;left:35px;top:35px;border-radius:50%;background:#aebbb2aa}
 #use{position:fixed;right:18px;bottom:26px;width:70px;height:70px;border-radius:50%;background:#718d7c;color:#08100b;font-weight:800;border:1px solid #a9c0b0}
 </style><canvas id="g"></canvas><div id="hud">TESTE · ${escapeHtml(project.name)}</div><div id="joy"><div id="stick"></div></div><button id="use">USAR</button>
 <script>
 const P=${data},c=document.getElementById('g'),x=c.getContext('2d');let W,H,d=devicePixelRatio||1,px=(P.objects.find(o=>o.type==='player')||{x:2,y:2}).x,py=(P.objects.find(o=>o.type==='player')||{x:2,y:2}).y,ang=0,joy={x:0,y:0};
 function rs(){W=innerWidth;H=innerHeight;c.width=W*d;c.height=H*d;x.setTransform(d,0,0,d,0,0)}addEventListener('resize',rs);rs();
 function solid(a,b){for(const o of P.objects){if(!o.solid||o===a)continue;if(b.x>o.x-o.w/2&&b.x<o.x+o.w/2&&b.y>o.y-o.h/2&&b.y<o.y+o.h/2)return true}return false}
 function draw(){x.clearRect(0,0,W,H);let s=Math.min(W/(P.map.width*P.map.tile),H/(P.map.height*P.map.tile))*.85,t=P.map.tile*s,ox=(W-P.map.width*t)/2,oy=(H-P.map.height*t)/2;x.fillStyle='#111713';x.fillRect(0,0,W,H);for(const o of P.objects){if(o.type==='floor'){x.fillStyle='#1b2520';x.fillRect(ox+(o.x-o.w/2)*t,oy+(o.y-o.h/2)*t,o.w*t,o.h*t)}}for(const o of P.objects){if(o.type==='floor')continue;let xx=ox+(o.x-o.w/2)*t,yy=oy+(o.y-o.h/2)*t;x.fillStyle=o.type==='wall'?'#68746d':o.type==='door'?'#614f45':o.type==='enemy'?'#8f5c5c':o.type==='player'?'#9db7aa':o.type==='bed'?'#70847a':o.type==='locker'?'#56635c':o.type==='safe'?'#5b6260':o.type==='item'?'#d2bf65':'#59645d';x.fillRect(xx,yy,o.w*t,o.h*t)}x.fillStyle='#dbe8df';x.beginPath();x.arc(ox+px*t,oy+py*t,Math.max(6,t*.22),0,7);x.fill()}function loop(){let speed=.045,dx=joy.x*speed,dy=joy.y*speed;if(dx||dy){let n={x:px+dx,y:py};if(!solid(null,n))px=n.x;n={x:px,y:py+dy};if(!solid(null,n))py=n.y;ang=Math.atan2(dy,dx)}draw();requestAnimationFrame(loop)}loop();
 const J=document.getElementById('joy'),S=document.getElementById('stick');let jid=null;function jm(e){let r=J.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),m=38;if(l>m){dx*=m/l;dy*=m/l}joy.x=dx/m;joy.y=dy/m;S.style.transform='translate('+dx+'px,'+dy+'px)'}J.onpointerdown=e=>{jid=e.pointerId;J.setPointerCapture(jid);jm(e)};J.onpointermove=e=>{if(e.pointerId===jid)jm(e)};J.onpointerup=J.onpointercancel=()=>{jid=null;joy.x=joy.y=0;S.style.transform='translate(0,0)'};
 document.getElementById('use').onclick=()=>{let best=null,bd=1.3;for(const o of P.objects){let q=Math.hypot(px-o.x,py-o.y);if(o.interactive&&q<bd){best=o;bd=q}}if(best)alert(best.message||('Interagiu com '+best.name));};
 <\/script></html>`;
}
$('testBtn').onclick=()=>{ $('testFrame').srcdoc=makeGameHTML();$('testModal').classList.add('open')};


window.addEventListener('error',e=>{try{toast('Erro do editor: '+(e.message||'erro desconhecido'));}catch(_){} });
window.addEventListener('unhandledrejection',e=>{try{toast('Erro: '+(e.reason?.message||e.reason||'operação falhou'));}catch(_){} });

/* PWA / instalação no celular */
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;showInstallButton(true)});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;showInstallButton(false);toast('Editor instalado no celular.');});
function showInstallButton(show){const b=$('installBtn');if(b)b.style.display=show?'inline-block':'none'}
async function installEditor(){if(!deferredInstallPrompt){toast('Se a opção aparecer no Chrome, use “Adicionar à tela inicial”.');return}deferredInstallPrompt.prompt();try{await deferredInstallPrompt.userChoice}catch(e){}deferredInstallPrompt=null;showInstallButton(false)}
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

fitMap();renderAssets();renderProps();updateProjectUI();draw();updateFullscreenUI();
document.addEventListener('keydown',e=>{
 if(e.target.matches('input,textarea,select'))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProjectFile()}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo()}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
 if(e.key==='Escape'&&document.fullscreenElement)exitImmersive();
});

