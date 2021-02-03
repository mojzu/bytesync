import {
    Base64,
    Block,
    bufferToBase64,
    isResponseBlock,
    isResponseCreate,
    isResponseError,
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
    ResponseError,
    ResponseSize,
    ResponseSync,
    ResponseVacuum,
    Stack,
    Uuid
} from "../types";
import axios from "axios";

export type BlockFn = (stack: Stack, block: Block) => Promise<void>;
export type VersionFn = (stack: Stack, info: Base64, block: Block) => Promise<void>;
export type CancelFn = () => Promise<boolean>;

/** Synchronise method callback functions parameter */
export interface SyncFn {
    /** New block received handler */
    block: BlockFn;
    /** New version received handler */
    version: VersionFn;
    /** Cancel synchronisation signal */
    cancel: CancelFn;
}

export class Client {
    /**
     * Base client constructor
     * @param endpoint HTTP endpoint
     */
    public constructor(public readonly endpoint: string) {
    }

    /**
     * Create one stack
     * @param info Initial version data
     * @param block Initial block data
     */
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

    /**
     * Synchronise target stack
     * @param stack Target stack
     * @param fn Callback functions
     */
    public async sync(stack: Stack, fn: SyncFn): Promise<ResponseSync> {
        let isCancelled = await fn.cancel();
        let stackCursor = stack;

        while (!isCancelled) {
            const response = await axios.post(this.endpoint, <RequestSync>{
                type: "request.sync",
                stack: stackCursor,
            });

            if (isResponseSync(response.data)) {
                return response.data;
            }

            if (isResponseBlock(response.data)) {
                stackCursor = {
                    ...stackCursor,
                    updated: response.data.block.created,
                    height: stackCursor.height + 1,
                };
                await fn.block(stackCursor, response.data.block);
            }

            if (isResponseVersion(response.data)) {
                stackCursor = {
                    ...stackCursor,
                    updated: response.data.block.created,
                    version: response.data.stack.version,
                    height: 1,
                    hash: response.data.block.hash,
                };
                await fn.version(stackCursor, response.data.info, response.data.block);
            }

            if (isResponseError(response.data)) {
                throw response.data;
            }

            isCancelled = await fn.cancel();
        }

        throw <ResponseError>{type: "response.error", error: "cancelled"};
    }

    /**
     * Write new block to target stack
     * This operation will fail if the target stack is not synchronised
     * @param stack Target stack
     * @param block Block data
     */
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

    /**
     * Write new version to target stack
     * This operation will fail if the target stack is not synchronised
     * @param stack Target stack
     * @param info Version data
     * @param block Block data
     */
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

    /**
     * Query stack sizes, or block sizes within a stack
     * @param stack Optional target stack
     */
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

    /**
     * Read block at index in target stack and version
     * @param uuid Target stack UUID
     * @param version Target stack version
     * @param index Block index
     */
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

    /** Delete stack versions that have been superseded by a new version */
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
