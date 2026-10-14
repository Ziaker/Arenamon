// Arenamon Rigging — dados de ossos, esqueleto guiado e pesos iniciais.
// Nenhuma inferência "perfeita" de anatomia: pontos e pesos são explícitos e auditáveis.
// Todas as coordenadas de edição são medidas no espaço LOCAL do nó raiz do personagem.
import * as T from 'three';

const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
const arr = (v) => [v.x, v.y, v.z];
const round = (n) => Math.round(n * 100000) / 100000;
const tidy = (v) => v.map(round);
const nameOf = (o) => o.name || o.uuid;
const isFinitePoint = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const sidePair = (name) => name.startsWith('Left') ? 'Right' + name.slice(4) : name.startsWith('Right') ? 'Left' + name.slice(5) : null;
let jointSequence = 0;
const newJointId = () => `joint-${Date.now().toString(36)}-${(++jointSequence).toString(36)}`;

export function ensureJointIds(draft) {
  const used = new Set();
  for (const joint of draft?.joints || []) {
    let id = typeof joint.id === 'string' && joint.id.trim() ? joint.id : newJointId();
    while (used.has(id)) id = newJointId();
    joint.id = id;used.add(id);
    if (!Array.isArray(joint.q) || joint.q.length !== 4 || !joint.q.every(Number.isFinite)) joint.q = [0,0,0,1];
  }
  return draft;
}

export function uniqueJointName(draft, requested='Bone') {
  const base=String(requested||'Bone').trim()||'Bone', used=new Set(draft.joints.map(j=>j.name.toLowerCase()));
  if(!used.has(base.toLowerCase()))return base;
  let n=2;while(used.has(`${base}.${String(n).padStart(3,'0')}`.toLowerCase()))n++;
  return `${base}.${String(n).padStart(3,'0')}`;
}

export function modelBounds(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const box = new T.Box3();
  let count = 0;
  const p = new T.Vector3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const attr = o.geometry.attributes.position;
    const matrix = inverse.clone().multiply(o.matrixWorld);
    // Bounding box transformed by all eight corners; conservative for animated skin.
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    if (!b || b.isEmpty()) return;
    for (const x of [b.min.x,b.max.x]) for (const y of [b.min.y,b.max.y]) for (const z of [b.min.z,b.max.z]) {
      p.set(x,y,z).applyMatrix4(matrix);box.expandByPoint(p);
    }
    count += attr.count;
  });
  if (!count || box.isEmpty()) throw Error('Não há uma malha com vértices para configurar o rig.');
  const min = box.min, max = box.max, size = box.getSize(new T.Vector3());
  return {min:arr(min), max:arr(max), size:arr(size), center:arr(box.getCenter(new T.Vector3())), vertices:count};
}

export function makeTemplate(bounds) {
  const [xmin,ymin,zmin] = bounds.min, [width,height,depth] = bounds.size;
  const midX = (xmin + bounds.max[0]) / 2, midZ = (zmin + bounds.max[2]) / 2;
  const px = (side, fraction) => midX + side * width * fraction;
  const py = fraction => ymin + height * fraction;
  const pz = fraction => midZ + depth * fraction;
  const joints = [
    {name:'Hips',parent:null,p:[midX,py(.49),midZ]},
    {name:'Spine',parent:'Hips',p:[midX,py(.69),midZ]},
    {name:'Neck',parent:'Spine',p:[midX,py(.86),pz(0)]},
    {name:'Head',parent:'Neck',p:[midX,py(.96),pz(.02)]},
  ];
  for (const [label,side] of [['Left',-1],['Right',1]]) {
    joints.push(
      {name:label+'Clavicle',parent:'Spine',p:[px(side,.12),py(.80),midZ]},
      {name:label+'Shoulder',parent:label+'Clavicle',p:[px(side,.29),py(.79),midZ]},
      {name:label+'Elbow',parent:label+'Shoulder',p:[px(side,.55),py(.68),midZ]},
      {name:label+'Wrist',parent:label+'Elbow',p:[px(side,.79),py(.67),midZ]},
      {name:label+'Hip',parent:'Hips',p:[px(side,.16),py(.45),midZ]},
      {name:label+'Knee',parent:label+'Hip',p:[px(side,.19),py(.25),pz(.035)]},
      {name:label+'Ankle',parent:label+'Knee',p:[px(side,.19),py(.075),midZ]},
      {name:label+'Foot',parent:label+'Ankle',p:[px(side,.20),py(.045),pz(.20)]},
    );
  }
  return ensureJointIds({schema:'arenamon-rig',version:2,space:'model-root',mode:'draft',joints,
    source:'template humanoid 20 pontos — aproximado, exige ajustes anatômicos',
    bounds:{min:tidy(bounds.min),max:tidy(bounds.max),size:tidy(bounds.size)}});
}

export function collectBones(root) {
  const seen = new Set(), result = [];
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    for (const bone of o.skeleton.bones) if (bone && !seen.has(bone)) {seen.add(bone);result.push(bone);}
  });
  if (!result.length) root.traverse(o => {if (o.isBone && !seen.has(o)) {seen.add(o);result.push(o);}});
  return result;
}

export function currentJoints(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  return collectBones(root).map(b => {
    const p = b.getWorldPosition(new T.Vector3()).applyMatrix4(inverse);
    return {id:b.userData.arenamonJointId||b.uuid,name:nameOf(b),uuid:b.uuid,parent:b.parent?.isBone ? nameOf(b.parent) : null,
      p:arr(p),local:arr(b.position),q:[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w],
      world:arr(b.getWorldPosition(new T.Vector3()))};
  });
}

function segmentDistanceSquared(p, a, b) {
  const ab = new T.Vector3().subVectors(b,a), l2 = ab.lengthSq();
  const t = l2 > 1e-12 ? T.MathUtils.clamp(new T.Vector3().subVectors(p,a).dot(ab) / l2, 0, 1) : 0;
  return p.distanceToSquared(new T.Vector3().copy(a).addScaledVector(ab,t));
}

// Verificações geométricas/dados de skinning. Relatório é diagnóstico, NÃO certificado anatômico.
export function auditRig(root) {
  const bones = collectBones(root), warnings = [], meshes = [], names = new Map(), influences = new Map();
  const bounds = modelBounds(root);
  root.updateMatrixWorld(true);
  for (const b of bones) {
    names.set(b.name, (names.get(b.name) || 0) + 1);
    if (b.parent?.isBone && b.getWorldPosition(new T.Vector3()).distanceTo(b.parent.getWorldPosition(new T.Vector3())) < 1e-6)
      warnings.push('Ossos coincidentes: '+nameOf(b.parent)+' / '+nameOf(b));
  }
  for (const [name,n] of names) if(n>1) warnings.push('Nome de osso duplicado: '+name+' ('+n+')');
  root.traverse(o => {
    if (!o.isMesh) return;
    const skinned = o.isSkinnedMesh && !!o.skeleton;
    const geom = o.geometry, n = geom.attributes.position?.count || 0;
    let invalid = 0, zero = 0, used = new Set();
    if (skinned) {
      const ids = geom.getAttribute('skinIndex'), ws = geom.getAttribute('skinWeight'), palette=o.skeleton.bones;
      if (!ids || !ws) warnings.push('Skin incompleto em '+nameOf(o)+': faltam índices/pesos.');
      else for (let i=0;i<n;i++) {
        let sum=0;
        for(let j=0;j<4;j++) {
          const weight=ws.getComponent(i,j), k=ids.getComponent(i,j);
          if (!Number.isFinite(weight) || weight < -1e-5 || weight > 1.00001 || k < 0 || k >= palette.length) {invalid++;continue;}
          if(weight>1e-5) {used.add(k);influences.set(palette[k]?.uuid,(influences.get(palette[k]?.uuid)||0)+1);}
          sum+=weight;
        }
        if(sum<.001)zero++;
        if(Math.abs(sum-1)>.02)invalid++;
      }
      if(invalid) warnings.push(nameOf(o)+': '+invalid+' entradas/pesos de skin inválidos ou não normalizados.');
      if(zero) warnings.push(nameOf(o)+': '+zero+' vértices sem influência.');
    }
    meshes.push({name:nameOf(o),vertices:n,skinned,bones:skinned?o.skeleton.bones.length:0,
      unused:skinned?o.skeleton.bones.length-used.size:0,invalidWeights:invalid,zeroWeights:zero});
  });
  if(!bones.length) warnings.push('Nenhum osso detectado. Gere um modelo de rig e vincule as malhas.');
  if(meshes.some(m=>!m.skinned))warnings.push('Há malhas sem skinning. Apenas bones soltos não deformam a geometria.');
  if(bones.length && !meshes.some(m=>m.skinned))warnings.push('Ossos existentes não estão vinculados a malhas.');
  return {schema:'arenamon-rig-audit',version:1,bounds,bones:bones.length,
    skinnedMeshes:meshes.filter(m=>m.skinned).length,meshes,warnings,
    vertexInfluences:Object.fromEntries(collectBones(root).map(b=>[nameOf(b),influences.get(b.uuid)||0]))};
}

export function validateDraft(draft,bounds) {
  if(draft?.schema!=='arenamon-rig'||!Array.isArray(draft.joints))throw Error('JSON de rig inválido: esperado schema arenamon-rig e joints.');
  if(draft.joints.length<2||draft.joints.length>200)throw Error('O rig precisa de 2 a 200 pontos.');
  ensureJointIds(draft);const map=new Map(), ids=new Set();
  for(const j of draft.joints) {
    if(typeof j.name!=='string'||!j.name.trim()||map.has(j.name)||!isFinitePoint(j.p))throw Error('Osso duplicado/inválido: '+j.name);
    if(ids.has(j.id))throw Error('ID de osso duplicado: '+j.id);ids.add(j.id);
    if(j.p.some(x=>Math.abs(x)>1e6))throw Error('Coordenada fora de limite: '+j.name);
    map.set(j.name,j);
  }
  for(const j of draft.joints){
    if(j.parent!=null&&!map.has(j.parent))throw Error('Pai não encontrado para '+j.name+': '+j.parent);
    let p=j.parent, seen=new Set([j.name]);
    while(p){if(seen.has(p))throw Error('Ciclo no esqueleto: '+j.name);seen.add(p);p=map.get(p)?.parent;}
  }
  const roots=draft.joints.filter(j=>j.parent==null);
  if(roots.length!==1)throw Error('O esqueleto precisa de exatamente um osso raiz.');
  return true;
}

export function addDraftJoint(draft,{name='Bone',parent=null,p=null,q=[0,0,0,1]}={}) {
  ensureJointIds(draft);const parentJoint=parent?draft.joints.find(j=>j.id===parent||j.name===parent):null;
  if(parent&&!parentJoint)throw Error('Pai não encontrado: '+parent);
  const base=parentJoint?.p||draft.joints[0]?.p||[0,0,0];
  const joint={id:newJointId(),name:uniqueJointName(draft,name),parent:parentJoint?.name||null,
    p:p?[...p]:[base[0],base[1]+.1,base[2]],q:[...q]};
  draft.joints.push(joint);validateDraft(draft);return joint;
}

export function renameDraftJoint(draft,id,name) {
  ensureJointIds(draft);const joint=draft.joints.find(j=>j.id===id||j.name===id);if(!joint)throw Error('Osso não encontrado.');
  const next=String(name||'').trim();if(!next)throw Error('Informe um nome para o osso.');
  if(draft.joints.some(j=>j!==joint&&j.name.toLowerCase()===next.toLowerCase()))throw Error('Já existe um osso chamado '+next+'.');
  const before=joint.name;joint.name=next;for(const child of draft.joints)if(child.parent===before)child.parent=next;
  validateDraft(draft);return joint;
}

export function reparentDraftJoint(draft,id,parent=null) {
  ensureJointIds(draft);const joint=draft.joints.find(j=>j.id===id||j.name===id),next=parent?draft.joints.find(j=>j.id===parent||j.name===parent):null;
  if(!joint||parent&&!next)throw Error('Osso ou pai não encontrado.');if(next===joint)throw Error('Um osso não pode ser pai de si mesmo.');
  joint.parent=next?.name||null;validateDraft(draft);return joint;
}

export function removeDraftJoint(draft,id) {
  ensureJointIds(draft);const joint=draft.joints.find(j=>j.id===id||j.name===id);if(!joint)throw Error('Osso não encontrado.');
  if(draft.joints.length<=2)throw Error('O rig precisa manter pelo menos dois ossos.');
  for(const child of draft.joints)if(child.parent===joint.name)child.parent=joint.parent;
  draft.joints.splice(draft.joints.indexOf(joint),1);validateDraft(draft);return joint;
}

export function applyMirror(draft,name) {
  const source=draft.joints.find(j=>j.name===name), other=draft.joints.find(j=>j.name===sidePair(name));
  if(!source||!other)return null;
  const center=(draft.bounds.min[0]+draft.bounds.max[0])/2;
  other.p=[2*center-source.p[0],source.p[1],source.p[2]];
  return other;
}

// Cria skin REAL por influência geométrica dos segmentos ósseos.
// O algoritmo é um ponto de partida; malhas complexas exigem inspeção e pintura manual de pesos.
export function bindDraftToModel(root,draft,{smoothness=.13,maxVertices=250000}={}) {
  const bounds=modelBounds(root);validateDraft(draft,bounds);
  if(!Number.isFinite(smoothness)||smoothness<=0||smoothness>2)throw Error('Suavização inválida.');
  const meshList=[];root.traverse(o=>{if(o.isMesh)meshList.push(o);});
  if(meshList.some(o=>o.isSkinnedMesh))throw Error('Já existe skinning neste personagem. Edite o rig existente, sem sobrescrever pesos originais.');
  if(!meshList.length)throw Error('Modelo sem malhas.');
  if(meshList.some(o=>o.isInstancedMesh||o.isMorphTargetMesh))throw Error('Malhas instanciadas/morph precisam de preparação manual antes de criar o skin.');
  const count=meshList.reduce((s,o)=>s+(o.geometry.attributes.position?.count||0),0);
  if(count>maxVertices)throw Error('Modelo com '+count+' vértices; limite de segurança '+maxVertices+'. Simplifique antes de vincular.');
  const map=new Map(), bones=[];
  for(const j of draft.joints){const bone=new T.Bone();bone.name=j.name;bone.userData.arenamonJointId=j.id;bone.quaternion.fromArray(j.q||[0,0,0,1]);map.set(j.name,bone);bones.push(bone);}
  for(const j of draft.joints){
    const bone=map.get(j.name), parent=j.parent?map.get(j.parent):root;
    const origin=j.parent?draft.joints.find(p=>p.name===j.parent).p:[0,0,0];
    bone.position.copy(v3(j.p).sub(v3(origin)));
    parent.add(bone);
  }
  root.updateMatrixWorld(true);
  const skeleton=new T.Skeleton(bones), positions=draft.joints.map(j=>v3(j.p));
  const sigma=Math.max(bounds.size[1],bounds.size[0],bounds.size[2]) * smoothness;
  const rootInverse=root.matrixWorld.clone().invert(), replacements=[];
  try {
    for(const mesh of meshList) {
      const geom=mesh.geometry.clone(), pos=geom.getAttribute('position');
      if(!pos)throw Error('Malha sem posições: '+nameOf(mesh));
      const meshToRoot=rootInverse.clone().multiply(mesh.matrixWorld);
      const indices=new Uint16Array(pos.count*4),weights=new Float32Array(pos.count*4);
      const p=new T.Vector3();
      for(let vi=0;vi<pos.count;vi++) {
        p.fromBufferAttribute(pos,vi).applyMatrix4(meshToRoot);
        const closest=[];
        for(let bi=0;bi<bones.length;bi++){
          const parent=draft.joints[bi].parent;
          const pj=parent?draft.joints.find(j=>j.name===parent):null;
          const d2=pj?segmentDistanceSquared(p,v3(pj.p),positions[bi]):p.distanceToSquared(positions[bi]);
          const score=1/(d2+sigma*sigma*.04);
          closest.push({i:bi,score});
        }
        closest.sort((a,b)=>b.score-a.score);
        const best=closest.slice(0,4), norm=best.reduce((v,c)=>v+c.score,0);
        for(let k=0;k<4;k++){indices[vi*4+k]=best[k].i;weights[vi*4+k]=best[k].score/norm;}
      }
      geom.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
      geom.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
      const skin=new T.SkinnedMesh(geom,mesh.material);
      skin.name=mesh.name;skin.position.copy(mesh.position);skin.quaternion.copy(mesh.quaternion);
      skin.scale.copy(mesh.scale);skin.visible=mesh.visible;skin.renderOrder=mesh.renderOrder;
      skin.castShadow=mesh.castShadow;skin.receiveShadow=mesh.receiveShadow;
      skin.userData=JSON.parse(JSON.stringify(mesh.userData||{}));
      // Preserva a hierarquia da malha, incluindo transformações e root.ModelTransform.
      const parent=mesh.parent;parent.add(skin);skin.updateMatrixWorld(true);
      skin.bind(skeleton,skin.matrixWorld.clone());
      replacements.push({old:mesh,mesh:skin,parent});
    }
    for(const pair of replacements) pair.old.removeFromParent();
    root.userData.arenamonRig={schema:'arenamon-rig',version:2,origin:'guided-template',joints:draft.joints.map(j=>({id:j.id,name:j.name,parent:j.parent,p:tidy(j.p),q:[...(j.q||[0,0,0,1])]})),
      autoWeights:{method:'segment-proximity',smoothness,topInfluences:4},units:'model-local'};
    return {bones, skeleton, replacements,vertices:count};
  } catch(e) {
    for(const pair of replacements){pair.mesh.removeFromParent();pair.mesh.geometry.dispose();}
    for(const b of bones) b.removeFromParent();
    throw e;
  }
}

export function exportCoordinates(root, draft=null) {
  const bounds=modelBounds(root), audit=auditRig(root);
  return {schema:'arenamon-rig',version:1,space:'model-root',createdAt:new Date().toISOString(),
    coordinatesUnit:'unidades do modelo (não pressupõe metros)',bounds,
    joints:draft?.joints?.length ? draft.joints.map(j=>({id:j.id,name:j.name,parent:j.parent,p:[...j.p],q:[...(j.q||[0,0,0,1])]})) : currentJoints(root).map(j=>({id:j.id,name:j.name,parent:j.parent,p:j.p,local:j.local,q:j.q,world:j.world,uuid:j.uuid})),
    audit};
}
