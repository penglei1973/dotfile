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
const server_1 = require("../server");
const utils_1 = require("./utils");
const utils_2 = require("../utils");
const vscode_1 = require("vscode");
const simpleRequest_1 = require("./simpleRequest");
class CompleterCommandResponse {
    static Create(obj) {
        if (obj.filepath) {
            return new YcmGoToResponse(obj);
        }
        else if (obj.message) {
            //TODO: other message responses?
            return new YcmGetTypeResponse(obj);
        }
        else if (obj.fixits) {
            return new YcmFixItResponse(obj);
        }
        //TODO: other messages
        utils_2.Log.Error("Unimplemented completer command response: ", obj);
    }
}
exports.CompleterCommandResponse = CompleterCommandResponse;
class CompleterCommandRequest extends simpleRequest_1.YcmSimpleRequest {
    constructor(loc, args) {
        super(loc);
        this.command_arguments = args;
    }
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let p = _super("Send").call(this, server, '/run_completer_command');
            let res = yield p;
            return CompleterCommandResponse.Create(res);
        });
    }
}
exports.CompleterCommandRequest = CompleterCommandRequest;
class YcmGoToResponse extends CompleterCommandResponse {
    constructor(obj) {
        super();
        if (obj instanceof Array) {
            //TODO:
            utils_2.Log.Info("Implement GoTo arrays!!!");
        }
        if (typeof obj.line_num !== "number" || typeof obj.column_num !== "number" ||
            typeof obj.filepath !== "string") {
            utils_2.Log.Error("GoToResponse constructor got ", obj);
            throw "unexpected object in GoTo response";
        }
        this.loc = new utils_1.YcmLocation(obj['line_num'], obj['column_num'], obj['filepath']);
    }
}
exports.YcmGoToResponse = YcmGoToResponse;
class YcmGoToRequest extends CompleterCommandRequest {
    constructor(loc) {
        super(loc, ["GoTo"]);
    }
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield _super("Send").call(this, server);
            if (res === null) {
                return null;
            }
            else if (!(res instanceof YcmGoToResponse)) {
                utils_2.Log.Error("GoToRequest returned unexpected response type: ", res);
                throw "GoTo request got unexpected type of response";
            }
            return res;
        });
    }
}
exports.YcmGoToRequest = YcmGoToRequest;
class YcmDefinitionProvider {
    provideDefinition(document, position) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let pServer = server_1.YcmServer.GetInstance();
                let req = new YcmGoToRequest(utils_1.YcmLocation.FromVscodePosition(document, position));
                let pResponse = req.Send(yield pServer);
                let response = yield pResponse;
                if (response === null) {
                    utils_2.Log.Info("Definition not found");
                    return null;
                }
                return (yield response.loc.GetVscodeLoc()).ToVscodeLocation();
            }
            catch (err) {
                utils_2.Log.Error("Error providing definition: ", err);
            }
        });
    }
}
exports.YcmDefinitionProvider = YcmDefinitionProvider;
class YcmGetTypeResponse extends CompleterCommandResponse {
    constructor(obj) {
        super();
        if (typeof obj.message !== "string") {
            utils_2.Log.Error("GetTypeResponse constructor got ", obj);
            throw "unexpected object in GetType response";
        }
        this.type = obj.message;
    }
}
exports.YcmGetTypeResponse = YcmGetTypeResponse;
class YcmGetTypeRequest extends CompleterCommandRequest {
    constructor(loc) {
        super(loc, ["GetType"]);
    }
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield _super("Send").call(this, server);
            if (res === null) {
                return null;
            }
            else if (!(res instanceof YcmGetTypeResponse)) {
                utils_2.Log.Error("GetTypeRequest returned unexpected response type: ", res);
                throw "GetType request got unexpected type of response";
            }
            return res;
        });
    }
}
exports.YcmGetTypeRequest = YcmGetTypeRequest;
class YcmGetTypeProvider {
    provideHover(document, position, token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let pServer = server_1.YcmServer.GetInstance();
                let req = new YcmGetTypeRequest(utils_1.YcmLocation.FromVscodePosition(document, position));
                let pResponse = req.Send(yield pServer);
                let response = yield pResponse;
                if (response === null) {
                    utils_2.Log.Info("Definition not found");
                    return null;
                }
                return new vscode_1.Hover({ language: document.languageId, value: response.type });
            }
            catch (err) {
                utils_2.Log.Error("Error providing definition: ", err);
                return null;
            }
        });
    }
}
exports.YcmGetTypeProvider = YcmGetTypeProvider;
class YcmFixIt {
    constructor(obj) {
        this.text = obj.text;
        this.location = obj.location;
        let chunks = obj.chunks;
        this.chunks = chunks.map(item => new YcmFixItChunk(item));
    }
    ToVscodeCodeAction() {
        return __awaiter(this, void 0, void 0, function* () {
            let action = new vscode_1.CodeAction(this.text, vscode_1.CodeActionKind.QuickFix);
            action.edit = new vscode_1.WorkspaceEdit();
            for (let chunk of this.chunks) {
                action.edit.replace(vscode_1.Uri.file(chunk.range.GetFilepath().normalizedPath), yield chunk.range.ToVscodeRange(), chunk.replacement_text);
            }
            return action;
        });
    }
}
exports.YcmFixIt = YcmFixIt;
class YcmFixItChunk {
    constructor(obj) {
        this.replacement_text = obj.replacement_text;
        this.range = utils_1.YcmRange.FromSimpleObject(obj.range);
    }
    ToVscodeTextEdit() {
        return __awaiter(this, void 0, void 0, function* () {
            return new vscode_1.TextEdit(yield this.range.ToVscodeRange(), this.replacement_text);
        });
    }
}
exports.YcmFixItChunk = YcmFixItChunk;
class YcmFixItResponse extends CompleterCommandResponse {
    constructor(obj) {
        super();
        if (!(obj.fixits instanceof Array)) {
            utils_2.Log.Error("YcmFixItResponse constructor got ", obj);
            throw "unexpected object in FixIt response";
        }
        let fixits = obj.fixits;
        this.fixits = fixits.map(item => new YcmFixIt(item));
    }
}
exports.YcmFixItResponse = YcmFixItResponse;
class YcmFixItRequest extends CompleterCommandRequest {
    constructor(loc) {
        super(loc, ["FixIt"]);
    }
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield _super("Send").call(this, server);
            if (res === null) {
                return null;
            }
            else if (!(res instanceof YcmFixItResponse)) {
                utils_2.Log.Error("FixItRequest returned unexpected response type: ", res);
                throw "FixIt request got unexpected type of response";
            }
            return res;
        });
    }
}
exports.YcmFixItRequest = YcmFixItRequest;
class YcmCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let req = new YcmFixItRequest(utils_1.YcmLocation.FromVscodePosition(document, range.start));
                let res = yield req.Send(yield server_1.YcmServer.GetInstance());
                if (res === null) {
                    return null;
                }
                return Promise.all(res.fixits.map(fixit => fixit.ToVscodeCodeAction()));
            }
            catch (err) {
                utils_2.Log.Error("Error providing definition: ", err);
                return null;
            }
        });
    }
}
exports.YcmCodeActionProvider = YcmCodeActionProvider;
//# sourceMappingURL=completerCommand.js.map