import type { Conversation, Message } from "../types/index.js";
import type { Citation } from "../types/index.js";
import { query } from "../db/pool.js";

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as string,
    title: row.title as string,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    role: row.role as Message["role"],
    content: row.content as string,
    citations: (row.citations as Citation[] | null) ?? null,
    created_at: new Date(row.created_at as string),
  };
}

export class ConversationRepository {
  async create(title = "New conversation"): Promise<Conversation> {
    const result = await query<Record<string, unknown>>(
      `INSERT INTO conversations (title) VALUES ($1) RETURNING *`,
      [title],
    );
    return mapConversation(result.rows[0]);
  }

  async findById(id: string): Promise<Conversation | null> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM conversations WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async findAll(limit = 50, offset = 0): Promise<Conversation[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM conversations ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows.map(mapConversation);
  }

  async updateTitle(id: string, title: string): Promise<Conversation | null> {
    const result = await query<Record<string, unknown>>(
      `UPDATE conversations SET title = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, title],
    );
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async touch(id: string): Promise<void> {
    await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [id]);
  }

  async addMessage(data: {
    conversationId: string;
    role: Message["role"];
    content: string;
    citations?: Citation[] | null;
  }): Promise<Message> {
    const result = await query<Record<string, unknown>>(
      `INSERT INTO messages (conversation_id, role, content, citations)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.conversationId,
        data.role,
        data.content,
        data.citations ? JSON.stringify(data.citations) : null,
      ],
    );
    await this.touch(data.conversationId);
    return mapMessage(result.rows[0]);
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit],
    );
    return result.rows.map(mapMessage);
  }
}

export const conversationRepository = new ConversationRepository();
