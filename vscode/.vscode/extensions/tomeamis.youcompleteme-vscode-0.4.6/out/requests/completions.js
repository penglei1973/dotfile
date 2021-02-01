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
const vscode_1 = require("vscode");
const utils_1 = require("./utils");
const server_1 = require("../server");
const utils_2 = require("../utils");
const simpleRequest_1 = require("./simpleRequest");
class YcmCFamCompletionProvider {
    constructor(triggerStrings) {
        this.triggerStrings = triggerStrings;
    }
    TriggerCharShouldComplete(lineToCursor, triggerChar) {
        const includeRegexStart = "^\\s*#\\s*include\\s*%ToMatch%$";
        if (!this.triggerStrings.find(trigger => lineToCursor.endsWith(trigger))) {
            return false;
        }
        else if (triggerChar === "<" || triggerChar === "\"") {
            let regexStr = includeRegexStart.replace(/%ToMatch%/, triggerChar);
            if (!new RegExp(regexStr).test(lineToCursor)) {
                return false;
            }
        }
        else if (triggerChar === "/") {
            let regexStr = includeRegexStart.replace(/%ToMatch%/, "[<\"](?:.*)/");
            if (!new RegExp(regexStr).test(lineToCursor)) {
                return false;
            }
        }
        return true;
    }
    provideCompletionItems(document, position, token, context) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: use token
            utils_2.Log.Debug("provideCompletionItems: start");
            //if trigger char, figure out if we should really be triggered
            //TODO: trigger on " and <, only complete if part of include directive
            if (context.triggerKind == vscode_1.CompletionTriggerKind.TriggerCharacter) {
                let lineToCursor = document.getText(new vscode_1.Range(position.with({ character: 0 }), position));
                //if cursor is not preceded by one of the trigger sequences, just return null
                if (!this.TriggerCharShouldComplete(lineToCursor, context.triggerCharacter)) {
                    return null;
                }
            }
            //otherwise just continue
            let options = {};
            let pServer = server_1.YcmServer.GetInstance();
            let tracker = utils_2.ExtensionGlobals.editTracker;
            //check if we were invoked explicitly or just by the user typing
            if (context.triggerKind === vscode_1.CompletionTriggerKind.Invoke) {
                if (tracker.ShouldCompleteSemantic(document, position)) {
                    options.forceSemantic = true;
                }
            }
            else if (context.triggerKind === vscode_1.CompletionTriggerKind.TriggerForIncompleteCompletions) {
                options.forceSemantic = tracker.IsCompletingSemantic();
            }
            tracker.CompletionRequestDone();
            let req = new YcmCompletionsRequest(utils_1.YcmLocation.FromVscodePosition(document, position), options);
            let result = yield this.CompletionResponseToCompletionList(yield req.Send(yield pServer));
            //filter out items that would be filtered by vscode anyways
            result.items = result.items.filter(item => {
                //empty ranges are unfiltered
                if (item.range && item.range.isEmpty) {
                    return true;
                }
                let prefix = document.getText(item.range);
                let regexParts = prefix.split("");
                {
                    let start = regexParts[0];
                    regexParts[0] = `(^${start}|[a-z]${start.toUpperCase()}|_${start})`;
                    for (let i = 1; i < regexParts.length; ++i) {
                        regexParts[i] = `(${regexParts[i].toLowerCase()}|${regexParts[i].toUpperCase()})`;
                    }
                }
                let regex = new RegExp(regexParts.join(".*"));
                return regex.test(item.filterText || item.label);
            });
            if (result.items.length === 0) {
                result = yield this.CompletionResponseToCompletionList(yield req.RetryOnNoCompletions(yield pServer));
                //only start using semantic if it succeeds
                if (result.items.length !== 0) {
                    tracker.NonSemanticCompletionFailed();
                }
            }
            return result;
        });
    }
    CompletionResponseToCompletionList(response) {
        return __awaiter(this, void 0, void 0, function* () {
            let itemPromises = response.candidates.map(x => x.ToVscodeCompletionItem());
            //TODO: figure out if the list is really incomplete
            return new vscode_1.CompletionList(yield Promise.all(itemPromises), true);
        });
    }
}
exports.YcmCFamCompletionProvider = YcmCFamCompletionProvider;
class CompleterError {
    constructor(type) {
        this.type = type;
    }
}
class YcmCompletionsResponse {
    constructor(response, cursorPos) {
        //in case we got nothin'
        if (!response) {
            this.candidates = [];
            return;
        }
        let replaceRangeStart = new utils_1.YcmLocation(cursorPos);
        replaceRangeStart.column_num = response.completion_start_column;
        let replaceRange = new utils_1.YcmRange(replaceRangeStart, cursorPos);
        this.candidates = response.completions.map(candidate => new YcmCandidate(candidate, replaceRange));
        //TODO: errors
        if (this.candidates.length === 0) {
            let errs = response.errors;
            if (errs instanceof Array && errs.length > 0) {
                throw errs;
            }
        }
    }
}
exports.YcmCompletionsResponse = YcmCompletionsResponse;
class YcmCandidate {
    constructor(obj, completionRange) {
        this.completionRange = completionRange;
        this.insertion_text = obj.insertion_text;
        this.menu_text = obj.menu_text;
        this.extra_menu_info = obj.extra_menu_info;
        this.detailed_info = obj.detailed_info;
        this.kind = obj.kind;
        this.extra_data = obj.extra_data;
    }
    ToVscodeCompletionItem() {
        return __awaiter(this, void 0, void 0, function* () {
            let vscodeKind;
            switch (this.kind) {
                case "STRUCT":
                    vscodeKind = vscode_1.CompletionItemKind.Struct;
                    break;
                case "CLASS":
                    vscodeKind = vscode_1.CompletionItemKind.Class;
                    break;
                case "ENUM":
                    vscodeKind = vscode_1.CompletionItemKind.Enum;
                    break;
                case "TYPE":
                    vscodeKind = vscode_1.CompletionItemKind.Class;
                    break;
                case "MEMBER":
                    vscodeKind = vscode_1.CompletionItemKind.Field;
                    break;
                case "FUNCTION":
                    vscodeKind = vscode_1.CompletionItemKind.Function;
                    break;
                case "VARIABLE":
                    vscodeKind = vscode_1.CompletionItemKind.Variable;
                    break;
                case "MACRO":
                    vscodeKind = vscode_1.CompletionItemKind.Constant;
                    break;
                case "PARAMETER":
                    vscodeKind = vscode_1.CompletionItemKind.Variable;
                    break;
                case "NAMESPACE":
                    vscodeKind = vscode_1.CompletionItemKind.Module;
                    break;
            }
            let label = this.insertion_text;
            let result = new vscode_1.CompletionItem(label, vscodeKind);
            result.insertText = this.insertion_text;
            if (this.detailed_info) {
                result.detail = this.detailed_info;
            }
            else {
                result.detail = this.extra_menu_info;
            }
            result.range = yield this.completionRange.ToVscodeRange();
            return result;
        });
    }
}
exports.YcmCandidate = YcmCandidate;
class YcmCompletionsRequest extends simpleRequest_1.YcmSimpleRequest {
    //todo, figure out common points, how to inherit
    constructor(loc, additionalArgs = {}) {
        super(loc, additionalArgs);
        if (additionalArgs.forceSemantic) {
            this.force_semantic = true;
        }
    }
    RetryOnNoCompletions(server) {
        if (!this.force_semantic && utils_2.ExtensionGlobals.extConfig.fallbackToSemantic.value) {
            this.force_semantic = true;
            return this.Send(server);
        }
        return Promise.resolve(new YcmCompletionsResponse(undefined, this.GetLocation()));
    }
    Send(server) {
        const _super = name => super[name];
        return __awaiter(this, void 0, void 0, function* () {
            let p = _super("Send").call(this, server, '/completions');
            let res = yield p;
            try {
                let parsedRes = new YcmCompletionsResponse(res, _super("GetLocation").call(this));
                return parsedRes;
            }
            catch (err) {
                if (err instanceof Array) {
                    if (err.some(item => utils_1.isYcmExceptionResponse(item) && item.exception.TYPE === "RuntimeError" &&
                        item.message === "Still parsing file, no completions yet.")) {
                        utils_2.Log.Info("File already being parsed, retry after delay...");
                        //TODO: configurable delay
                        yield new Promise(res => setTimeout(res, utils_2.ExtensionGlobals.extConfig.reparseWaitDelay.value));
                        return this.Send(server);
                    }
                    else if (err.some(item => utils_1.isYcmExceptionResponse(item) && item.exception.TYPE === "UnicodeDecodeError")) {
                        utils_2.Log.Error("An include file contains non-UTF-8 completion data");
                        vscode_1.window.showErrorMessage("Current translation unit contains completion data that is not valid UTF-8. Completions cannot be supplied", { modal: false });
                        return new YcmCompletionsResponse(undefined, _super("GetLocation").call(this));
                    }
                }
                utils_2.Log.Error("Completions err: ", err);
            }
        });
    }
}
exports.YcmCompletionsRequest = YcmCompletionsRequest;
//# sourceMappingURL=completions.js.map