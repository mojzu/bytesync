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
import {Base64, Block, SizeBlock, SizeVersion, Stack, Uuid} from "../types";

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
        return this.intoStack(this.stackSelect.get(args));
    });

    private readonly blockTransaction = this.db.transaction((args) => {
        this.blockInsert.run(args);
        this.versionUpdate.run(args);
        return this.intoStack(this.stackSelect.get(args));
    });

    private readonly versionTransaction = this.db.transaction((args) => {
        this.versionInsert.run(args);
        this.versionBlockInsert.run(args);
        return this.intoStack(this.stackSelect.get(args));
    });

    public create(uuid: Uuid, info: Buffer, data: Buffer, hash: Buffer): Stack {
        return this.createTransaction({uuid, info, data, hash});
    }

    public read(uuid: Uuid): Stack {
        const stack = this.stackSelect.get({uuid});
        if (stack == null) {
            throw new Error(`Stack not found`);
        }
        return this.intoStack(stack);
    }

    public versionRead(uuid: Uuid, version: number): Stack {
        const stack = this.stackVersionSelect.get({uuid, version});
        if (stack == null) {
            throw new Error(`Stack not found`);
        }
        return this.intoStack(stack);
    }

    public blockRead(uuid: Uuid, version: number, index: number): Block {
        const block = this.blockSelect.get({uuid, version, index});
        if (block == null) {
            throw new Error(`Block not found`);
        }
        return this.intoBlock(block);
    }

    public infoRead(uuid: Uuid, version: number): Base64 {
        return (this.infoSelect.get({uuid, version}).info as Buffer).toString("base64");
    }

    public blockWrite(uuid: Uuid, version: number, height: number, hash: Buffer, data: Buffer,
                      blockHash: Buffer, versionHash: Buffer): Stack {
        return this.intoStack(this.blockTransaction({uuid, version, height, hash, data, blockHash, versionHash}));
    }

    public versionWrite(uuid: Uuid, version: number, hash: Buffer, info: Buffer,
                        data: Buffer, blockHash: Buffer): Stack {
        return this.intoStack(this.versionTransaction({uuid, version, hash, info, data, blockHash,}))
    }

    public size(uuid?: Uuid): SizeVersion[] | SizeBlock[] {
        if (uuid != null) {
            return this.stackSizeSelect.all({uuid}).map(x => ({
                ...x,
                hash: (x.hash as Buffer).toString("base64"),
                type: "size.block"
            }));
        }
        return this.sizeSelect.all({}).map(x => ({
            ...x,
            hash: (x.hash as Buffer).toString("base64"),
            type: "size.version"
        }));
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

    private intoStack(res: any): Stack {
        return {...res, hash: (res.hash as Buffer).toString("base64")};
    }

    private intoBlock(res: any): Block {
        return {
            ...res, data: (res.data as Buffer).toString("base64"),
            hash: (res.hash as Buffer).toString("base64")
        }
    }
}

export const DB = new Db();
