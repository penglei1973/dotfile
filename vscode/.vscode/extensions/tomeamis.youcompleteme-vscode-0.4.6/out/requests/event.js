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
const utils_1 = require("./utils");
const server_1 = require("../server");
const vscode_1 = require("vscode");
const simpleRequest_1 = require("./simpleRequest");
const extendedDiagnostic_1 = require("./extendedDiagnostic");
const utils_2 = require("../utils");
class YcmEventNotification extends simpleRequest_1.YcmSimpleRequest {
    constructor(loc, event_name) {
        super(loc);
        this.event_name = event_name;
    }
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield _super("Send").call(this, server, '/event_notification');
            return new YcmDiagnosticsResponse(res);
        });
    }
}
exports.YcmEventNotification = YcmEventNotification;
class YcmDiagnosticData {
    constructor(diagnostic) {
        this.ranges = diagnostic.ranges.map(x => utils_1.YcmRange.FromSimpleObject(x));
        this.location = utils_1.YcmLocation.FromSimpleObject(diagnostic.location);
        this.location_extent = utils_1.YcmRange.FromSimpleObject(diagnostic.location_extent);
        this.text = diagnostic.text;
        this.kind = diagnostic.kind;
        this.pExtendedDiags = this.RequestExtendedDiag();
        this.extendedDiags = null;
    }
    RequestExtendedDiag() {
        return __awaiter(this, void 0, void 0, function* () {
            let detailReq = new extendedDiagnostic_1.YcmExtendedDiagnosticRequest(this);
            return detailReq.Send(yield server_1.YcmServer.GetInstance());
        });
    }
    ResolveExtendedDiags() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pExtendedDiags !== null) {
                try {
                    this.extendedDiags = (yield this.pExtendedDiags).extendedDiags;
                }
                catch (e) {
                    utils_2.Log.Debug("Resolving extended diags failed: ", e);
                    this.extendedDiags = [];
                }
                this.pExtendedDiags = null;
            }
        });
    }
    SetExtendedDiags(diags) {
        this.pExtendedDiags = null;
        this.extendedDiags = diags;
    }
    GetExtendedDiags() {
        if (this.extendedDiags === null) {
            throw "Attempted to get extended diags before resolving them";
        }
        return this.extendedDiags;
    }
    ToVscodeDiagnostic() {
        return __awaiter(this, void 0, void 0, function* () {
            let kind = this.kind === "WARNING" ? vscode_1.DiagnosticSeverity.Warning : vscode_1.DiagnosticSeverity.Error;
            let result;
            result = new vscode_1.Diagnostic(yield this.location_extent.ToVscodeRange(), this.text, kind);
            try {
                //the diag must be complete when assigned to the collection.
                //assigning the related info afterwards doesn't work
                //OTOH, the diags are awaited in parallel, so ¯\_(ツ)_/¯
                let pDiags = this.extendedDiags.map((extendedDiag) => __awaiter(this, void 0, void 0, function* () {
                    return new vscode_1.DiagnosticRelatedInformation(new vscode_1.Location(vscode_1.Uri.file(extendedDiag.location.filepath.normalizedPath), (yield extendedDiag.location.GetVscodeLoc()).pos), extendedDiag.text);
                }));
                result.relatedInformation = yield Promise.all(pDiags);
            }
            catch (e) {
                //Exception. This is just extended info, so probably not important. 
                //Log as unimportant and otherwise ignore
                utils_2.Log.Debug("Creating extended diags failed: ", e);
            }
            return result;
        });
    }
}
exports.YcmDiagnosticData = YcmDiagnosticData;
class YcmDiagnosticsResponse {
    constructor(diagnostics) {
        if (diagnostics instanceof Array) {
            this.diagnostics = diagnostics.map(x => new YcmDiagnosticData(x));
        }
        else
            this.diagnostics = [];
    }
}
exports.YcmDiagnosticsResponse = YcmDiagnosticsResponse;
//# sourceMappingURL=event.js.map