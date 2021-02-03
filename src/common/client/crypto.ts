import {Client as BaseClient, SyncFn} from "./base";
import {base64ToUint8Array, Block, Json, ResponseSize, ResponseVacuum, Stack} from "../types";

export interface StackInfo {
    stack: Stack;
    info: Json;
}

export interface CryptoParams<Pbkdf2Params, AesKeyGenParams> {
    pbkdf2Params: Partial<Pbkdf2Params>;
    saltLength: number;
    aesParams: AesKeyGenParams;
    ivLength: number;
}

export interface CryptoConstructor<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey> {
    new(params: CryptoParams<Pbkdf2Params, AesKeyGenParams>): Crypto<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey>;
}

export interface Crypto<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey> {
    /** Returns a crypto key derived from a secret password */
    derive(password: string): Promise<CryptoKey>;

    /** Returns a randomly generated crypto key */
    generate(): Promise<CryptoKey>;

    /** Returns exported crypto key in serialisable jwt format  */
    export(key: CryptoKey): Promise<JsonWebKey>;

    /** Returns imported crypto key from jwt format */
    import(json: JsonWebKey): Promise<CryptoKey>;

    /** Returns encrypted bytes of bytes encrypted with key */
    encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<Uint8Array>;

    /** Returns encrypted bytes of text encrypted with key */
    encryptText(key: CryptoKey, text: string): Promise<Uint8Array>;

    /** Returns encrypted bytes of JSON encrypted with key */
    encryptJson(key: CryptoKey, json: Json): Promise<Uint8Array>;

    /** Returns decrypted bytes using key */
    decryptBytes(key: CryptoKey, encrypted: Uint8Array): Promise<Uint8Array>;

    /** Returns decrypted text using key */
    decryptText(key: CryptoKey, encrypted: Uint8Array): Promise<string>

    /** Returns decrypted JSON using key */
    decryptJson(key: CryptoKey, encrypted: Uint8Array): Promise<Json>;
}

export class CryptoClient<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey> {
    private readonly client: BaseClient;

    public constructor(public readonly endpoint: string, private readonly crypto: Crypto<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey>) {
        this.client = new BaseClient(endpoint);
    }

    public async create(key: CryptoKey, info: Json, block: Uint8Array): Promise<StackInfo> {
        const infoKey = await this.crypto.generate();
        const infoKeyJson = await this.crypto.export(infoKey);
        const infoObj: Json = {info, key: infoKeyJson} as any;
        const infoUi8 = await this.crypto.encryptJson(key, infoObj);

        const blockUi8 = await this.crypto.encryptBytes(infoKey, block);

        const res = await this.client.create(infoUi8, blockUi8);
        return {stack: res.stack, info: infoObj};
    }

    public async sync(key: CryptoKey, stack: StackInfo, fn: SyncFn): Promise<StackInfo> {
        let infoObj: Json = stack.info;
        let infoKey = await this.stackKey(stack);

        const res = await this.client.sync(stack.stack, {
            version: async (stack, info, block) => {
                const infoEnc = base64ToUint8Array(info);
                infoObj = await this.crypto.decryptJson(key, infoEnc);
                infoKey = await this.crypto.import((infoObj as any).key);

                const blockEnc = base64ToUint8Array(block.data);
                const blockData = await this.crypto.decryptBytes(infoKey, blockEnc);

                await fn.version(stack, (infoObj as any).info, {...block, data: (blockData as any)});
            },
            block: async (stack, block) => {
                const blockEnc = base64ToUint8Array(block.data);
                const blockData = await this.crypto.decryptBytes(infoKey, blockEnc);

                await fn.block(stack, {...block, data: (blockData as any)});
            },
            cancel: async () => fn.cancel(),
        });

        return {stack: res.stack, info: infoObj};
    }

    public async block(stack: StackInfo, block: Uint8Array): Promise<StackInfo> {
        const infoKey = await this.stackKey(stack);

        const blockUi8 = await this.crypto.encryptBytes(infoKey, block);

        const res = await this.client.block(stack.stack, blockUi8);
        return {...stack, stack: res.stack};
    }

    public async version(key: CryptoKey, stack: StackInfo, info: Json, block: Uint8Array): Promise<StackInfo> {
        const infoKey = await this.crypto.generate();
        const infoKeyJson = await this.crypto.export(infoKey);
        const infoObj: Json = {info, key: infoKeyJson} as any;
        const infoUi8 = await this.crypto.encryptJson(key, infoObj);

        const blockUi8 = await this.crypto.encryptBytes(infoKey, block);

        const res = await this.client.version(stack.stack, infoUi8, blockUi8);
        return {stack: res.stack, info: infoObj};
    }

    public async size(stack?: Stack): Promise<ResponseSize> {
        return this.client.size(stack);
    }

    public async read(stack: StackInfo, index: number): Promise<Block> {
        const infoKey = await this.stackKey(stack);

        const res = await this.client.read(stack.stack.uuid, stack.stack.version, index);
        const blockEnc = base64ToUint8Array(res.block.data);
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
