import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_STARTER_LAYOUT,
  type TemplateRecord,
  type V2Layout,
} from '@v2/shared';

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  layout_json: string;
  created_at: string;
  updated_at: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const configuredPath = process.env.SQLITE_PATH || './data/v2builder.db';
  const resolved = path.resolve(repoRoot, configuredPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      layout_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const existingCount = db
    .prepare('SELECT COUNT(*) as cnt FROM templates')
    .get() as { cnt: number };

  if (existingCount.cnt === 0) {
    db.prepare(
      `INSERT INTO templates (id, name, description, layout_json) VALUES (?, ?, ?, ?)`
    ).run(
      'deadlock-v2',
      'Deadlock Indo Inhouse Hub',
      'Production V2 announcement & role dispatcher card with container accent, section thumbnail, media gallery, buttons, and lane selector.',
      JSON.stringify(DEFAULT_STARTER_LAYOUT)
    );
  }

  dbInstance = db;
  return db;
}

function mapRow(row: TemplateRow): TemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    layout: JSON.parse(row.layout_json) as V2Layout,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTemplates(): TemplateRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM templates ORDER BY updated_at DESC')
    .all() as TemplateRow[];
  return rows.map(mapRow);
}

export function getTemplateById(id: string): TemplateRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM templates WHERE id = ?')
    .get(id) as TemplateRow | undefined;
  return row ? mapRow(row) : null;
}

export function createTemplate(
  id: string,
  name: string,
  description: string,
  layout: V2Layout
): TemplateRecord {
  getDb()
    .prepare(
      `INSERT INTO templates (id, name, description, layout_json) VALUES (?, ?, ?, ?)`
    )
    .run(id, name, description, JSON.stringify(layout));
  return getTemplateById(id)!;
}

export function updateTemplate(
  id: string,
  name: string,
  description: string,
  layout: V2Layout
): TemplateRecord | null {
  const res = getDb()
    .prepare(
      `UPDATE templates
       SET name = ?, description = ?, layout_json = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(name, description, JSON.stringify(layout), id);
  if (res.changes === 0) return null;
  return getTemplateById(id);
}

export function deleteTemplate(id: string): boolean {
  const res = getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
  return res.changes > 0;
}
