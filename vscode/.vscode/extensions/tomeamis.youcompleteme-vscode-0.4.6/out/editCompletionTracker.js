"use strict";
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
const server_1 = require("./server");
const utils_2 = require("./requests/utils");
const event_1 = require("./requests/event");
'use strict';
class EditCompletionTracker {
    constructor() {
        this.lastTypedCharPos = null;
        this.lastEditTimers = {};
        this.completingSemantic = false;
    }
    HandleDocChange(change) {
        const ignoredFiletypes = ["Log"];
        let doc = change.document;
        if (ignoredFiletypes.find(x => x == doc.languageId)) {
            //just return, ignore completely
            //necessary, NO LOGGING MUST OCCUR when langId is "Log", otherwise it just
            //fires another Log change right away, which again triggers logging, and so on...
            return;
        }
        //if it's not a supported filetype, do nothing
        if (!this.CheckFiletype(doc.languageId)) {
            //just reset last typed char pos
            utils_1.Log.Trace("Edit not matching langId, resetting lastTypedPos");
            this.lastTypedCharPos = null;
            return;
        }
        //always track changes, even when still typing
        this.SetLastTypedCharPos(change);
        //if there is a timer on the doc, reset it
        if (this.lastEditTimers[doc.fileName]) {
            clearTimeout(this.lastEditTimers[doc.fileName]);
            this.lastEditTimers[doc.fileName] = undefined;
        }
        let timeout = utils_1.ExtensionGlobals.extConfig.reparseTimeout.value;
        this.lastEditTimers[doc.fileName] = setTimeout(() => this.SendDocReparseNotification(doc), timeout);
    }
    CheckFiletype(langId) {
        let filetypes = utils_1.ExtensionGlobals.extConfig.filetypes.value;
        return !!filetypes.find((type) => type == langId);
    }
    SetLastTypedCharPos(change) {
        if (!change.contentChanges.length) {
            utils_1.Log.Warning("HandleDocChange: Document change with no content changes");
            return;
        }
        this.ClearEditState();
        if (change.contentChanges.length > 1) {
            return;
        }
        let docChange = change.contentChanges[0];
        let cursorPos;
        if (docChange.rangeLength > 0) {
            if (docChange.text.length > 0 || docChange.rangeLength != 1) {
                this.completingSemantic = false;
                utils_1.Log.Debug("adding text or replacing range of len > 1");
                return;
            }
            else {
                cursorPos = docChange.range.start;
            }
        }
        else if (docChange.text.length > 1) {
            this.completingSemantic = false;
            utils_1.Log.Debug("added text of len > 1");
            return;
        }
        else {
            cursorPos = docChange.range.start.translate({ characterDelta: docChange.text.length });
        }
        this.lastTypedCharPos = new vscode_1.Location(change.document.uri, cursorPos);
        utils_1.Log.Debug("Last typed char: ", cursorPos);
        let delay = vscode_1.workspace.getConfiguration("editor", change.document.uri).get("quickSuggestionsDelay");
        //set timeout on this. If it doesn't come in the next delay+some ms, it probably won't come at all
        this.expectCompletionTimeout = setTimeout(() => {
            utils_1.Log.Debug("Starting last timeout");
            //first set timeout for delay+some, then set delay for another some to deal with scheduling weirdness
            this.expectCompletionTimeout = setTimeout(() => {
                utils_1.Log.Debug("Removing edit pos");
                this.completingSemantic = false;
                this.ClearEditState();
            }, 25);
        }, delay + 25);
    }
    ClearEditState() {
        if (this.expectCompletionTimeout) {
            clearTimeout(this.expectCompletionTimeout);
            this.expectCompletionTimeout = null;
        }
        this.lastTypedCharPos = null;
    }
    CompletionRequestDone() {
        utils_1.Log.Debug("Completion request done");
        this.ClearEditState();
    }
    ShouldCompleteSemantic(doc, pos) {
        utils_1.Log.Debug("Completing semantic: ", this.completingSemantic);
        this.completingSemantic = this.completingSemantic || !this.IsCompletionInvokedByEdit(doc, pos);
        return this.completingSemantic;
    }
    IsCompletingSemantic() {
        utils_1.Log.Debug("IsCompletingSemantic: ", this.completingSemantic);
        return this.completingSemantic;
    }
    /**
     * Informs the tracket that non-semantic completion failed and therefore should switch to semantic
     */
    NonSemanticCompletionFailed() {
        this.completingSemantic = true;
    }
    IsCompletionInvokedByEdit(doc, pos) {
        if (this.lastTypedCharPos) {
            let lastPos = this.lastTypedCharPos.range.start;
            if (this.lastTypedCharPos.uri.fsPath == doc.fileName &&
                this.PositionsEqual(lastPos, pos)) {
                utils_1.Log.Debug("Completion on edit: position matched to edit");
                return true;
            }
            else {
                utils_1.Log.Debug("Completion invoked: position not matched to edit");
                return false;
            }
        }
        utils_1.Log.Debug("Completion invoked: No edit recorded");
        return false;
    }
    PositionsEqual(pos1, pos2) {
        return pos1.line == pos2.line &&
            pos1.character == pos2.character;
    }
    SendDocReparseNotification(document) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.CheckFiletype(document.languageId)) {
                return;
            }
            let pServer = server_1.YcmServer.GetInstance();
            //as good as any
            let vscodePos = new vscode_1.Position(0, 0);
            let location = utils_2.YcmLocation.FromVscodePosition(document, vscodePos);
            {
                let notification = new event_1.YcmEventNotification(location, "FileReadyToParse");
                try {
                    let server = yield pServer;
                    let pResponse = notification.Send(server);
                    let response = yield pResponse;
                    utils_1.Log.Debug("FileReadyToParse response: ");
                    utils_1.Log.Trace(response);
                    utils_1.ExtensionGlobals.diags.AddDiagnostics(document.uri.fsPath, response.diagnostics);
                }
                catch (err) {
                    try {
                        err = JSON.parse(err);
                    }
                    catch (err) { }
                    utils_1.Log.Error(err);
                }
            }
        });
    }
}
exports.EditCompletionTracker = EditCompletionTracker;
//# sourceMappingURL=editCompletionTracker.js.map