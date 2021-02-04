# bytesync

[![npm](https://img.shields.io/npm/v/bytesync.svg)](https://www.npmjs.com/package/bytesync)
[![npm](https://img.shields.io/npm/l/bytesync.svg)](https://github.com/mojzu/bytesync/blob/main/LICENCE)
![Rust CI](https://github.com/mojzu/bytesync/workflows/NPM%20CI/badge.svg?branch=main)

## Quickstart

```shell
npm install -g bytesync
export DEBUG="bytesync*"
bytesync-dev
```

## Developer

Run bytesync development server

```shell
npm run dev
```

Run bytesync browser test development server

```shell
npm run test-dev
```

Build all distribution files

```shell
npm run dist
```

Open distribution browser test in default browser

```shell
npm run test-open
```

Build and publish release

```shell
# Update version in package.json
npm run dist-publish
```

Read/write test results

| Browser           | Block Number | Block Size | Total Size | Read   | Write   |
| ----------------- | ------------ | ---------- | ---------- | ------ | ------- |
| Firefox (Desktop) | 256          | 512B       | 128kB      | 860ms  | 3423ms  |
| Firefox (Desktop) | 512          | 512B       | 256kB      | 1906ms | 6940ms  |
| Firefox (Desktop) | 256          | 1kB        | 256kB      | 876ms  | 3320ms  |
| Firefox (Desktop) | 1024         | 512B       | 512kB      | 3689ms | 14644ms |
| Firefox (Desktop) | 512          | 1kB        | 512kB      | 1857ms | 6448ms  |
| Firefox (Desktop) | 1024         | 1kB        | 1MB        | 3485ms | 13045ms |
| Firefox (Desktop) | 1            | 1MB        | 1MB        | 80ms   | 48ms    |
| Firefox (Desktop) | 64           | 1MB        | 64MB       | 2564ms | 3174ms  |
| Firefox (Desktop) | 128          | 1MB        | 128MB      | 4517ms | 6290ms  |
