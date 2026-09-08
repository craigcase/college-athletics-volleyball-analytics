import { getDb, getFiles } from '../client';
import { id, nowIso } from '../../lib/ids';
import { sha256Hex, type SourceFamily } from '../../lib/ingestion/source-family';

export type StoredSource = { id:string; contentHash:string; objectKey:string; duplicate:boolean; sourceFamily:SourceFamily; lineageId:string };

export async function preserveSource(input:{ programId:string; bytes:Uint8Array; sourceFamily:SourceFamily; sourceUrl?:string; fileName?:string; contentType?:string; importedBy:string; lineageKey?:string; parserVersion:string }):Promise<StoredSource>{
  const db=getDb();
  const contentHash=await sha256Hex(input.bytes);
  const existing=await db.prepare('SELECT id,content_hash contentHash,object_key objectKey,lineage_id lineageId,source_family sourceFamily FROM source_artifacts WHERE program_id=? AND content_hash=?').bind(input.programId,contentHash).first<any>();
  if (existing) return { ...existing, duplicate:true };
  const lineageKey=input.lineageKey ?? `${input.sourceFamily}:${input.sourceUrl ? new URL(input.sourceUrl).hostname : 'upload'}`;
  let lineage=await db.prepare('SELECT id FROM source_lineages WHERE program_id=? AND lineage_key=?').bind(input.programId,lineageKey).first<{id:string}>();
  if (!lineage) {
    const lineageId=id('lineage');
    await db.prepare('INSERT INTO source_lineages(id,program_id,lineage_key,created_at) VALUES(?,?,?,?)').bind(lineageId,input.programId,lineageKey,nowIso()).run();
    lineage={id:lineageId};
  }
  const artifactId=id('source');
  const objectKey=`programs/${input.programId}/evidence/${contentHash}/${input.fileName ?? 'source'}`;
  // Preserve original bytes before parser/canonical writes.
  await getFiles().put(objectKey,input.bytes,{ httpMetadata:{ contentType:input.contentType ?? 'application/octet-stream' }, customMetadata:{ contentHash,sourceFamily:input.sourceFamily } });
  await db.prepare('INSERT INTO source_artifacts(id,program_id,lineage_id,source_family,source_url,original_filename,content_type,content_hash,object_key,parser_version,imported_at,imported_by_email) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(artifactId,input.programId,lineage.id,input.sourceFamily,input.sourceUrl ?? null,input.fileName ?? null,input.contentType ?? null,contentHash,objectKey,input.parserVersion,nowIso(),input.importedBy).run();
  return { id:artifactId,contentHash,objectKey,duplicate:false,sourceFamily:input.sourceFamily,lineageId:lineage.id };
}
