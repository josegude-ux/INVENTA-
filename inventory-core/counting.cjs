'use strict';
// VISURA INVENTA 07: deterministic, side-effect-free physical quantity calculations.
// No BC stock, user credentials, network access, or persistence in this module.
const MAX_MILLI = 9999999999999999n; // compatible with numeric(16,3)
function supplied(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function milli(value, label) {
  const raw = String(value).trim();
  if (!/^[0-9]+(?:[.,][0-9]{1,3})?$/.test(raw)) throw new Error(`${label}: cantidad no válida (máximo tres decimales).`);
  const [whole, fraction=''] = raw.replace(',', '.').split('.');
  const n = BigInt(whole) * 1000n + BigInt((fraction + '000').slice(0,3));
  if (n > MAX_MILLI) throw new Error(`${label}: cantidad fuera de rango.`);
  return n;
}
function positiveInteger(value, label) {
  const raw = String(value).trim();
  if (!/^[0-9]+$/.test(raw) || BigInt(raw) < 1n) throw new Error(`${label}: introduce un entero positivo.`);
  const n = BigInt(raw);
  if (n > MAX_MILLI) throw new Error(`${label}: cantidad fuera de rango.`);
  return n;
}
function formatAmount(n) {
  const whole = n / 1000n, fraction = String(n % 1000n).padStart(3,'0').replace(/0+$/,'');
  return whole.toString() + (fraction ? '.'+fraction : '');
}
function calculateCount(input={}) {
  const {looseUnits, boxGroups=[], palletGroups=[], markZero=false} = input;
  if (!Array.isArray(boxGroups) || !Array.isArray(palletGroups)) throw new Error('Los grupos de embalaje deben ser listas.');
  if (markZero) {
    if (supplied(looseUnits) || boxGroups.length || palletGroups.length) throw new Error('Marcar cero requiere dejar vacíos los otros cálculos.');
    return {status:'ready', quantity:'0', explicitZero:true, breakdown:[]};
  }
  let total=0n;
  const breakdown=[];
  if (supplied(looseUnits)) {
    const amount=milli(looseUnits,'Unidades sueltas');
    total+=amount;
    breakdown.push({type:'loose',units:formatAmount(amount)});
  }
  for (const [i,entry] of boxGroups.entries()) {
    if (!entry || typeof entry !== 'object') throw new Error(`Cajas ${i+1}: grupo incorrecto.`);
    const boxes=positiveInteger(entry.boxes,`Cajas ${i+1}`);
    const perBox=positiveInteger(entry.unitsPerBox,`Unidades/caja ${i+1}`);
    const amount=boxes*perBox*1000n;
    total+=amount;
    breakdown.push({type:'boxes',boxes:boxes.toString(),unitsPerBox:perBox.toString(),subtotal:formatAmount(amount)});
  }
  for (const [i,entry] of palletGroups.entries()) {
    if (!entry || typeof entry !== 'object') throw new Error(`Palés ${i+1}: grupo incorrecto.`);
    // 'layers' is the SUM of real layers across equivalent pallets; not a mandatory pallet count.
    const layers=positiveInteger(entry.layers,`Alturas reales ${i+1}`);
    const perBase=positiveInteger(entry.boxesPerBase,`Cajas/base ${i+1}`);
    const perBox=positiveInteger(entry.unitsPerBox,`Unidades/caja ${i+1}`);
    const amount=layers*perBase*perBox*1000n;
    total+=amount;
    breakdown.push({type:'pallet-group',layers:layers.toString(),boxesPerBase:perBase.toString(),unitsPerBox:perBox.toString(),subtotal:formatAmount(amount)});
  }
  if (!breakdown.length) return {status:'empty',quantity:null,explicitZero:false,breakdown:[]};
  if (total>MAX_MILLI) throw new Error('Total físico fuera de rango; revisa el desglose.');
  if (total===0n) throw new Error('Para confirmar cero, utiliza expresamente «Marcar cero».');
  return {status:'ready',quantity:formatAmount(total),explicitZero:false,breakdown};
}
module.exports={calculateCount};
