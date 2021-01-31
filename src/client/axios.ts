import {
    Base64,
    Block,
    bufferToBase64,
    isResponseBlock,
    isResponseCreate,
    isResponseSize,
    isResponseSync,
    isResponseVacuum,
    isResponseVersion,
    RequestBlock,
    RequestCreate,
    RequestRead,
    RequestSize,
    RequestSync,
    RequestVacuum,
    RequestVersion,
    ResponseBlock,
    ResponseCreate,
    ResponseSize,
    ResponseSync,
    ResponseVacuum,
    Stack,
    Uuid
} from "../types";
import axios from "axios";

export type BlockFn = (stack: Stack, block: Block) => Promise<void>;
export type VersionFn = (stack: Stack, info: Base64, block: Block) => Promise<void>;
export type SyncFn = { block: BlockFn, version: VersionFn };

export class Client {
    public constructor(public readonly endpoint: string) {
    }

    public async create(info: Uint8Array, block: Uint8Array): Promise<ResponseCreate> {
        return await axios.post(this.endpoint, <RequestCreate>{
            type: "request.create",
            info: bufferToBase64(info),
            block: bufferToBase64(block),
        }).then((res) => {
            if (isResponseCreate(res.data)) {
                return res.data;
            }
            throw res.data;
        });
    }

    public async sync(stack: Stack, fn: SyncFn): Promise<ResponseSync> {
        return await axios.post(this.endpoint, <RequestSync>{
            type: "request.sync",
            stack,
        }).then(async (res) => {
            if (isResponseSync(res.data)) {
                return res.data;
            }
            if (isResponseBlock(res.data)) {
                stack = {
                    ...stack,
                    updated: res.data.block.created,
                    height: stack.height + 1,
                };
                await fn.block(stack, res.data.block);
                return await this.sync(stack, fn);
            }
            if (isResponseVersion(res.data)) {
                stack = {
                    ...stack,
                    updated: res.data.block.created,
                    version: res.data.stack.version,
                    height: 1,
                    hash: res.data.block.hash,
                }
                await fn.version(stack, res.data.info, res.data.block);
                return await this.sync(stack, fn);
            }
            throw res.data;
        })
    }

    public async block(stack: Stack, block: Uint8Array): Promise<ResponseSync> {
        return await axios.post(this.endpoint, <RequestBlock>{
            type: "request.block",
            stack,
            block: bufferToBase64(block),
        }).then((res) => {
            if (isResponseSync(res.data)) {
                return res.data;
            }
            throw res.data;
        });
    }

    public async version(stack: Stack, info: Uint8Array, block: Uint8Array): Promise<ResponseSync> {
        return await axios.post(this.endpoint, <RequestVersion>{
            type: "request.version",
            stack,
            info: bufferToBase64(info),
            block: bufferToBase64(block),
        }).then((res) => {
            if (isResponseSync(res.data)) {
                return res.data;
            }
            throw res.data;
        });
    }

    public async size(stack?: Stack): Promise<ResponseSize> {
        return await axios.post(this.endpoint, <RequestSize>{
            type: "request.size",
            stack,
        }).then((res) => {
            if (isResponseSize(res.data)) {
                return res.data;
            }
            throw res.data;
        })
    }

    public async read(uuid: Uuid, version: number, index: number): Promise<ResponseBlock> {
        return await axios.post(this.endpoint, <RequestRead>{
            type: "request.read",
            stack: {uuid, version},
            block: {index},
        }).then((res) => {
            if (isResponseBlock(res.data)) {
                return res.data;
            }
            throw res.data;
        })
    }

    public async vacuum(): Promise<ResponseVacuum> {
        return await axios.post(this.endpoint, <RequestVacuum>{
            type: "request.vacuum",
        }).then((res) => {
            if (isResponseVacuum(res.data)) {
                return res.data;
            }
            throw res.data;
        })
    }
}
