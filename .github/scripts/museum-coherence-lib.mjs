import {posix as path} from 'node:path';

// Static references only: dynamic URLs are covered by real browser checks.
export function resolveLocalReference(sourcePath, reference) {
  if (typeof reference !== 'string' || !reference.trim()) return null;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#|\?)/i.test(reference)) return null;
  const pathname = reference.split(/[?#]/, 1)[0];
  if (!pathname || /[{}$]/.test(pathname)) return null;
  const resolved = path.normalize(path.join(path.dirname(sourcePath), pathname));
  if (resolved === '..' || resolved.startsWith('../')) {
    throw new Error('Reference escapes repository: '+sourcePath+' -> '+reference);
  }
  return resolved;
}

export function findStaticReferences(source, kind) {
  const references = new Set();
  if (kind === 'html') {
    for (const tag of source.match(/<(?:script|link|img)\b[^>]*>/gi) || []) {
      const attribute = tag.match(/\b(?:src|href)\s*=\s*(['"])(.*?)\1/i);
      if (attribute) references.add(attribute[2]);
    }
  } else if (kind === 'js') {
    const importPattern = /(?:\bimport\s*\(\s*|\bimport\s+[^;\n]{0,250}?\bfrom\s*|\bexport\s+[^;\n]{0,250}?\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"\n]+)\1/g;
    for (const match of source.matchAll(importPattern)) references.add(match[2]);
    const propertyPattern = /\.(?:src|href)\s*=\s*(['"])([^'"\n]+)\1/g;
    for (const match of source.matchAll(propertyPattern)) references.add(match[2]);
  } else {
    throw new Error('Unknown reference kind: '+kind);
  }
  return [...references];
}

export function auditStaticReferences(sourcePath, source, exists) {
  const kind = sourcePath.endsWith('.html') ? 'html' : 'js';
  const errors = [];
  for (const ref of findStaticReferences(source, kind)) {
    try {
      const target = resolveLocalReference(sourcePath, ref);
      if (target && !exists(target)) errors.push(sourcePath+': missing '+target+' (from '+ref+')');
    } catch (error) {
      errors.push(sourcePath+': '+error.message);
    }
  }
  return errors;
}
