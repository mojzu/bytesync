import {Client as BaseClient, SyncFn} from "../client";
import {Crypto} from "./crypto";
import {base64ToUint8Array, Block, Json, ResponseSize, ResponseVacuum, Stack} from "../types";

export interface StackInfo {
    stack: Stack;
    info: Json;
}

export class Client {
    private readonly client: BaseClient;

    public constructor(public readonly endpoint: string, private readonly crypto: Crypto) {
        this.client = new BaseClient(endpoint);
    }

    public async create(key: CryptoKey, info: Json, block: Uint8Array): Promise<StackInfo> {
        const infoKey = await this.crypto.generate();
        const infoKeyJson = await this.crypto.export(infoKey);
        const infoObj: Json = {info, key: infoKeyJson} as any;
        const infoEnc = await this.crypto.encryptJson(key, infoObj);
        const infoUi8 = Crypto.encodeEncryptedBytes(infoEnc);

        const blockEnc = await this.crypto.encryptBytes(infoKey, block);
        const blockUi8 = Crypto.encodeEncryptedBytes(blockEnc);

        const res = await this.client.create(infoUi8, blockUi8);
        return {stack: res.stack, info: infoObj};
    }

    public async sync(key: CryptoKey, stack: StackInfo, fn: SyncFn): Promise<StackInfo> {
        let infoObj: Json = stack.info;
        let infoKey = await this.stackKey(stack);

        const res = await this.client.sync(stack.stack, {
            version: async (stack, info, block) => {
                const infoUi8 = base64ToUint8Array(info);
                const infoEnc = Crypto.decodeEncryptedBytes(infoUi8);
                infoObj = await this.crypto.decryptJson(key, infoEnc);
                infoKey = await this.crypto.import((infoObj as any).key);

                const blockUi8 = base64ToUint8Array(block.data);
                const blockEnc = Crypto.decodeEncryptedBytes(blockUi8);
                const blockData = await this.crypto.decryptBytes(infoKey, blockEnc);

                await fn.version(stack, (infoObj as any).info, {...block, data: (blockData as any)});
            },
            block: async (stack, block) => {
                const blockUi8 = base64ToUint8Array(block.data);
                const blockEnc = Crypto.decodeEncryptedBytes(blockUi8);
                const blockData = await this.crypto.decryptBytes(infoKey, blockEnc);

                await fn.block(stack, {...block, data: (blockData as any)});
            },
            cancel: async () => fn.cancel(),
        });

        return {stack: res.stack, info: infoObj};
    }

    public async block(stack: StackInfo, block: Uint8Array): Promise<StackInfo> {
        const infoKey = await this.stackKey(stack);

        const blockEnc = await this.crypto.encryptBytes(infoKey, block);
        const blockUi8 = Crypto.encodeEncryptedBytes(blockEnc);

        const res = await this.client.block(stack.stack, blockUi8);
        return {...stack, stack: res.stack};
    }

    public async version(key: CryptoKey, stack: StackInfo, info: Json, block: Uint8Array): Promise<StackInfo> {
        const infoKey = await this.crypto.generate();
        const infoKeyJson = await this.crypto.export(infoKey);
        const infoObj: Json = {info, key: infoKeyJson} as any;
        const infoEnc = await this.crypto.encryptJson(key, infoObj);
        const infoUi8 = Crypto.encodeEncryptedBytes(infoEnc);

        const blockEnc = await this.crypto.encryptBytes(infoKey, block);
        const blockUi8 = Crypto.encodeEncryptedBytes(blockEnc);

        const res = await this.client.version(stack.stack, infoUi8, blockUi8);
        return {stack: res.stack, info: infoObj};
    }

    public async size(stack?: Stack): Promise<ResponseSize> {
        return this.client.size(stack);
    }

    public async read(stack: StackInfo, index: number): Promise<Block> {
        const infoKey = await this.stackKey(stack);

        const res = await this.client.read(stack.stack.uuid, stack.stack.version, index);
        const blockUi8 = base64ToUint8Array(res.block.data);
        const blockEnc = Crypto.decodeEncryptedBytes(blockUi8);
        const blockData = await this.crypto.decryptBytes(infoKey, blockEnc);

        return {...res.block, data: (blockData as any)}
    }

    public async vacuum(): Promise<ResponseVacuum> {
        return this.client.vacuum();
    }

    private stackKey(stack: StackInfo): Promise<CryptoKey> {
        return this.crypto.import((stack.info as any).key);
    }
}
