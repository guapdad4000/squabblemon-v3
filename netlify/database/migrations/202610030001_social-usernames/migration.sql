BEGIN;
ALTER TABLE social_identities ADD COLUMN username text;
CREATE UNIQUE INDEX social_username_unique ON social_identities (username);
ALTER TABLE social_identities ADD CONSTRAINT social_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$');
ALTER TABLE social_identities ADD CONSTRAINT social_username_reserved CHECK (username NOT IN ('admin','administrator','system','support','moderator','mod','official','fadebook','squabblemon','deleted','null','undefined'));
COMMIT;