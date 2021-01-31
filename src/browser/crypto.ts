/// <reference lib="dom" />
import {Json} from "../types";

export interface EncryptedBytes {
    iv: Uint8Array;
    bytes: Uint8Array;
}

export interface BrowserCryptoParams {
    pbkdf2Params: Partial<Pbkdf2Params>;
    saltLength: number;
    aesParams: AesKeyGenParams;
    ivLength: number;
}

export class BrowserCrypto {
    public constructor(
        private readonly params: BrowserCryptoParams = {
            pbkdf2Params: {
                name: "PBKDF2",
                iterations: 100000,
                hash: "SHA-256",
            },
            saltLength: 16,
            aesParams: {
                name: "AES-GCM",
                length: 256,
            },
            ivLength: 12,
        }
    ) {
    }

    static encodeText(text: string): Uint8Array {
        return new TextEncoder().encode(text);
    }

    static decodeText(bytes: Uint8Array): string {
        return new TextDecoder().decode(bytes);
    }

    static encodeJson(json: Json): Uint8Array {
        return BrowserCrypto.encodeText(JSON.stringify(json));
    }

    static decodeJson(bytes: Uint8Array): Json {
        return JSON.parse(BrowserCrypto.decodeText(bytes));
    }

    static encodeEncryptedBytes(enc: EncryptedBytes): Uint8Array {
        const encoded = new Uint8Array(1 + enc.iv.length + enc.bytes.length);
        encoded.set([enc.iv.length], 0);
        encoded.set(enc.iv, 1);
        encoded.set(enc.bytes, 1 + enc.iv.length);
        return encoded;
    }

    static decodeEncryptedBytes(encoded: Uint8Array): EncryptedBytes {
        const ivLength = encoded[0] as number;
        const iv = encoded.slice(1, 1 + ivLength);
        const bytes = encoded.slice(1 + ivLength);
        return {iv, bytes};
    }

    /** Returns a crypto key derived from a secret password */
    public async derive(password: string): Promise<CryptoKey> {
        const salt = await this.generateSalt();
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            BrowserCrypto.encodeText(password),
            this.params.pbkdf2Params as Algorithm,
            false,
            ["deriveBits", "deriveKey"]
        );
        return await window.crypto.subtle.deriveKey(
            {...this.params.pbkdf2Params, salt} as Pbkdf2Params,
            keyMaterial,
            this.params.aesParams,
            true,
            ["encrypt", "decrypt"]
        );
    }

    /** Returns a randomly generated crypto key */
    public async generate(): Promise<CryptoKey> {
        return await window.crypto.subtle.generateKey(this.params.aesParams, true, [
            "encrypt",
            "decrypt",
        ]);
    }

    /** Returns exported crypto key in serialisable jwt format  */
    public async export(key: CryptoKey): Promise<JsonWebKey> {
        return await window.crypto.subtle.exportKey("jwk", key);
    }

    /** Returns imported crypto key from jwt format */
    public async import(json: JsonWebKey): Promise<CryptoKey> {
        return await window.crypto.subtle.importKey(
            "jwk",
            json,
            this.params.aesParams,
            false,
            ["encrypt", "decrypt"]
        );
    }

    /** Returns encrypted bytes of bytes encrypted with key */
    public async encryptBytes(
        key: CryptoKey,
        bytes: Uint8Array
    ): Promise<EncryptedBytes> {
        const iv = await this.generateIv();
        const encrypted = await window.crypto.subtle.encrypt(
            {...this.params.aesParams, iv},
            key,
            bytes
        );
        return {iv, bytes: new Uint8Array(encrypted)};
    }

    /** Returns encrypted bytes of text encrypted with key */
    public async encryptText(
        key: CryptoKey,
        text: string
    ): Promise<EncryptedBytes> {
        return await this.encryptBytes(key, BrowserCrypto.encodeText(text));
    }

    /** Returns encrypted bytes of JSON encrypted with key */
    public async encryptJson(
        key: CryptoKey,
        json: Json
    ): Promise<EncryptedBytes> {
        return await this.encryptBytes(key, BrowserCrypto.encodeJson(json));
    }

    /** Returns decrypted bytes using key */
    public async decryptBytes(
        key: CryptoKey,
        encrypted: EncryptedBytes
    ): Promise<Uint8Array> {
        const decrypted = await window.crypto.subtle.decrypt(
            {...this.params.aesParams, iv: encrypted.iv},
            key,
            encrypted.bytes
        );
        return new Uint8Array(decrypted);
    }

    /** Returns decrypted text using key */
    public async decryptText(
        key: CryptoKey,
        encrypted: EncryptedBytes
    ): Promise<string> {
        return BrowserCrypto.decodeText(await this.decryptBytes(key, encrypted));
    }

    /** Returns decrypted JSON using key */
    public async decryptJson(
        key: CryptoKey,
        encrypted: EncryptedBytes
    ): Promise<Json> {
        return BrowserCrypto.decodeJson(await this.decryptBytes(key, encrypted));
    }

    /** The IV must never be reused with a given key, but does not have to be secret */
    private async generateIv(): Promise<Uint8Array> {
        return await window.crypto.getRandomValues(
            new Uint8Array(this.params.ivLength)
        );
    }

    private async generateSalt(): Promise<Uint8Array> {
        return await window.crypto.getRandomValues(
            new Uint8Array(this.params.saltLength)
        );
    }
}
