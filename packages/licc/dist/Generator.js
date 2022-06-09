const HEADER = "/* generated file, don't edit. */\n";
export class Generator {
    appender;
    code = "";
    imports = new Set();
    constructor(appender = (code) => this.code += code) {
        this.appender = appender;
    }
    line(code = "") {
        this.appender(code + "\n");
    }
    indent(indent = "\t") {
        return new Generator((code) => {
            this.appender(indent + code);
        });
    }
    addImport(imp) {
        this.imports.add(imp);
    }
    finish() {
        return HEADER + "\n" + Array.from(this.imports).join("\n") + "\n" + this.code;
    }
}
