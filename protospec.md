`ppppp://invite` URIs are followed by any number of "commands", where each command has a name plus a fixed-length list of arguments.

## Inviting a new user to the network

**Invite URL:**

```
ppppp://invite/join/HOST/PORT/PUBKEY/TOKEN/follow/ALICE_ID/promise.follow/account.ALICE_ID/ALICE_TOKEN
```

made of 3 "commands":

- `join/HOST/PORT/PUBKEY/TOKEN`
  - Meaning "join" this hub at this address, claiming this token to become a member
- `follow/ALICE_ID`
  - Meaning that you should follow Alice
- `promise.follow/account.ALICE_ID/ALICE_TOKEN`
  - Meaning that Alice (ALICE_ID the `account`, not any single `pubkey`) promised to follow you back if you claim ALICE_TOKEN

```mermaid
sequenceDiagram

participant A as Alice
participant H as Hub
participant B as Bob

note over A: creates aliceToken<br />for follow promise
A->>A: publishes self-encrypted<br/>msg about aliceToken
A->>H: ask for hub token
activate H
H->>H: create hubToken
H-->>A: hubToken
deactivate H
A->>B: Externally: send invite URL
B->>H: HTTP: open URL
activate H
H-->>B: HTML with PPPPP invite URI
deactivate H
B->>B: open PPPPP app
note over B: parse URI and detect 3 commands
note over B: execute command "join"
B->>H: connect with hubToken in SHSe
activate H
H->>H: add Bob as member
H-->>B: OK
deactivate H
note over B: execute command "follow"
B->>B: follow aliceID
B->>H: muxrpc: connect to anyone online<br />and try to replicate aliceID
H-->>B: OK
note over B: execute command "promise.follow"
alt If some pubkey of aliceID is online
  B->>A: connect with SHS
  activate A
  B->>A: muxrpc: promise.follow(aliceToken, bobID)
  A->>A: detect aliceToken,<br />apply followback on bobID,<br />delete aliceToken
  A-->>B: OK
  deactivate A
end
```

## Inviting a new device to my account

**Invite URL:**

```
ppppp://invite/join/HOST/PORT/PUBKEY/TOKEN/tunnel-connect/HUB_PUBKEY/OLD_PUBKEY/promise.account-add/peer.PUBKEY/OLD_TOKEN/promise.account-internal-encryption-key/peer.PUBKEY/OLD_TOKEN
```

made of 3 "commands":

- `join/HOST/PORT/PUBKEY/TOKEN`
  - Meaning "join" this hub at this address, claiming this token
- `tunnel-connect/HUB_PUBKEY/OLD_PUBKEY`
  - Meaning that you should connect to the old device via a tunnel in the hub
- `promise.account-add/peer.PUBKEY/OLD_TOKEN` TODO implement with peer.PUBKEY
  - Meaning that the old device promised to add your pubkey if you claim OLD_TOKEN
- `promise.account-internal-encryption-key/peer.PUBKEY/OLD_TOKEN` TODO implement
  - Meaning that the old device promised to send you the internal encryption key

```mermaid
sequenceDiagram

participant O as Old device
participant H as Hub
participant N as New device

note over N: instruct user to create<br />an invite on the old
note over O: creates oToken<br />with account-add perm
O->>H: ask for hub token
activate H
H->>H: create hubToken
H-->>O: hubToken
deactivate H
O->>N: Externally: send invite URL or URI
N->>N: input URL or URI
note over N: parse URI and detect 3 commands
note over N: execute command "join"
N->>H: connect with hubToken in SHSe
activate H
H->>H: add New as member
H-->>N: OK
deactivate H
note over N: execute command "tunnel-connect"
alt If old pubkey is online
  N->>O: connect with SHS
  activate O
  note over N: execute command "promise.account-add"
  N->>N: consent = sign(":account-add:ACCOUNT_ID", new privkey)
  N->>O: muxrpc: promise.accountAdd(oToken, new pubkey, consent)
  O->>O: detect oToken,<br />apply account-add on New,<br />delete oToken
  O-->>N: OK
  deactivate O
else If Old is offline
  N->>O: connect with SHS
  O-->>N: Failure
end
```