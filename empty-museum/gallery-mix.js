/* Shared gallery layout for classic app.js and the Three.js gallery.
 * A physical bay remains 3.5m apart in the current building; its commercial
 * painting surface is a separate 3.0m-wide modular display.
 * Keep partner bays 0..3 unchanged. No checkout/authorization is implied.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.TUM_GALLERY_MIX=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
  'use strict';
  const FORMATS=Object.freeze({
    very_large:Object.freeze({name:'Très grand',columns:1,rows:1,count:1}),
    large:Object.freeze({name:'Grand',columns:2,rows:1,count:2}),
    normal:Object.freeze({name:'Normal',columns:2,rows:2,count:4}),
    medium:Object.freeze({name:'Moyen',columns:4,rows:2,count:8}),
    small:Object.freeze({name:'Petit',columns:4,rows:4,count:16})
  });
  // 34 saleable bays: 8 / 12 / 9 / 4 / 1 physical modules.
  // Explicit order avoids a uniform supermarket grid and places smaller art
  // near other quieter formats rather than by the monumental entrance.
  const SEQUENCE=Object.freeze([
    'very_large','large','normal','large','very_large','normal','large','medium',
    'large','very_large','normal','large','medium','normal','very_large','large',
    'normal','large','normal','very_large','large','medium','normal','large',
    'very_large','normal','large','small','very_large','medium','large','normal',
    'very_large','large'
  ]);
  const PARTNER_BAYS=Object.freeze([0,1,2,3]);
  const MODULE_COUNT=38;
  const WALL_LENGTH_M=3;
  const EXHIBIT_HEIGHT_M=2.4;
  const MARGIN_M=.12,GAP_M=.045;
  const PRICES=Object.freeze({
    very_large:Object.freeze({monthly:59.5,annual:595}),
    large:Object.freeze({monthly:34.5,annual:345}),
    normal:Object.freeze({monthly:19.5,annual:195}),
    medium:Object.freeze({monthly:9.5,annual:95}),
    small:Object.freeze({monthly:4.5,annual:45})
  });
  // Physical footprints, not billboard dimensions: one display per station.
  // Keep these stations in side alcoves so central traversal stays unobstructed.
  const AISLE_STATIONS=Object.freeze([
    Object.freeze({id:'S01',x:2.25,z:15}),
    Object.freeze({id:'S02',x:-2.25,z:47}),
    Object.freeze({id:'S03',x:2.25,z:85}),
    Object.freeze({id:'S04',x:-2.25,z:123})
  ]);
  const AISLE_WIDTH_M=1.5,AISLE_LENGTH_M=1.8,AISLE_MAX_HEIGHT_M=2.5;

  function formatForBay(bayId){
    if(!Number.isInteger(bayId)||bayId<0||bayId>=MODULE_COUNT)throw new RangeError('Invalid bay ID');
    return bayId<PARTNER_BAYS.length?null:SEQUENCE[bayId-PARTNER_BAYS.length];
  }
  function slotsForBay(bayId){
    const formatId=formatForBay(bayId);
    if(!formatId)return [];
    const format=FORMATS[formatId],slots=[];
    const width=(WALL_LENGTH_M-2*MARGIN_M-(format.columns-1)*GAP_M)/format.columns;
    const height=(EXHIBIT_HEIGHT_M-2*MARGIN_M-(format.rows-1)*GAP_M)/format.rows;
    for(let row=0;row<format.rows;row++)for(let column=0;column<format.columns;column++){
      const ordinal=slots.length+1;
      slots.push({
        id:'M'+String(bayId+1).padStart(3,'0')+'-'+formatId+'-'+ordinal,
        parentBayId:bayId,moduleNumber:bayId+1,formatId,
        ordinal,xM:MARGIN_M+column*(width+GAP_M),yM:MARGIN_M+row*(height+GAP_M),
        widthM:width,heightM:height
      });
    }
    return slots;
  }
  function allWallSlots(){return SEQUENCE.flatMap((_,i)=>slotsForBay(i+4));}
  function mix(){return Object.fromEntries(Object.keys(FORMATS).map(id=>[id,SEQUENCE.filter(f=>f===id).length]));}
  return Object.freeze({FORMATS,SEQUENCE,PARTNER_BAYS,MODULE_COUNT,WALL_LENGTH_M,EXHIBIT_HEIGHT_M,
    MARGIN_M,GAP_M,PRICES,AISLE_STATIONS,AISLE_WIDTH_M,AISLE_LENGTH_M,AISLE_MAX_HEIGHT_M,
    formatForBay,slotsForBay,allWallSlots,mix});
});
