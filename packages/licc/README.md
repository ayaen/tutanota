# licc - the little interprocess communications compiler

usage info: type `licc --help`

## output

### structs

Structs are simply generated into the output directory as a single source file of the platform-appropriate language.

### facades

Facade definitions can lead to several output files, depending on the definitions `senders` and `receivers`
fields:

* **senders and receivers**: the interface containing all methods
* **senders**: one implementation of the interface in form of the `SendDispatcher`.
  It takes a transport instance that does the actual sending of the message and must be implemented manually.
* **receivers**: one `ReceiveDispatcher`. It takes the actual, working implementation of the interface during
  construction
  and dispatches to it.
* **additionally**, every platform that is on the receiving side of any facades gets one `GlobalDispatcher`
  implementation
  that dispatches to all receive dispatchers.

this leads to the following flow, with manually implemented components marked with `*`:

```
SENDING SIDE: *caller* => SendDispatcher => *outgoing transport*
RECEIVING SIDE: *incoming transport* => GlobalDispatcher => ReceiveDispatcher => *facade implementation*
```

Dispatch is achieved via string identifiers; the incoming transport will
call `GlobalDispatcher.dispatch("FacadeName", "methodName", arrayOfArgs)` which calls the ReceiveDispatcher
for `FacadeName` with `ReceiveDispatcher.dispatch("methodName", arrayOfArgs)`.
This call will be dispatched to the appropriate method as `facadeName.methodName(arrayOfArgs[0], ..., arrayOfArgs[-1])`.

## definition syntax

the schema format is described in `lib/common.ts`.
each schema is a JSON file with a single data type or facade definition.
the type (`struct` or `facade`) is given by the `type` property of the contained json object.
facades must have a `senders` and a `receivers` property listing the appropriate platforms.

**Note:** there is minimal validation. we don't detect duplicate method definitions or do a very good job to validate
type syntax.

### structs

struct fields are given as an object with `"fieldName": "fieldType"` properties.

### facades

method arg must be given as a list of single-property objects `[{"argname": "argtype"}, {"argname2": "argtype2"}]` to
preserve argument order.

supported types:

* nullable types, denoted with a `?` suffix: `string?`
* `List<elementType>`
* `Map<keyType, valueType>`
* the primitives listed in `dist/parser.ts`
* "external" types (the ones that don't fit any of the above but are otherwise valid identifiers)
* any combination of these

all type names must be valid identifiers in all supported output languages.

## Known issues

* struct definitions are generated for every language regardless if they're mentioned in that languages' generated
  files.
* it's theoretically possible two separate compilations of the same source files to yield different output because field
  order in json
  objects is not defined. this was not observed yet.