/// <reference lib="dom" />

import {Client} from "../src/client";
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

async function testClient(client: Client): Promise<void> {
    // Create stack and write some blocks
    const res1 = await client.create("{1serialised_encrypted_signed_info}", randomBytes());
    let stack = res1.stack;
    addOutput(`Created stack ${formatStack(stack)}`);

    const res2 = await client.block(stack, randomBytes());
    stack = res2.stack;
    addOutput(`Wrote block to stack ${formatStack(stack)}`);

    const res3 = await client.block(stack, randomBytes());
    stack = res3.stack;
    addOutput(`Wrote block to stack ${formatStack(stack)}`);

    // Synchronise stack from beginning with UUID
    stack = {uuid: stack.uuid, version: 0, height: 0} as any;
    const syncFn1 = {
        block: async (stack: any, block: any) => {
            addOutput(`Synchronising block ${formatBlock(block)} from stack ${formatStack(stack)}`);
        },
        version: async (stack: any, info: any, block: any) => {
            addOutput(`Synchronising version '${info}' ${formatBlock(block)} from stack ${formatStack(stack)}`);
        },
    };

    const res4 = await client.sync(stack, syncFn1);
    stack = res4.stack;
    const stackSync1 = stack;
    addOutput(`Synchronised stack ${formatStack(stack)}`);

    // Write new version and some blocks
    const res5 = await client.version(stack, "{2serialised_encrypted_signed_info}", randomBytes());
    stack = res5.stack;
    addOutput(`Wrote version to stack ${formatStack(stack)}`);

    const res6 = await client.block(stack, randomBytes());
    stack = res6.stack;
    addOutput(`Wrote block to stack ${formatStack(stack)}`);

    const res7 = await client.block(stack, randomBytes());
    stack = res7.stack;
    addOutput(`Wrote block to stack ${formatStack(stack)}`);

    // Synchronise stack from last known
    stack = stackSync1;
    const res8 = await client.sync(stack, syncFn1);
    stack = res8.stack;
    addOutput(`Synchronised stack ${formatStack(stack)}`);

    // Read from known block
    const res9 = await client.read(stack.uuid, 1, 0);
    addOutput(`Read block ${formatBlock(res9.block)} from stack ${formatStack(res9.stack)}`);

    // Read stack size information
    const res10 = await client.size();
    addOutput(`Read stack sizes [${formatSize(res10.size)}]`);

    // Read block size information for stack
    const res11 = await client.size(stack);
    addOutput(`Read stack ${formatStack(stack)} block sizes [${formatSize(res11.size)}]`);

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
}

(document.getElementById("test-button") as HTMLButtonElement)?.addEventListener("click", () => {
    const endpoint = getEndpoint();
    const client = new Client(endpoint);
    addOutput(`Testing client endpoint=${client.endpoint}`);
    testClient(client).catch((err) => console.error(err));
});
