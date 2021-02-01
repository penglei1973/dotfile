'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const simpleRequest_1 = require("./simpleRequest");
const utils_1 = require("../utils");
const utils_2 = require("./utils");
class YcmExtendedDiagnostic {
    constructor(firstArg, text) {
        if (typeof firstArg === "string") {
            let parsed = /(.+):(\d+):(\d+):(.+)/.exec(firstArg);
            this.text = parsed[4];
            let file = parsed[1];
            let row = parseInt(parsed[2], 10);
            let col = parseInt(parsed[3], 10);
            this.location = new utils_2.YcmLocation(row, col, file);
        }
        else {
            this.location = firstArg;
            this.text = text;
        }
    }
}
exports.YcmExtendedDiagnostic = YcmExtendedDiagnostic;
class YcmExtendedDiagnosticResponse {
    constructor(res) {
        let strings = res.split('\n');
        //first one is just the error message
        this.extendedDiags = strings.slice(1).map(msg => {
            return new YcmExtendedDiagnostic(msg);
        });
    }
}
exports.YcmExtendedDiagnosticResponse = YcmExtendedDiagnosticResponse;
class YcmExtendedDiagnosticRequest extends simpleRequest_1.YcmSimpleRequest {
    constructor(diagnostic) {
        super(diagnostic.location);
    }
    HandleException(err) {
        if (err.message === "No diagnostic for current line!") {
            //just return empty string to get an empty detailed diagnostic
            return { message: "" };
        }
    }
    //TODO: parse (locations and so on)
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.Log.Debug("Sending request for detailed diagnostics:");
            utils_1.Log.Trace(this);
            let p = _super("Send").call(this, server, "/detailed_diagnostic");
            return new YcmExtendedDiagnosticResponse((yield p).message);
        });
    }
}
exports.YcmExtendedDiagnosticRequest = YcmExtendedDiagnosticRequest;
//# sourceMappingURL=extendedDiagnostic.js.map