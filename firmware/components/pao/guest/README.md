# PAO wasm guest

The guest is XGo compiled to wasm32-wasip1. It runs inside WAMR in the PAO
firmware and reaches the board only through the host functions declared in
`hostapi.go`.

Build (from this directory):

```sh
XGOROOT=/path/to/xgo XGO_GOCMD=true xgo build -o /dev/null .
tinygo build -target=wasip1 -o guest.wasm .
```

The generated `guest.wasm` is embedded into the `pao` component at build time.
