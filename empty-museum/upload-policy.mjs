/**
 * THE UNREAL MUSEUM — preflight checks for browser-local raster imports.
 * These checks protect the demo UI; server-side validation remains mandatory
 * before any uploaded content becomes public.
 */
const MIME = new Set(['image/jpeg','image/png','image/webp']);
const MAX_BYTES=15*1024*1024;
const MAX_SIDE=12000;
const MAX_PIXELS=32_000_000;

export function inspectRasterHeader(bytes){
  if(!(bytes instanceof Uint8Array))throw new TypeError('En-tête image invalide.');
  const is=(offset,values)=>values.every((v,i)=>bytes[offset+i]===v);
  if(bytes.length>=8 && is(0,[137,80,78,71,13,10,26,10]))return 'image/png';
  if(bytes.length>=3 && is(0,[255,216,255]))return 'image/jpeg';
  if(bytes.length>=12 && is(0,[82,73,70,70]) && is(8,[87,69,66,80]))return 'image/webp';
  return null;
}

export async function validateRasterFile(file){
  if(!file||typeof file.slice!=='function'||!Number.isSafeInteger(file.size)||
     file.size<12||file.size>MAX_BYTES)throw Error('Image vide, invalide ou supérieure à 15 Mo.');
  if(!MIME.has(file.type))throw Error('Utilisez une image JPG, PNG ou WebP.');
  const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(inspectRasterHeader(header)!==file.type)
    throw Error('Le contenu du fichier ne correspond pas à une image JPG, PNG ou WebP valide.');
  return file.type;
}

export function validateRasterDimensions(width,height){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
     width>MAX_SIDE||height>MAX_SIDE||width*height>MAX_PIXELS)
    throw Error('Image trop grande : 12 000 pixels par côté et 32 millions de pixels maximum.');
  return {width,height};
}
