import {DB, Db} from "./db";
import {
    Base64,
    formatBlock,
    formatStack,
    isRequestBlock,
    isRequestCreate,
    isRequestRead,
    isRequestSize,
    isRequestSync,
    isRequestVacuum,
    isRequestVersion,
    Response,
    ResponseBlock,
    ResponseCreate,
    ResponseError,
    ResponseSize,
    ResponseSync,
    ResponseVacuum,
    ResponseVersion,
    Stack,
    Uuid
} from "../types";
import {v4 as uuidV4} from 'uuid';
import crypto from 'crypto';

const debug = require('debug')('bytesync:api');

function bufferFromBase64(block: Base64): ArrayBufferLike {
    const binaryStr = Buffer.from(block, 'base64').toString();
    const charCodes = binaryStr.split('').map((x) => x.charCodeAt(0));
    return Uint8Array.from(charCodes).buffer;
}

function sha256FromBuffer(block: ArrayBufferLike): string {
    return crypto.createHash("sha256").update(Buffer.from(block)).digest("hex");
}

function sha256FromHashes(hash1: string, hash2: string) {
    return crypto.createHash("sha256").update(hash1).update(hash2).digest("hex");
}

export interface Auth {
    hasCreatePermission(): Promise<boolean>;

    hasReadPermission(uuid?: Uuid): Promise<boolean>;

    hasBlockPermission(uuid: Uuid): Promise<boolean>;

    hasVersionPermission(uuid: Uuid): Promise<boolean>;

    hasVacuumPermission(): Promise<boolean>;
}

const AUTH_NONE: Auth = {
    hasCreatePermission: () => Promise.resolve(true),
    hasReadPermission: () => Promise.resolve(true),
    hasBlockPermission: () => Promise.resolve(true),
    hasVersionPermission: () => Promise.resolve(true),
    hasVacuumPermission: () => Promise.resolve(true),
};

class Api {
    constructor(private readonly db: Db) {
    }

    public async handleRequest(body: any, opt: {
        auth: Auth
    } = {auth: AUTH_NONE}): Promise<Response> {
        try {
            if (isRequestCreate(body) && (await opt.auth.hasCreatePermission())) {

                const uuid = uuidV4();
                const info = body.info;
                const data = bufferFromBase64(body.block);
                const hash = sha256FromBuffer(data);
                const stack = this.db.create(uuid, info, data, hash);

                debug(`Create stack ${formatStack(stack)}`);
                return <ResponseCreate>{type: "response.create", stack};

            } else if (isRequestBlock(body) && (await opt.auth.hasBlockPermission(body.stack.uuid))) {

                const uuid = body.stack.uuid;
                const version = body.stack.version;
                const height = body.stack.height;
                const hash = body.stack.hash;
                const data = bufferFromBase64(body.block);
                const blockHash = sha256FromBuffer(data);

                const stack2 = this.db.read(body.stack.uuid);
                const versionHash = sha256FromHashes(stack2.hash, blockHash);

                const stack = this.db.blockWrite(uuid, version, height, hash, data, blockHash, versionHash);
                debug(`Write block to stack ${formatStack(stack)}`);

                return this.handleSync(stack);

            } else if (isRequestVersion(body) && (await opt.auth.hasVersionPermission(body.stack.uuid))) {

                const uuid = body.stack.uuid;
                const version = body.stack.version;
                const hash = body.stack.hash;
                const info = body.info;
                const data = bufferFromBase64(body.block);
                const blockHash = sha256FromBuffer(data);

                const stack = this.db.versionWrite(uuid, version, hash, info, data, blockHash);
                debug(`Write version to stack ${formatStack(stack)}`);

                return this.handleSync(stack);

            } else if (isRequestSync(body) && (await opt.auth.hasReadPermission(body.stack.uuid))) {

                const stack = body.stack;
                return this.handleSync(stack);

            } else if (isRequestSize(body) && (await opt.auth.hasReadPermission(body.stack?.uuid))) {

                const uuid = body.stack?.uuid;
                const size = this.db.size(uuid);
                return <ResponseSize>{type: "response.size", size};

            } else if (isRequestRead(body) && (await opt.auth.hasReadPermission(body.stack.uuid))) {

                const uuid = body.stack.uuid;
                const version = body.stack.version;
                const index = body.block.index;

                const stack = this.db.versionRead(uuid, version);
                const block = this.db.blockRead(uuid, version, index);

                return <ResponseBlock>{type: "response.block", stack, block};

            } else if (isRequestVacuum(body) && (await opt.auth.hasVacuumPermission())) {

                this.db.vacuum();

                debug(`Vacuum stacks`);
                return <ResponseVacuum>{type: "response.vacuum"};

            }

            debug(`Request unknown`, body);
            return <ResponseError>{type: "response.error", error: "request not handled"};

        } catch (err) {

            debug(`Request error`, err);
            return <ResponseError>{type: "response.error", error: String(err)};

        }
    }

    private handleSync(stack: Stack): Response {
        const stack2 = this.db.read(stack.uuid);
        const versionMatch = stack.version === stack2.version;
        const heightMatch = stack.height === stack2.height;

        if (versionMatch && heightMatch) {

            debug(`Synchronise stack ${formatStack(stack)}`);
            return <ResponseSync>{type: "response.sync", stack: stack2};

        } else if (versionMatch) {

            const block = this.db.blockRead(stack2.uuid, stack2.version, stack.height);

            debug(`Synchronise block ${formatBlock(block)} from stack ${formatStack(stack)}`);
            return <ResponseBlock>{type: "response.block", stack: stack2, block};

        } else {

            const info = this.db.infoRead(stack2.uuid, stack2.version);
            const block = this.db.blockRead(stack2.uuid, stack2.version, 0);

            debug(`Synchronise version '${info}' ${formatBlock(block)} from stack ${formatStack(stack)}`);
            return <ResponseVersion>{type: "response.version", stack: stack2, info, block};

        }
    }
}

export const API = new Api(DB);
