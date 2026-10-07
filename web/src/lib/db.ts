import { app } from './app'

export const MIGRATIONS = [
  {
    name: '0001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id              TEXT PRIMARY KEY,
        email           TEXT,
        name            TEXT,
        photo_url       TEXT,
        role            TEXT CHECK (role IN ('client','mower','admin')),
        suburb          TEXT,
        postcode        TEXT,
        state           TEXT,
        country         TEXT,
        lat             REAL,
        lng             REAL,
        client_profile  TEXT,
        mower_profile   TEXT,
        street_group_id TEXT,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_suburb_postcode ON users(suburb, postcode);

      CREATE TABLE IF NOT EXISTS street_groups (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        street_name       TEXT,
        suburb            TEXT,
        postcode          TEXT,
        state             TEXT,
        country           TEXT,
        center_lat        REAL,
        center_lng        REAL,
        admin_ids         TEXT NOT NULL DEFAULT '[]',
        member_ids        TEXT NOT NULL DEFAULT '[]',
        assigned_mower_id TEXT,
        status            TEXT NOT NULL DEFAULT 'forming',
        created_at        INTEGER NOT NULL,
        updated_at        INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_street_groups_assigned_mower ON street_groups(assigned_mower_id);
      CREATE INDEX IF NOT EXISTS idx_street_groups_suburb_postcode ON street_groups(suburb, postcode);
      CREATE INDEX IF NOT EXISTS idx_street_groups_status ON street_groups(status);

      CREATE TABLE IF NOT EXISTS street_group_interests (
        id         TEXT PRIMARY KEY,
        group_id   TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        message    TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE (group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS mower_interests (
        id         TEXT PRIMARY KEY,
        group_id   TEXT NOT NULL,
        mower_id   TEXT NOT NULL,
        message    TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (mower_id, group_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mower_interests_group ON mower_interests(group_id);

      CREATE TABLE IF NOT EXISTS mower_interest_votes (
        interest_id TEXT NOT NULL,
        voter_id    TEXT NOT NULL,
        vote        INTEGER NOT NULL CHECK (vote IN (-1, 1)),
        created_at  INTEGER NOT NULL,
        PRIMARY KEY (interest_id, voter_id)
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id           TEXT PRIMARY KEY,
        group_id     TEXT NOT NULL,
        -- Sunday is 0 through Saturday 6; a time is 24-hour HH:MM.
        day_of_week  INTEGER,
        start_time   TEXT,
        mower_id     TEXT,
        status       TEXT NOT NULL DEFAULT 'planned',
        due_date     INTEGER,
        completed_at INTEGER,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_schedules_group ON schedules(group_id, day_of_week);
      CREATE INDEX IF NOT EXISTS idx_schedules_mower ON schedules(mower_id, due_date);

      CREATE TABLE IF NOT EXISTS mower_reviews (
        id          TEXT PRIMARY KEY,
        mower_id    TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        group_id    TEXT,
        schedule_id TEXT,
        rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mower_reviews_mower ON mower_reviews(mower_id);

      CREATE TABLE IF NOT EXISTS history_records (
        id           TEXT PRIMARY KEY,
        mower_id     TEXT NOT NULL,
        group_id     TEXT,
        schedule_id  TEXT,
        street_name  TEXT,
        area_sqm     INTEGER,
        duration_min INTEGER,
        income       INTEGER,
        date         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_mower ON history_records(mower_id, date);

      CREATE TABLE IF NOT EXISTS platform_config (
        id               TEXT PRIMARY KEY DEFAULT 'platform',
        default_currency TEXT
      );
    `,
  },
  {
    name: '0002_street_group_location_unique',
    // A street group is unique by suburb, postcode, and street name after
    // SQLite's lower(trim(...)) normalization. Keep this in sync with the
    // deployment migration in migrations.json and location validation below.
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_street_groups_location_normalized
        ON street_groups (
          lower(trim(COALESCE(suburb, ''))),
          lower(trim(COALESCE(postcode, ''))),
          lower(trim(COALESCE(street_name, '')))
        );
    `,
  },
  {
    name: '0003_constrain_group_and_schedule_statuses',
    // The deployment path allows additive DDL only. Keep legacy rows intact and
    // provide safe read projections while registered actions guard new writes.
    sql: `
      CREATE VIEW IF NOT EXISTS street_groups_compatible AS
        SELECT id, name, street_name, suburb, postcode, state, country,
          center_lat, center_lng, admin_ids, member_ids, assigned_mower_id,
          CASE WHEN status IN ('forming', 'active', 'paused', 'archived') THEN status ELSE 'forming' END AS status,
          created_at, updated_at
        FROM street_groups;
      CREATE VIEW IF NOT EXISTS schedules_compatible AS
        SELECT id, group_id,
          CASE WHEN day_of_week IS NULL OR (typeof(day_of_week) = 'integer' AND day_of_week BETWEEN 0 AND 6) THEN day_of_week ELSE NULL END AS day_of_week,
          CASE WHEN start_time IS NULL OR (typeof(start_time) = 'text' AND (start_time GLOB '[01][0-9]:[0-5][0-9]' OR start_time GLOB '2[0-3]:[0-5][0-9]')) THEN start_time ELSE NULL END AS start_time,
          mower_id,
          CASE WHEN status IN ('planned', 'done', 'skipped') THEN status ELSE 'planned' END AS status,
          due_date, completed_at, created_at, updated_at
        FROM schedules;
    `,
  },
  {
    name: '0004_public_mower_contact',
    // A mower must deliberately opt in before a client can ask for a contact
    // address. This is distinct from the private account email field.
    sql: `
      ALTER TABLE users ADD COLUMN public_contact_email TEXT CHECK (
        public_contact_email IS NULL OR (
          length(trim(public_contact_email)) <= 254
          AND trim(public_contact_email) NOT LIKE '% %'
          AND trim(public_contact_email) GLOB '*@*.*'
        )
      );
    `,
  },
  {
    name: '0005_photo_cleanup_ledger',
    // User-public R2 objects cannot participate in a D1 transaction. Keep an
    // additive, durable record of each object and of every requested cleanup,
    // so a network failure can never turn an account deletion into a permanent
    // public-photo leak. The authenticated owner drains their own queue.
    sql: `
      CREATE TABLE IF NOT EXISTS photo_objects (
        user_id     TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        PRIMARY KEY (user_id, storage_key)
      );
      CREATE INDEX IF NOT EXISTS idx_photo_objects_user ON photo_objects(user_id);

      CREATE TABLE IF NOT EXISTS photo_cleanup_jobs (
        user_id     TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        PRIMARY KEY (user_id, storage_key)
      );
      CREATE INDEX IF NOT EXISTS idx_photo_cleanup_jobs_user ON photo_cleanup_jobs(user_id);
    `,
  },
]

let migrated = false
export async function ensureMigrated(): Promise<void> {
  if (migrated) return
  try {
    // Raw `db.migrate` is restricted to the app's team since the platform's
    // cross-tenant SQL lockdown, so regular users get a 403 here — that's fine:
    // the schema is applied at deploy time (migrations.json) and by team-member
    // visits, so swallow the 403 and continue. Every user-facing read/write goes
    // through registered actions (see lib/actions.ts), not raw SQL.
    await app.db.migrate(MIGRATIONS)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('403')) throw err
  }
  migrated = true
}

// ============================================================================
// Row types — direct shape of D1 rows. Map to/from domain types in lib/*.ts.
// ============================================================================

export type Role = 'client' | 'mower' | 'admin'
export type StreetGroupStatus = 'forming' | 'active' | 'paused' | 'archived'
export type ScheduleStatus = 'planned' | 'done' | 'skipped'

export interface UserRow {
  id: string
  email: string | null
  public_contact_email: string | null
  name: string | null
  photo_url: string | null
  role: Role | null
  suburb: string | null
  postcode: string | null
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
  client_profile: string | null
  mower_profile: string | null
  street_group_id: string | null
  created_at: number
  updated_at: number
}

export interface StreetGroupRow {
  id: string
  name: string
  street_name: string | null
  suburb: string | null
  postcode: string | null
  state: string | null
  country: string | null
  center_lat: number | null
  center_lng: number | null
  admin_ids: string
  member_ids: string
  assigned_mower_id: string | null
  status: StreetGroupStatus
  created_at: number
  updated_at: number
}

export interface StreetGroupInterestRow {
  id: string
  group_id: string
  user_id: string
  message: string | null
  created_at: number
}

export interface MowerInterestRow {
  id: string
  group_id: string
  mower_id: string
  message: string | null
  created_at: number
  updated_at: number
}

export interface MowerInterestVoteRow {
  interest_id: string
  voter_id: string
  vote: -1 | 1
  created_at: number
}

export interface ScheduleRow {
  id: string
  group_id: string
  day_of_week: number | null
  start_time: string | null
  mower_id: string | null
  status: ScheduleStatus
  due_date: number | null
  completed_at: number | null
  created_at: number
  updated_at: number
}

export interface MowerReviewRow {
  id: string
  mower_id: string
  reviewer_id: string
  group_id: string | null
  schedule_id: string | null
  rating: number
  comment: string | null
  created_at: number
  updated_at: number
}

export interface HistoryRecordRow {
  id: string
  mower_id: string
  group_id: string | null
  schedule_id: string | null
  street_name: string | null
  area_sqm: number | null
  duration_min: number | null
  income: number | null
  date: number
}

export interface PlatformConfigRow {
  id: string
  default_currency: string | null
}
