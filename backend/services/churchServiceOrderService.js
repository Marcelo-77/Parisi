const { query } = require('../config/database');

const TABLE = 'church_service_order';

function mapRow(row) {
  let worshipSongs = row.worship_songs;
  if (typeof worshipSongs === 'string') {
    try {
      worshipSongs = JSON.parse(worshipSongs);
    } catch {
      worshipSongs = [];
    }
  }
  if (!Array.isArray(worshipSongs)) worshipSongs = [];

  return {
    id: row.id,
    title: row.title,
    serviceDate: row.service_date,
    churchName: row.church_name,
    dirigente: row.dirigente,
    openingAct: row.opening_act,
    worshipSongs,
    scriptureReader: row.scripture_reader,
    praiseLeader: row.praise_leader,
    praiseStatus: row.praise_status,
    offeringsInstruction: row.offerings_instruction,
    messageSpeaker: row.message_speaker,
    closingPrayerLeader: row.closing_prayer_leader,
    priestlyBlessingLeader: row.priestly_blessing_leader,
    announcementsPosition: normalizePositionSelectValue(row.announcements_position, 8),
    scripturePosition: normalizePositionSelectValue(row.scripture_position, 4),
    createdBy: row.created_by,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

const POSITION_SELECT_VALUES = [1, 3, 4, 5, 6, 8, 9];

function normalizePositionSelectValue(value, fallback) {
  const parsed = parseInt(value, 10);
  const normalized = Number.isNaN(parsed) ? fallback : parsed;
  if (normalized === 2) return 3;
  if (normalized === 7) return 8;
  if (POSITION_SELECT_VALUES.includes(normalized)) return normalized;
  return fallback;
}

function normalizePayload(data) {
  const worshipSongs = Array.isArray(data.worshipSongs)
    ? data.worshipSongs.map((song) => String(song || '').trim()).filter(Boolean)
    : [];

  return {
    title: String(data.title || 'Ordem de Culto').trim(),
    serviceDate: data.serviceDate || null,
    churchName: data.churchName ? String(data.churchName).trim() : null,
    dirigente: data.dirigente ? String(data.dirigente).trim() : null,
    openingAct: data.openingAct ? String(data.openingAct).trim() : null,
    worshipSongs,
    scriptureReader: data.scriptureReader ? String(data.scriptureReader).trim() : null,
    praiseLeader: data.praiseLeader ? String(data.praiseLeader).trim() : null,
    praiseStatus: data.praiseStatus ? String(data.praiseStatus).trim() : null,
    offeringsInstruction: data.offeringsInstruction ? String(data.offeringsInstruction).trim() : null,
    messageSpeaker: data.messageSpeaker ? String(data.messageSpeaker).trim() : null,
    closingPrayerLeader: data.closingPrayerLeader ? String(data.closingPrayerLeader).trim() : null,
    priestlyBlessingLeader: data.priestlyBlessingLeader ? String(data.priestlyBlessingLeader).trim() : null,
    announcementsPosition: normalizePositionSelectValue(data.announcementsPosition, 8),
    scripturePosition: normalizePositionSelectValue(data.scripturePosition, 4)
  };
}

async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let param = 0;

  if (filters.serviceDateFrom) {
    param += 1;
    conditions.push(`service_date >= $${param}::date`);
    values.push(filters.serviceDateFrom);
  }

  if (filters.serviceDateTo) {
    param += 1;
    conditions.push(`service_date <= $${param}::date`);
    values.push(filters.serviceDateTo);
  }

  if (filters.dirigente) {
    param += 1;
    conditions.push(`dirigente ILIKE $${param}`);
    values.push(`%${filters.dirigente}%`);
  }

  if (filters.churchName) {
    param += 1;
    conditions.push(`church_name ILIKE $${param}`);
    values.push(`%${filters.churchName}%`);
  }

  if (filters.title) {
    param += 1;
    conditions.push(`title ILIKE $${param}`);
    values.push(`%${filters.title}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT *
     FROM ${TABLE}
     ${where}
     ORDER BY service_date DESC NULLS LAST, criado_em DESC`,
    values
  );

  return (result.rows || []).map(mapRow);
}

async function findById(id) {
  const result = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

async function create(data, createdBy) {
  const payload = normalizePayload(data);
  const result = await query(
    `INSERT INTO ${TABLE} (
      title, service_date, church_name, dirigente, opening_act, worship_songs,
      scripture_reader, praise_leader, praise_status, offerings_instruction,
      message_speaker, closing_prayer_leader, priestly_blessing_leader, announcements_position, scripture_position, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6::jsonb,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16
    )
    RETURNING *`,
    [
      payload.title,
      payload.serviceDate,
      payload.churchName,
      payload.dirigente,
      payload.openingAct,
      JSON.stringify(payload.worshipSongs),
      payload.scriptureReader,
      payload.praiseLeader,
      payload.praiseStatus,
      payload.offeringsInstruction,
      payload.messageSpeaker,
      payload.closingPrayerLeader,
      payload.priestlyBlessingLeader,
      payload.announcementsPosition,
      payload.scripturePosition,
      createdBy || null
    ]
  );

  return mapRow(result.rows[0]);
}

async function update(id, data) {
  const payload = normalizePayload(data);
  const result = await query(
    `UPDATE ${TABLE}
     SET title = $2,
         service_date = $3,
         church_name = $4,
         dirigente = $5,
         opening_act = $6,
         worship_songs = $7::jsonb,
         scripture_reader = $8,
         praise_leader = $9,
         praise_status = $10,
         offerings_instruction = $11,
         message_speaker = $12,
         closing_prayer_leader = $13,
         priestly_blessing_leader = $14,
         announcements_position = $15,
         scripture_position = $16,
         atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      id,
      payload.title,
      payload.serviceDate,
      payload.churchName,
      payload.dirigente,
      payload.openingAct,
      JSON.stringify(payload.worshipSongs),
      payload.scriptureReader,
      payload.praiseLeader,
      payload.praiseStatus,
      payload.offeringsInstruction,
      payload.messageSpeaker,
      payload.closingPrayerLeader,
      payload.priestlyBlessingLeader,
      payload.announcementsPosition,
      payload.scripturePosition
    ]
  );

  return result.rows.length ? mapRow(result.rows[0]) : null;
}

module.exports = {
  list,
  findById,
  create,
  update
};
