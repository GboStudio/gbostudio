/**
 * Public exhibition tariff *demonstration*.
 * Source: commerce-model.mjs default simulation, never browser localStorage.
 * Not a checkout: annual 3D amounts are a clearly labelled projection only.
 */
import {
  DEFAULT_COMMERCE_CONFIG,normalizeCommerceConfig,
  WALL_FORMATS,DISTANCE_LEVELS,euros
} from './commerce-model.mjs';

const config=normalizeCommerceConfig(DEFAULT_COMMERCE_CONFIG);
const wallRoot=document.getElementById('exhibit-wall-prices');
const aisleRoot=document.getElementById('exhibit-aisle-prices');

function cell(row,value,extraClass=''){
  const td=document.createElement('td');
  td.textContent=String(value);
  if(extraClass)td.className=extraClass;
  row.append(td);
  return td;
}
if(wallRoot){
  wallRoot.replaceChildren();
  const sorted=[...WALL_FORMATS].sort((a,b)=>b.count-a.count);
  for(const format of sorted){
    const prices=config.wall.pricing[format.id];
    const row=document.createElement('tr');
    const title=cell(row,format.label);
    const description=document.createElement('small');
    description.textContent=format.count+' cadre'+(format.count>1?'s':'')+' sur 3 m de mur';
    title.append(description);
    cell(row,String(format.count));
    cell(row,euros(prices.monthly));
    cell(row,euros(prices.annual));
    wallRoot.append(row);
  }
}
if(aisleRoot){
  aisleRoot.replaceChildren();
  for(const tier of DISTANCE_LEVELS){
    const prices=config.aisle.pricing[tier.id];
    const row=document.createElement('tr');
    const title=cell(row,tier.label);
    const distance=document.createElement('small');
    distance.textContent='Jusqu’à '+config.aisle.distanceMetres[tier.id]+' m, sous réserve d’obstacles';
    title.append(distance);
    cell(row,euros(prices['1']));
    cell(row,euros(prices['7']));
    cell(row,euros(prices['30']));
    aisleRoot.append(row);
  }
}
