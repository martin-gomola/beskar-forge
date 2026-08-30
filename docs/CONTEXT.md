# Domain context

## Field Notes

The reference workflow for a single operator recording observations while
offline. Notes are saved locally before synchronization.

## Field Notes session

The frontend module that owns Field Notes state, local edits, browser lifecycle
events, synchronization, and conflict actions. Its interface is the state and
actions consumed by the Field Notes screen.

## Field Notes adapter

The browser implementation that satisfies the Field Notes session interface.
It reads and writes IndexedDB, maintains the outbox and cursor, and sends
mutations to the owned sync transport.

## Update lifecycle

The frontend module that owns worker registration, periodic and visibility
checks, waiting-worker state, explicit activation, and the guarded reload.

## Runtime configuration

The host-port values in `config/.env`. Compose, Make, browser development
configuration, checks, and documentation consume or validate this source.
