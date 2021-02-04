/// <reference lib="dom" />
import {Client, CRYPTO} from "../src/dom";
import {formatBlock, formatSize, formatStack, Json} from "../src/common/types";

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

function randomBytes(length = 512): Uint8Array {
    return Uint8Array.from({length}, () => Math.floor(Math.random() * 255));
}

async function testCrypto(): Promise<void> {
    const derivedKey = await CRYPTO.derive("guestguest");

    const key = await CRYPTO.generate();

    const exportedKey = await CRYPTO.export(key);

    const encryptedKey = await CRYPTO.encryptJson(derivedKey, exportedKey as Json);

    const decryptedKey = await CRYPTO.decryptJson(derivedKey, encryptedKey);
    if (JSON.stringify(decryptedKey) !== JSON.stringify(exportedKey)) {
        throw new Error(`Decrypt json key did not match input`);
    }

    const importedKey = await CRYPTO.import(decryptedKey as JsonWebKey);

    const text1 = "Hello, world!";
    const encryptedText = await CRYPTO.encryptText(importedKey, text1);
    const text2 = await CRYPTO.decryptText(importedKey, encryptedText);
    if (text2 !== text1) {
        throw new Error(`Decrypt text content did not match input`);
    }

    const json1: Json = {index: 0, arr: ["1", "2"]};
    const encryptedJson = await CRYPTO.encryptJson(importedKey, json1);
    const json2 = await CRYPTO.decryptJson(importedKey, encryptedJson);
    if (JSON.stringify(json2) !== JSON.stringify(json1)) {
        throw new Error(`Decrypt json content did not match input`);
    }
}

async function testClient(derivedKey: CryptoKey, client: Client): Promise<void> {
    const data: { [version: number]: Uint8Array[] } = {
        1: [randomBytes(), randomBytes(), randomBytes()],
        2: [randomBytes(), randomBytes(), randomBytes()],
    };

    // Create stack and write some blocks
    let stackInfo = await client.create(derivedKey, {user_data: 1}, data[1][0]);
    addOutput(`Created stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, data[1][1]);
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, data[1][2]);
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    // Synchronise stack from beginning with UUID
    const stackSave1 = stackInfo.stack;
    stackInfo.stack = {uuid: stackInfo.stack.uuid, version: 0, height: 0} as any;

    const syncFn1 = {
        block: async (stack: any, block: any) => {
            const dataCheck = Buffer.from(data[stack.version][block.index]).equals(Buffer.from(block.data, "base64"));
            if (!dataCheck) {
                throw new Error(`Output data does not match input`);
            }
            addOutput(`Synchronising block ${formatBlock(block)} from stack ${formatStack(stack)}`);
        },
        version: async (stack: any, info: any, block: any) => {
            const dataCheck = Buffer.from(data[stack.version][block.index]).equals(Buffer.from(block.data, "base64"));
            if (!dataCheck) {
                throw new Error(`Output data does not match input`);
            }
            addOutput(`Synchronising version '${JSON.stringify(info)}' ${formatBlock(block)} from stack ${formatStack(stack)}`);
        },
        cancel: async () => false,
    };

    stackInfo = await client.sync(derivedKey, stackInfo, syncFn1);
    if (stackInfo.stack.hash !== stackSave1.hash) {
        console.log(stackSave1, stackInfo.stack);
        throw new Error(`Stacks not synchronised`);
    }
    const stackSync1 = stackInfo.stack;
    addOutput(`Synchronised stack ${formatStack(stackInfo.stack)}`);

    // Write new version and some blocks
    stackInfo = await client.version(derivedKey, stackInfo, {user_data: 2}, data[2][0]);
    addOutput(`Wrote version to stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, data[2][1]);
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    stackInfo = await client.block(stackInfo, data[2][2]);
    addOutput(`Wrote block to stack ${formatStack(stackInfo.stack)}`);

    // Synchronise stack from last known
    stackInfo.stack = stackSync1;
    stackInfo = await client.sync(derivedKey, stackInfo, syncFn1);
    addOutput(`Synchronised stack ${formatStack(stackInfo.stack)}`);

    // Read from known block
    const block1 = await client.read(stackInfo, 0);
    addOutput(`Read block ${formatBlock(block1)} from stack ${formatStack(stackInfo.stack)}`);
    const dataCheck = Buffer.from(data[stackInfo.stack.version][block1.index]).equals(Buffer.from(block1.data, "base64"));
    if (!dataCheck) {
        throw new Error(`Output data does not match input`);
    }

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
    // TODO: Check not found, other invalid parameters
    // TODO: More tests here or framework for this?
    // TODO: Automate read/write test results and save as graph
}

async function testReadWrite(derivedKey: CryptoKey, client: Client, blockNum = 512, blockSize = 512): Promise<void> {
    const blockData = randomBytes(blockSize);
    let stackInfo = await client.create(derivedKey, {}, blockData);
    addOutput(`Created stack ${formatStack(stackInfo.stack)}`);

    addOutput(`Writing ${blockNum} blocks of size ${blockSize} to stack ${formatStack(stackInfo.stack)}`);
    let startTime = Date.now();
    for (let i = 0; i < blockNum; i++) {
        stackInfo = await client.block(stackInfo, blockData);
    }
    let endTime = Date.now();
    addOutput(`Finished writing ${blockNum} blocks in ${endTime - startTime}ms`);

    addOutput(`Reading ${blockNum} blocks of size ${blockSize} from stack ${formatStack(stackInfo.stack)}`);
    const syncFn = {
        block: async (stack: any, block: any) => {
        },
        version: async (stack: any, info: any, block: any) => {
        },
        cancel: async () => false,
    };

    startTime = Date.now();
    stackInfo.stack = {uuid: stackInfo.stack.uuid, version: 0, height: 0} as any;
    stackInfo = await client.sync(derivedKey, stackInfo, syncFn);
    endTime = Date.now();
    addOutput(`Finished reading ${blockNum} blocks in ${endTime - startTime}ms`);
}

(document.getElementById("test-button") as HTMLButtonElement)?.addEventListener("click", async () => {
    try {
        const endpoint = getEndpoint();
        const derivedKey = await CRYPTO.derive("guestguest");
        const client = new Client(endpoint, CRYPTO);

        addOutput(`Testing crypto`);
        await testCrypto();
        addOutput(`Testing client endpoint=${client.endpoint}`);
        await testClient(derivedKey, client);
        addOutput(`Testing read/write speed endpoint=${client.endpoint}`);
        await testReadWrite(derivedKey, client, 1, 1024 * 1024);
    } catch (err) {
        console.error(err);
        addOutput(String(err));
    }
});
