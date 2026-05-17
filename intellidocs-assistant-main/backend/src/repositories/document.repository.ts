import type { Document, DocumentStatus } from "../types/index.js";
import { query } from "../db/pool.js";

function mapRow(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    name: row.name as string,
    mime_type: row.mime_type as string,
    file_path: row.file_path as string,
    file_size: Number(row.file_size),
    status: row.status as DocumentStatus,
    error_message: (row.error_message as string) ?? null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

export class DocumentRepository {
  async create(data: {
    name: string;
    mimeType: string;
    filePath: string;
    fileSize: number;
  }): Promise<Document> {
    const result = await query<Record<string, unknown>>(
      `INSERT INTO documents (name, mime_type, file_path, file_size, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [data.name, data.mimeType, data.filePath, data.fileSize],
    );
    return mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Document | null> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM documents WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  /** Match UUID, exact filename, or partial filename (models often pass names instead of ids). */
  async resolveReference(
    reference: string,
    options?: { scopeIds?: string[]; readyOnly?: boolean },
  ): Promise<Document | null> {
    const ref = reference.trim();
    if (!ref) return null;

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(ref)) {
      return this.findById(ref);
    }

    const readyClause = options?.readyOnly ? "AND status = 'ready'" : "";
    const scopeIds = options?.scopeIds?.filter(Boolean);

    if (scopeIds && scopeIds.length > 0) {
      const exact = await query<Record<string, unknown>>(
        `SELECT * FROM documents
         WHERE id = ANY($1::uuid[])
           AND (LOWER(name) = LOWER($2) OR name ILIKE $3)
           ${readyClause}
         ORDER BY created_at DESC
         LIMIT 1`,
        [scopeIds, ref, `%${ref.replace(/[%_]/g, "")}%`],
      );
      if (exact.rows[0]) return mapRow(exact.rows[0]);
    }

    const exact = await query<Record<string, unknown>>(
      `SELECT * FROM documents
       WHERE LOWER(name) = LOWER($1)
       ${readyClause}
       ORDER BY created_at DESC
       LIMIT 1`,
      [ref],
    );
    if (exact.rows[0]) return mapRow(exact.rows[0]);

    const partial = await query<Record<string, unknown>>(
      `SELECT * FROM documents
       WHERE name ILIKE $1
       ${readyClause}
       ORDER BY created_at DESC
       LIMIT 1`,
      [`%${ref.replace(/[%_]/g, "")}%`],
    );
    return partial.rows[0] ? mapRow(partial.rows[0]) : null;
  }

  async findLatestReady(scopeIds?: string[]): Promise<Document | null> {
    if (scopeIds && scopeIds.length > 0) {
      const result = await query<Record<string, unknown>>(
        `SELECT * FROM documents
         WHERE id = ANY($1::uuid[]) AND status = 'ready'
         ORDER BY created_at DESC
         LIMIT 1`,
        [scopeIds],
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    }

    const result = await query<Record<string, unknown>>(
      `SELECT * FROM documents WHERE status = 'ready' ORDER BY created_at DESC LIMIT 1`,
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async findAll(limit = 50, offset = 0): Promise<Document[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM documents ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows.map(mapRow);
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    errorMessage?: string | null,
  ): Promise<Document | null> {
    const result = await query<Record<string, unknown>>(
      `UPDATE documents
       SET status = $2, error_message = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, errorMessage ?? null],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM documents WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const documentRepository = new DocumentRepository();
