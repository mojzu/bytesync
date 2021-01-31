/// <reference lib="dom" />

import {Client} from "../src/client";
import {BrowserClient, BrowserCrypto} from "../src/browser";
import {formatBlock, formatSize, formatStack} from "../src/types";

function getEndpoint(): string {
    const value = (document.getElementById("endpoint") as HTMLInputElement)?.value;
    if (value == null || value === "") {
        alert("Endpoint is undefined or empty");
    }
    return value;
}

function addOutput(text: string): void {
    const div = document.createElement("div");
    div.classList.add("line");
    div.innerText = text;
    document.getElementById("output")?.appendChild(div);
}

function randomBytes(): Uint8Array {
    return Uint8Array.from({length: 512}, () => Math.floor(Math.random() * 255));
}

async function testClient(derivedKey: CryptoKey, client: BrowserClient): Promise<void> {
    // Create stack and write some blocks
    let stackInfo = await client.create(derivedKey, {user_data: 1}, randomBytes());
    addOutput(`Created stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, randomBytes());
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, randomBytes());
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    // Synchronise stack from beginning with UUID
    const stackSave1 = stackInfo.stack;
    stackInfo.stack = {uuid: stackInfo.stack.uuid, version: 0, height: 0} as any;

    const syncFn1 = {
        block: async (stack: any, block: any) => {
            addOutput(`Synchronising block ${formatBlock(block)} from stack ${formatStack(stack)}`);
        },
        version: async (stack: any, info: any, block: any) => {
            addOutput(`Synchronising version '${JSON.stringify(info)}' ${formatBlock(block)} from stack ${formatStack(stack)}`);
        },
    };

    stackInfo = await client.sync(derivedKey, stackInfo, syncFn1);
    if (stackInfo.stack.hash !== stackSave1.hash) {
        console.log(stackSave1, stackInfo.stack);
        throw new Error(`Stacks not synchronised`);
    }
    const stackSync1 = stackInfo.stack;
    addOutput(`Synchronised stack ${formatStack(stackInfo.stack)}`);

    // Write new version and some blocks
    stackInfo = await client.version(derivedKey, stackInfo, {user_data: 2}, randomBytes());
    addOutput(`Wrote version to stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, randomBytes());
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, randomBytes());
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    // Synchronise stack from last known
    stackInfo.stack = stackSync1;
    stackInfo = await client.sync(derivedKey, stackInfo, syncFn1);
    addOutput(`Synchronised stack ${formatStack(stackInfo.stack)}`);

    // Read from known block
    const block1 = await client.read(stackInfo, 0);
    addOutput(`Read block ${formatBlock(block1)} from stack ${formatStack(stackInfo.stack)}`);

    // Read stack size information
    const res10 = await client.size();
    addOutput(`Read stack sizes [${formatSize(res10.size)}]`);

    // Read block size information for stack
    const res11 = await client.size(stackInfo.stack);
    addOutput(`Read stack ${formatStack(stackInfo.stack)} block sizes [${formatSize(res11.size)}]`);

    // Vacuum
    await client.vacuum();
    addOutput(`Vacuumed`);

    // TODO: Stack passphrases for sharing without just a UUID? Passphrase required to download key - key table?
    // TODO: Archiving/flattening stacks process?
    // TODO: Option to prevent version upgrade during sync?
    // TODO: Delete mechanisms, all old versions/versions within range? Or by time?
    // TODO: Create cannot have empty info/block
    // TODO: Check block data is written/read correctly
    // TODO: Check not found, other invalid parameters
    // TODO: More tests here or framework for this?
    // TODO: BrowserCrypto class tests
    // const derivedKey = await crypto.deriveKey("guestguest");
    // console.log("DERIVED_KEY", derivedKey);
    //
    // const key = await crypto.generateKey();
    // console.log("KEY", key);
    //
    // const exportedKey = await crypto.exportKey(key);
    // console.log("EXPORTED", exportedKey, JSON.stringify(exportedKey));
    //
    // const encryptedKey = await crypto.encryptJson(derivedKey, exportedKey);
    // console.log("ENCRYPTED_KEY", encryptedKey);
    //
    // const decryptedKey = await crypto.decryptJson(derivedKey, encryptedKey);
    // console.log("DECRYPTED_KEY", encryptedKey);
    //
    // const importedKey = await crypto.importKey(decryptedKey);
    // console.log("IMPORTED_KEY", importedKey);
    //
    // let text = "Hello, world!";
    // const encryptedText = await crypto.encryptText(importedKey, text);
    // console.log("ENCRYPTED_TEXT", encryptedText);
    //
    // text = await crypto.decryptText(importedKey, encryptedText);
    // console.log("DECRYPTED_TEXT", text);
    //
    // let json = { index: 0, arr: ["1", "2"] };
    // const encryptedJson = await crypto.encryptJson(importedKey, json);
    // console.log("ENCRYPTED_JSON", encryptedJson);
    //
    // json = await crypto.decryptJson(importedKey, encryptedJson);
    // console.log("DECRYPTED_JSON", json, JSON.stringify(json));
}

(document.getElementById("test-button") as HTMLButtonElement)?.addEventListener("click", async () => {
    const endpoint = getEndpoint();
    const innerClient = new Client(endpoint);
    const crypto = new BrowserCrypto();
    const derivedKey = await crypto.derive("guestGuest");
    const client = new BrowserClient(innerClient, crypto);

    addOutput(`Testing client endpoint=${innerClient.endpoint}`);
    testClient(derivedKey, client).catch((err) => console.error(err));
});
