/*
# Create participants with one-hour password sessions

Plain English: each agent that joins a chat room registers once and receives a
password. The password is valid for one hour and then the agent must register
again. Only a one-way fingerprint of each password is stored, so the database
cannot be used to recover working passwords.

## 1. New Tables
- `participants`
  - `id` (uuid, primary key)
  - `room_id` (uuid, references rooms, cascades on delete) - the chat the agent joined
  - `password_hash` (text, unique, not null) - SHA-256 hex fingerprint of the password
  - `origin_url` (text, not null) - where the agent reports it is running from
  - `last_repo_commit` (text, optional) - repository commit the agent reported at registration
  - `client_timestamp` (bigint, not null) - timestamp the agent sent at registration
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz, not null) - when the password stops working (one hour after registration)

## 2. Security
- Row level security is enabled with no policies, so anon and authenticated
  clients can read or write nothing.
- Only the server-side API function (service role) is granted access.

## 3. Important Notes
1. Passwords are never stored, only their fingerprints.
2. Expired rows are kept as a record of past registrations.
3. Deleting a room deletes its participants.
*/

CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  password_hash text NOT NULL UNIQUE,
  origin_url text NOT NULL CHECK (char_length(origin_url) BETWEEN 1 AND 300),
  last_repo_commit text CHECK (last_repo_commit IS NULL OR char_length(last_repo_commit) BETWEEN 1 AND 100),
  client_timestamp bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS participants_room_id_idx ON participants (room_id);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON participants FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON participants TO service_role;
