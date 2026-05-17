import type { Chunk, ChunkWithScore } from "../types/index.js";
import { getClient, query } from "../db/pool.js";
import pgvector from "pgvector/pg";

function mapChunk(row: Record<string, unknown>): Chunk {
  return {
    id: row.id as string,
    document_id: row.document_id as string,
    content: row.content as string,
    chunk_index: Number(row.chunk_index),
    token_count: Number(row.token_count),
    created_at: new Date(row.created_at as string),
  };
}

export class ChunkRepository {
  async insertMany(
    documentId: string,
    items: Array<{ content: string; chunkIndex: number; tokenCount: number; embedding: number[] }>,
  ): Promise<void> {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      for (const item of items) {
        const embeddingSql = pgvector.toSql(item.embedding);
        await client.query(
          `INSERT INTO chunks (document_id, content, embedding, chunk_index, token_count)
           VALUES ($1, $2, $3::vector, $4, $5)
           ON CONFLICT (document_id, chunk_index) DO UPDATE
           SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, token_count = EXCLUDED.token_count`,
          [documentId, item.content, embeddingSql, item.chunkIndex, item.tokenCount],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async searchSimilar(
    embedding: number[],
    topK: number,
    documentIds?: string[],
  ): Promise<ChunkWithScore[]> {
    const embeddingSql = pgvector.toSql(embedding);
    const params: unknown[] = [embeddingSql, topK];
    let filterClause = "";

    if (documentIds && documentIds.length > 0) {
      params.push(documentIds);
      filterClause = `AND c.document_id = ANY($${params.length}::uuid[])`;
    }

    const result = await query<Record<string, unknown>>(
      `SELECT c.*, d.name AS document_name,
              1 - (c.embedding <=> $1::vector) AS similarity
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.embedding IS NOT NULL
         AND d.status = 'ready'
         ${filterClause}
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      params,
    );

    return result.rows.map((row) => ({
      ...mapChunk(row),
      document_name: row.document_name as string,
      similarity: Number(row.similarity),
    }));
  }

  async findByDocumentId(documentId: string): Promise<Chunk[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [documentId],
    );
    return result.rows.map(mapChunk);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await query(`DELETE FROM chunks WHERE document_id = $1`, [documentId]);
  }
}

export const chunkRepository = new ChunkRepository();
