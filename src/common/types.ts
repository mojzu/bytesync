import {Buffer} from "buffer";

export type Uuid = string;
export type Timestamp = number;
export type Base64 = string;
export type JsonPrimitive = string | number | boolean | null;

interface JsonMap extends Record<string, JsonPrimitive | JsonArray | JsonMap> {
}

interface JsonArray extends Array<JsonPrimitive | JsonArray | JsonMap> {
}

export type Json = JsonPrimitive | JsonMap | JsonArray;

export interface Stack {
    uuid: Uuid;
    created: Timestamp;
    updated: Timestamp;
    version: number;
    height: number;
    hash: Base64;
}

export interface Block {
    created: Timestamp;
    index: number;
    data: Base64;
    hash: Base64;
}

export interface SizeVersion extends Stack {
    type: "size.version";
    size: number;
}

export interface SizeBlock {
    type: "size.block";
    version: number;
    created: Timestamp;
    index: number;
    hash: Base64;
    size: number;
}

export function isSizeVersion(obj: any[]): obj is SizeVersion[] {
    if (obj.length > 0) {
        return obj[0].type === "size.version";
    }
    return false;
}

export function isSizeBlock(obj: any[]): obj is SizeBlock[] {
    if (obj.length > 0) {
        return obj[0].type === "size.block";
    }
    return false;
}

export interface RequestCreate {
    type: "request.create";
    info: Base64;
    block: Base64;
}

export interface RequestBlock {
    type: "request.block";
    stack: Stack;
    block: Base64;
}

export interface RequestVersion {
    type: "request.version";
    stack: Stack;
    info: Base64;
    block: Base64;
}

export interface RequestSync {
    type: "request.sync";
    stack: Stack;
}

export interface RequestSize {
    type: "request.size";
    stack?: Stack;
}

export interface RequestRead {
    type: "request.read";
    stack: Stack;
    block: Block;
}

export interface RequestVacuum {
    type: "request.vacuum";
}

export interface ResponseCreate {
    type: "response.create";
    stack: Stack;
}

export interface ResponseBlock {
    type: "response.block";
    stack: Stack;
    block: Block;
}

export interface ResponseVersion {
    type: "response.version";
    stack: Stack;
    info: Base64;
    block: Block;
}

export interface ResponseSync {
    type: "response.sync";
    stack: Stack;
}

export interface ResponseSize {
    type: "response.size";
    size: SizeVersion[] | SizeBlock[];
}

export interface ResponseVacuum {
    type: "response.vacuum";
}

export interface ResponseError {
    type: "response.error";
    error: string;
}

export type Request =
    | RequestCreate
    | RequestBlock
    | RequestVersion
    | RequestSync
    | RequestSize
    | RequestRead
    | RequestVacuum;

export type Response =
    | ResponseCreate
    | ResponseBlock
    | ResponseVersion
    | ResponseSync
    | ResponseSize
    | ResponseVacuum
    | ResponseError;

export function isRequest(obj: any): obj is Response {
    return (
        isRequestCreate(obj) ||
        isRequestBlock(obj) ||
        isRequestVersion(obj) ||
        isRequestSync(obj) ||
        isRequestSize(obj) ||
        isRequestRead(obj) ||
        isRequestVacuum(obj)
    );
}

export function isResponse(obj: any): obj is Response {
    return (
        isResponseCreate(obj) ||
        isResponseBlock(obj) ||
        isResponseVersion(obj) ||
        isResponseSync(obj) ||
        isResponseSize(obj) ||
        isResponseVacuum(obj) ||
        isResponseError(obj)
    );
}

export function isRequestCreate(obj: any): obj is RequestCreate {
    return obj.type === "request.create";
}

export function isRequestBlock(obj: any): obj is RequestBlock {
    return obj.type === "request.block";
}

export function isRequestVersion(obj: any): obj is RequestVersion {
    return obj.type === "request.version";
}

export function isRequestSync(obj: any): obj is RequestSync {
    return obj.type === "request.sync";
}

export function isRequestSize(obj: any): obj is RequestSize {
    return obj.type === "request.size";
}

export function isRequestRead(obj: any): obj is RequestRead {
    return obj.type === "request.read";
}

export function isRequestVacuum(obj: any): obj is RequestVacuum {
    return obj.type === "request.vacuum";
}

export function isResponseCreate(obj: any): obj is ResponseCreate {
    return obj.type === "response.create";
}

export function isResponseBlock(obj: any): obj is ResponseBlock {
    return obj.type === "response.block";
}

export function isResponseVersion(obj: any): obj is ResponseVersion {
    return obj.type === "response.version";
}

export function isResponseSync(obj: any): obj is ResponseSync {
    return obj.type === "response.sync";
}

export function isResponseSize(obj: any): obj is ResponseSize {
    return obj.type === "response.size";
}

export function isResponseVacuum(obj: any): obj is ResponseVacuum {
    return obj.type === "response.vacuum";
}

export function isResponseError(obj: any): obj is ResponseError {
    return obj.type === "response.error";
}

function formatString(s: string): string {
    return `${s.slice(0, Math.min(4, s.length))}...${s.slice(Math.max(s.length - 4, 0), s.length)}`
}

export function formatInfo(info: Base64): string {
    return formatString(info);
}

export function formatStack(stack: Stack): string {
    const props: string[] = [
        `uuid=${formatString(stack.uuid)}`,
        `version=${stack.version}`,
        `height=${stack.height}`,
        stack.hash != null ? `hash=${formatString(stack.hash)}` : '',
    ].filter((x) => x !== '');

    return `{${props.join(',')}}`
}

export function formatBlock(block: Block): string {
    const props: string[] = [
        `index=${block.index}`,
        `hash=${formatString(block.hash)}`,
        `data=${formatString(block.data)}`
    ].filter((x) => x !== '');

    return `{${props.join(',')}}`
}

export function formatSize(size: SizeVersion[] | SizeBlock[]): string {
    const props: string[] = [];

    if (isSizeVersion(size)) {
        props.push(...[
            `count=${size.length}`,
            `total=${size.map((x) => x.size).reduce((p, c) => p + c)}`,
        ].filter((x) => x !== ''));
    } else if (isSizeBlock(size)) {
        props.push(...[
            `count=${size.length}`,
            `total=${size.map((x) => x.size).reduce((p, c) => p + c)}`,
        ].filter((x) => x !== ''));
    }

    return `{${props.join(',')}}`;
}

export function bufferToBase64(buf: ArrayBufferLike): Base64 {
    // https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string
    return Buffer.from(buf).toString('base64');
}

export function base64ToBuffer(b64: Base64): Buffer {
    return Buffer.from(b64, "base64");
}

export function base64ToUint8Array(b64: Base64): Uint8Array {
    return Uint8Array.from(base64ToBuffer(b64));
}
