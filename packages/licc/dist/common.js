export function getArgs(methName, methodDef) {
    return methodDef.arg.map((a, i) => {
        const entries = Object.entries(a);
        if (entries.length === 0) {
            throw new Error(`Syntax Error: method ${methName} argument ${i} is empty`);
        }
        else if (entries.length > 1) {
            throw new Error(`Syntax Error: method ${methName} argument ${i} has too many entries`);
        }
        return { "name": entries[0][0], "type": entries[0][1] };
    });
}
export function capitalize(input) {
    return input.replace(/^\w/, c => c.toUpperCase());
}
export function minusculize(input) {
    return input.replace(/^\w/, c => c.toLowerCase());
}
