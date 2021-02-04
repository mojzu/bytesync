/// <reference lib="webworker" />
import {CryptoClient} from "../common/client";

export * from "../dom/crypto";

export class Client extends CryptoClient<Pbkdf2Params, AesKeyGenParams, CryptoKey, JsonWebKey> {
}
