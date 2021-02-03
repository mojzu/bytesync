/**
 * NOTICE: This file must be kept in sync with ../<lib>/crypto.ts
 * TODO: Find a cleaner way of handling dom/webworker type differences
 */
import {Crypto as CryptoIf, CryptoParams} from '../common/client/crypto';
import {Json} from "../common/types";

export class Crypto implements CryptoIf<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey> {
    public constructor(private readonly params: CryptoParams<Pbkdf2Params, AesKeyGenParams>) {
    }

    public async derive(password: string): Promise<CryptoKey> {
        const salt = await this.generateSalt();
        const keyMaterial = await self.crypto.subtle.importKey(
            "raw",
            encodeText(password),
            this.params.pbkdf2Params as Algorithm,
            false,
            ["deriveBits", "deriveKey"]
        );
        return await self.crypto.subtle.deriveKey(
            {...this.params.pbkdf2Params, salt} as Pbkdf2Params,
            keyMaterial,
            this.params.aesParams,
            true,
            ["encrypt", "decrypt"]
        );
    }

    public async generate(): Promise<CryptoKey> {
        const key = await self.crypto.subtle.generateKey(this.params.aesParams, true, [
            "encrypt",
            "decrypt",
        ])
        return key as CryptoKey;
    }

    public async export(key: CryptoKey): Promise<JsonWebKey> {
        return await self.crypto.subtle.exportKey("jwk", key);
    }

    public async import(json: JsonWebKey): Promise<CryptoKey> {
        return await self.crypto.subtle.importKey(
            "jwk",
            json,
            this.params.aesParams,
            false,
            ["encrypt", "decrypt"]
        );
    }

    public async encryptBytes(
        key: CryptoKey,
        bytes: Uint8Array
    ): Promise<Uint8Array> {
        const iv = await this.generateIv();
        const encrypted = await self.crypto.subtle.encrypt(
            {...this.params.aesParams, iv},
            key,
            bytes
        );
        return encodeEncryptedBytes({iv, bytes: new Uint8Array(encrypted)});
    }

    public async encryptText(
        key: CryptoKey,
        text: string
    ): Promise<Uint8Array> {
        return await this.encryptBytes(key, encodeText(text));
    }

    public async encryptJson(
        key: CryptoKey,
        json: Json
    ): Promise<Uint8Array> {
        return await this.encryptBytes(key, encodeJson(json));
    }

    public async decryptBytes(
        key: CryptoKey,
        encrypted: Uint8Array
    ): Promise<Uint8Array> {
        const decoded = decodeEncryptedBytes(encrypted);
        const decrypted = await self.crypto.subtle.decrypt(
            {...this.params.aesParams, iv: decoded.iv},
            key,
            decoded.bytes
        );
        return new Uint8Array(decrypted);
    }

    public async decryptText(
        key: CryptoKey,
        encrypted: Uint8Array
    ): Promise<string> {
        return decodeText(await this.decryptBytes(key, encrypted));
    }

    public async decryptJson(
        key: CryptoKey,
        encrypted: Uint8Array
    ): Promise<Json> {
        return decodeJson(await this.decryptBytes(key, encrypted));
    }

    private async generateIv(): Promise<Uint8Array> {
        return await self.crypto.getRandomValues(
            new Uint8Array(this.params.ivLength)
        );
    }

    private async generateSalt(): Promise<Uint8Array> {
        return await self.crypto.getRandomValues(
            new Uint8Array(this.params.saltLength)
        );
    }
}

export const CRYPTO_PARAMS: CryptoParams<Pbkdf2Params, AesKeyGenParams> = {
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
};

export const CRYPTO = new Crypto(CRYPTO_PARAMS);

interface EncryptedBytes {
    iv: Uint8Array;
    bytes: Uint8Array;
}

function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function decodeText(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

function encodeJson(json: Json): Uint8Array {
    return encodeText(JSON.stringify(json));
}

function decodeJson(bytes: Uint8Array): Json {
    return JSON.parse(decodeText(bytes));
}

function encodeEncryptedBytes(enc: EncryptedBytes): Uint8Array {
    const encoded = new Uint8Array(1 + enc.iv.length + enc.bytes.length);
    encoded.set([enc.iv.length], 0);
    encoded.set(enc.iv, 1);
    encoded.set(enc.bytes, 1 + enc.iv.length);
    return encoded;
}

function decodeEncryptedBytes(encoded: Uint8Array): EncryptedBytes {
    const ivLength = encoded[0] as number;
    const iv = encoded.slice(1, 1 + ivLength);
    const bytes = encoded.slice(1 + ivLength);
    return {iv, bytes};
}
