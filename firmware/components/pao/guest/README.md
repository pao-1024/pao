# PAO wasm guest

The guest is XGo compiled to wasm32-wasip1. It runs inside WAMR in the PAO
firmware and reaches the board only through the host functions declared in
`hostapi.go`.

Build (from this directory):

```sh
XGOROOT=/path/to/xgo task firmware:guest
```

or, if the tools are not on `PATH`:

```sh
XGOROOT=/path/to/xgo \
XGO_BIN=/path/to/xgo \
TINYGO_BIN=/path/to/tinygo \
WASMOPT_BIN=/path/to/wasm-opt \
firmware/scripts/build_guest.sh
```

The generated `guest.wasm` is embedded into the `pao` component at build time.
