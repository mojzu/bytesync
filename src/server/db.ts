import Database from "better-sqlite3";
import {
    BLOCK_INSERT,
    BLOCK_SELECT,
    CREATE_BLOCK_INSERT,
    CREATE_STACK_INSERT,
    CREATE_VERSION_INSERT,
    INFO_SELECT,
    INIT,
    SIZE_SELECT,
    STACK_SELECT,
    STACK_SIZE_SELECT,
    STACK_VERSION_SELECT,
    VACUUM,
    VACUUM_SELECT,
    VERSION_BLOCK_INSERT,
    VERSION_DELETE,
    VERSION_INSERT,
    VERSION_UPDATE
} from "./sql";
import {Block, SizeBlock, Stack, SizeVersion} from "../types";

const debug = require('debug')('bytesync:db');

export class Db {
    private readonly db = (new Database('bytesync.db')).exec(INIT);

    private readonly createStackInsert = this.db.prepare(CREATE_STACK_INSERT);
    private readonly createVersionInsert = this.db.prepare(CREATE_VERSION_INSERT);
    private readonly createBlockInsert = this.db.prepare(CREATE_BLOCK_INSERT);
    private readonly stackSelect = this.db.prepare(STACK_SELECT);
    private readonly stackVersionSelect = this.db.prepare(STACK_VERSION_SELECT);
    private readonly blockSelect = this.db.prepare(BLOCK_SELECT);
    private readonly infoSelect = this.db.prepare(INFO_SELECT);
    private readonly blockInsert = this.db.prepare(BLOCK_INSERT);
    private readonly versionUpdate = this.db.prepare(VERSION_UPDATE);
    private readonly versionInsert = this.db.prepare(VERSION_INSERT);
    private readonly versionBlockInsert = this.db.prepare(VERSION_BLOCK_INSERT);
    private readonly sizeSelect = this.db.prepare(SIZE_SELECT);
    private readonly stackSizeSelect = this.db.prepare(STACK_SIZE_SELECT);
    private readonly vacuumSelect = this.db.prepare(VACUUM_SELECT);
    private readonly versionDelete = this.db.prepare(VERSION_DELETE);

    private readonly createTransaction = this.db.transaction((args) => {
        this.createStackInsert.run(args);
        this.createVersionInsert.run(args);
        this.createBlockInsert.run(args);
        return this.stackSelect.get(args);
    });

    private readonly blockTransaction = this.db.transaction((args) => {
        this.blockInsert.run(args);
        this.versionUpdate.run(args);
        return this.stackSelect.get(args);
    });

    private readonly versionTransaction = this.db.transaction((args) => {
        this.versionInsert.run(args);
        this.versionBlockInsert.run(args);
        return this.stackSelect.get(args);
    });

    public create(uuid: string, info: string, data: ArrayBufferLike, hash: string): Stack {
        return this.createTransaction({uuid, info, data: Buffer.from(data), hash});
    }

    public read(uuid: string): Stack {
        return this.stackSelect.get({uuid});
    }

    public versionRead(uuid: string, version: number): Stack {
        const stack = this.stackVersionSelect.get({uuid, version});
        if (stack == null) {
            throw new Error(`Stack not found`);
        }
        return stack;
    }

    public blockRead(uuid: string, version: number, index: number): Block {
        const block = this.blockSelect.get({uuid, version, index});
        if (block == null) {
            throw new Error(`Block not found`);
        }
        return {...block, data: (block.data as Buffer).toString("base64")};
    }

    public infoRead(uuid: string, version: number): string {
        return this.infoSelect.get({uuid, version}).info;
    }

    public blockWrite(uuid: string, version: number, height: number, hash: string, data: ArrayBufferLike, blockHash: string, versionHash: string): Stack {
        return this.blockTransaction({uuid, version, height, hash, data: Buffer.from(data), blockHash, versionHash});
    }

    public versionWrite(uuid: string, version: number, hash: string, info: string, data: ArrayBufferLike, blockHash: string): Stack {
        return this.versionTransaction({uuid, version, hash, info, data: Buffer.from(data), blockHash})
    }

    public size(uuid?: string): SizeVersion[] | SizeBlock[] {
        if (uuid != null) {
            return this.stackSizeSelect.all({uuid}).map(x => ({...x, type: "size.block"}));
        }
        return this.sizeSelect.all({}).map(x => ({...x, type: "size.version"}));
    }

    public vacuum(): void {
        const versions = this.vacuumSelect.all({});
        for (const version of versions) {
            const id = version.id;
            const stack_id = version.stack_id;
            this.versionDelete.run({id, stack_id});
            debug(`Delete version from stack {uuid=${version.uuid}, version=${version.version}}`);
        }
        this.db.exec(VACUUM);
    }
}

export const DB = new Db();
