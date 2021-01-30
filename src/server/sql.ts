export const INIT = `

BEGIN TRANSACTION;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS stack_table (
    -- Local ID
    "id" INTEGER PRIMARY KEY NOT NULL,
    -- Universally unique public identifier
    "uuid" TEXT NOT NULL,

    UNIQUE ("uuid")
);

CREATE TABLE IF NOT EXISTS version_table (
    -- Created timestamp
    "created" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    -- Updated timestamp
    "updated" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    -- Local ID
    "id" INTEGER PRIMARY KEY NOT NULL,
    -- Stack ID
    "stack_id" INTEGER NOT NULL,
    -- Version number
    "version" INTEGER NOT NULL,
    -- Serialised information (usable by clients for encryption)
    "info" TEXT NOT NULL,
    -- Number of blocks
    "height" INTEGER NOT NULL,
    -- Hash of hashes of block data
    "hash" TEXT NOT NULL,

    UNIQUE ("stack_id", "version"),
    FOREIGN KEY ("stack_id") 
        REFERENCES stack_table ("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION,
    CHECK ("version" > 0),
    CHECK ("height" > 0)
);

CREATE TABLE IF NOT EXISTS block_table (
    -- Created timestamp
    "created" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    -- Local ID
    "id" INTEGER PRIMARY KEY NOT NULL,
    -- Version ID
    "version_id" INTEGER NOT NULL,
    -- Block index
    "index" INTEGER NOT NULL,
    -- Block data blob
    "data" BLOB NOT NULL,
    -- Hash of block data (may be used for integrity checking)
    "hash" TEXT NOT NULL,

    UNIQUE ("version_id", "index"),
    FOREIGN KEY ("version_id") 
        REFERENCES version_table ("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION,
    CHECK ("index" >= 0)
);

COMMIT;

`;

export const VACUUM = `
VACUUM;
`;

export const CREATE_STACK_INSERT = `
INSERT INTO stack_table ("uuid")
VALUES (@uuid);
`;

export const CREATE_VERSION_INSERT = `
INSERT INTO version_table ("stack_id", "version", "info", "height", "hash")
SELECT st."id", 1, @info, 1, @hash
FROM stack_table AS st
WHERE st."uuid" = @uuid;
`;

export const CREATE_BLOCK_INSERT = `
INSERT INTO block_table ("version_id", "index", "data", "hash")
SELECT ve."id", 0, @data, @hash
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
AND ve."version" = 1;
`;

export const STACK_SELECT = `
SELECT
    st."uuid",
    ve."created",
    ve."updated",
    ve."version",
    ve."height",
    ve."hash"
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
ORDER BY ve."version" DESC
LIMIT 1
`;

export const STACK_VERSION_SELECT = `
SELECT
    st."uuid",
    ve."created",
    ve."updated",
    ve."version",
    ve."height",
    ve."hash"
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
AND ve."version" = @version
`;

export const BLOCK_SELECT = `
SELECT
    bl."created",
    bl."index",
    bl."data",
    bl."hash"
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
INNER JOIN block_table AS bl ON bl."version_id" = ve."id"
WHERE st."uuid" = @uuid
AND ve."version" = @version
AND bl."index" = @index
LIMIT 1
`;

export const INFO_SELECT = `
SELECT
    ve."info"
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
AND ve."version" = @version
`;

export const BLOCK_INSERT = `
INSERT INTO block_table ("version_id", "index", "data", "hash")
SELECT ve."id", ve."height", @data, @blockHash
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
AND ve."version" = @version
AND ve."height" = @height
AND ve."hash" = @hash;
`;

export const VERSION_UPDATE = `
UPDATE version_table
SET
    "updated" = strftime('%s','now'),
    "height" = "height" + 1,
    "hash" = @versionHash
WHERE "id" = (
        SELECT ve."id"
        FROM stack_table AS st
        INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
        WHERE st."uuid" = @uuid
        AND ve."version" = @version
        AND ve."height" = @height
        AND ve."hash" = @hash
    );
`;

export const VERSION_INSERT = `
INSERT INTO version_table ("stack_id", "version", "info", "height", "hash")
SELECT st."id", ve."version" + 1, @info, 1, @blockHash
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
AND ve."version" = @version
AND ve."hash" = @hash;
`;

export const VERSION_BLOCK_INSERT = `
INSERT INTO block_table ("version_id", "index", "data", "hash")
SELECT ve."id", 0, @data, @blockHash
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
WHERE st."uuid" = @uuid
AND ve."version" = @version + 1;
`;

export const SIZE_SELECT = `
SELECT
    st."uuid",
    ve."created",
    ve."updated",
    ve."version",
    ve."height",
    ve."hash",
    sum(length(bl."data")) as "size"
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
INNER JOIN block_table AS bl ON bl."version_id" = ve."id"
GROUP BY st."uuid", ve."version"
`;

export const STACK_SIZE_SELECT = `
SELECT
    ve."version",
    bl."created",
    bl."index",
    bl."hash",
    length(bl."data") as "size"
FROM stack_table AS st
INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
INNER JOIN block_table AS bl ON bl."version_id" = ve."id"
WHERE st."uuid" = @uuid
`;

export const VACUUM_SELECT = `
SELECT ve."stack_id", ve."id", stv."uuid", ve."version"
FROM version_table AS ve
INNER JOIN (
        SELECT st."id", st."uuid", max(version) as "version"
        FROM stack_table AS st
        INNER JOIN version_table AS ve ON ve."stack_id" = st."id"
        GROUP BY st."uuid"
    ) AS stv ON stv."id" = ve."stack_id"
WHERE ve."version" < stv."version"
`;

export const VERSION_DELETE = `
DELETE FROM version_table
WHERE "id" = @id
AND "stack_id" = @stack_id
`;
