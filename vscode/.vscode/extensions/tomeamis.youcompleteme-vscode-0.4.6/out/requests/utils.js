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
const server_1 = require("../server");
const load_extra_conf_1 = require("./load_extra_conf");
const utils_1 = require("../utils");
class VscodeLoc {
    ToVscodeLocation() {
        return new vscode_1.Location(vscode_1.Uri.file(this.filename), this.pos);
    }
}
exports.VscodeLoc = VscodeLoc;
var YcmFileDataMapKeeper;
(function (YcmFileDataMapKeeper) {
    let stData = {};
    function AddDoc(doc) {
        stData[doc.fileName] = { contents: doc.getText(), filetypes: [doc.languageId] };
    }
    function GetDataMap(requiredFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let filetypes = utils_1.ExtensionGlobals.extConfig.filetypes.value;
            let reqFilePresent = false;
            vscode_1.workspace.textDocuments.forEach(doc => {
                if (filetypes.find(filetype => filetype === doc.languageId)) {
                    if (doc.fileName === requiredFilePath.normalizedPath) {
                        reqFilePresent = true;
                    }
                    else if (!doc.isDirty) {
                        //only send dirty documents (unless they are the required document)
                        return;
                    }
                    AddDoc(doc);
                }
            });
            if (!reqFilePresent) {
                let nDoc = yield vscode_1.workspace.openTextDocument(requiredFilePath.normalizedPath);
                AddDoc(nDoc);
            }
            let nmap = {};
            //send dirty documents, required doc will be sent later
            vscode_1.workspace.textDocuments.filter(doc => doc.isDirty && doc.fileName !== requiredFilePath.normalizedPath).forEach(doc => nmap[doc.fileName] = stData[doc.fileName]);
            //add required doc
            nmap[requiredFilePath.receivedPath] = stData[requiredFilePath.normalizedPath];
            return nmap;
        });
    }
    YcmFileDataMapKeeper.GetDataMap = GetDataMap;
})(YcmFileDataMapKeeper = exports.YcmFileDataMapKeeper || (exports.YcmFileDataMapKeeper = {}));
class UtilGlobalState {
}
exports.UtilGlobalState = UtilGlobalState;
class YcmRange {
    constructor(first, end) {
        if (first instanceof YcmRange) {
            this.start = new YcmLocation(first.start);
            this.end = new YcmLocation(first.end);
        }
        else {
            this.start = first;
            this.end = end;
        }
    }
    static FromVscodeRange(doc, range) {
        return new YcmRange(YcmLocation.FromVscodePosition(doc, range.start), YcmLocation.FromVscodePosition(doc, range.end));
    }
    static FromSimpleObject(obj) {
        return new YcmRange(YcmLocation.FromSimpleObject(obj.start), YcmLocation.FromSimpleObject(obj.end));
    }
    Equals(other) {
        return this.start.Equals(other.start) &&
            this.end.Equals(other.end);
    }
    ToVscodeRange() {
        return __awaiter(this, void 0, void 0, function* () {
            let [start, end] = yield Promise.all([this.start.GetVscodeLoc(), this.end.GetVscodeLoc()]);
            return new vscode_1.Range(start.pos, end.pos);
        });
    }
    GetFilepath() {
        return this.start.filepath;
    }
}
exports.YcmRange = YcmRange;
/**
 * Class for paths from Ycmd. Can get either normalized path for normal use,
 * or path as received for further communication with Ycmd
 */
class YcmFilepath {
    constructor(filepath) {
        this.receivedPath = filepath;
        this.normalizedPath = vscode_1.Uri.file(filepath).fsPath;
    }
}
exports.YcmFilepath = YcmFilepath;
class YcmLocation {
    constructor(firstParam, col, path) {
        if (firstParam instanceof YcmLocation) {
            this.line_num = firstParam.line_num;
            this.column_num = firstParam.column_num;
            this.filepath = firstParam.filepath;
        }
        else {
            this.line_num = firstParam;
            this.column_num = col;
            this.filepath = new YcmFilepath(path);
        }
    }
    static FromVscodePosition(doc, pos) {
        let lineText = doc.lineAt(pos).text;
        utils_1.Log.Debug("Resolving vscode position ", pos, "in ", doc.fileName, " to YcmLocation");
        let col = StringOffsetToYcmOffset(lineText, pos.character);
        return new YcmLocation(pos.line + 1, col, doc.fileName);
    }
    static FromSimpleObject(obj) {
        return new YcmLocation(obj.line_num, obj.column_num, obj.filepath);
    }
    Equals(other) {
        return this.line_num === other.line_num &&
            this.column_num === other.column_num &&
            this.filepath.normalizedPath === other.filepath.normalizedPath;
    }
    GetVscodeLoc() {
        return __awaiter(this, void 0, void 0, function* () {
            let result = new VscodeLoc;
            let lineNum = this.line_num - 1;
            result.filename = this.filepath.normalizedPath;
            utils_1.Log.Debug("Resolving YcmLocation ", this, "to Vscode location");
            //sometimes ycmd returns this on diags in included files. Didn't figure out
            //how to reproduce, but leaving this in anyways
            if (this.column_num === 0 && this.filepath.receivedPath === "" && this.line_num === 0) {
                result.pos = new vscode_1.Position(0, 0);
            }
            else if (this.column_num <= 2) {
                result.pos = new vscode_1.Position(lineNum, this.column_num - 1);
            }
            else {
                let doc = vscode_1.workspace.textDocuments.find((val) => {
                    return val.fileName == this.filepath.normalizedPath;
                });
                if (!doc) {
                    let pDoc = new Promise((res, rej) => {
                        vscode_1.workspace.openTextDocument(this.filepath.normalizedPath).then(val => {
                            res(val);
                        }, reason => {
                            rej(reason);
                        });
                    });
                    doc = yield pDoc;
                }
                let lineText = doc.lineAt(lineNum).text;
                let charIndex = YcmOffsetToStringOffset(lineText, this.column_num);
                result.pos = new vscode_1.Position(lineNum, charIndex);
            }
            return result;
        });
    }
}
exports.YcmLocation = YcmLocation;
function YcmOffsetToStringOffset(text, offset) {
    let bytes = Buffer.from(text, 'utf-8');
    //go to 0-based
    offset -= 1;
    if (offset > bytes.length) {
        utils_1.Log.Error("Ycm offset greater than byte length: ", offset, ">", bytes.length);
        utils_1.Log.Debug("Line: ", text);
        //text length, to handle errors
        return text.length;
    }
    else if (offset == bytes.length) {
        return text.length;
    }
    let curOffset = 0;
    for (let pos = 0; pos < offset; pos += 1) {
        if (((bytes[pos] >> 6) & 0b11) != 0b10) {
            curOffset += 1;
        }
    }
    return curOffset;
}
function StringOffsetToYcmOffset(text, offset) {
    if (text.length < offset) {
        utils_1.Log.Error("String offset greater than string length: ", offset, ">", text.length);
        utils_1.Log.Debug("Line: ", text);
        throw "String offset greater than input length";
    }
    let bytes = Buffer.from(text, 'utf-8');
    //if offset points to end of string, return end of buffer
    if (text.length == offset) {
        //+1 for 1-based indexing
        return bytes.length + 1;
    }
    let pos = 0;
    //last +1 takes care of 1-based indexing
    for (let curOffset = 0; curOffset <= offset; pos += 1) {
        if (((bytes[pos] >> 6) & 0b11) != 0b10) {
            curOffset += 1;
        }
    }
    return pos;
}
function isYcmExceptionResponse(arg) {
    return 'exception' in arg &&
        'message' in arg &&
        'traceback' in arg;
}
exports.isYcmExceptionResponse = isYcmExceptionResponse;
function RememberLocalYcmExtraConfFile(path, blacklist = false) {
    return __awaiter(this, void 0, void 0, function* () {
        let settings = utils_1.ExtensionGlobals.localSettings;
        try {
            let list = yield (blacklist ? settings.extraConfBlacklist : settings.extraConfWhitelist);
            if (typeof list === "undefined") {
                list = [];
            }
            list.push(path);
            if (blacklist) {
                settings.SetExtraConfBlacklist(list);
            }
            else {
                settings.SetExtraConfWhitelist(list);
            }
        }
        catch (err) {
            utils_1.Log.Error("Error remembering extra conf file: ", err);
        }
    });
}
class ErrorHandler {
    /**
     * Tries to handle an error received from the server.
     * If the request should be retried, returns true
     * If the error should be logged/displayed, rethrows it
     *
     * @param err The error as an object
     * @returns True if the request should be retried, false otherwise
     */
    static HandleRequestError(err) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof this.watchedExtraConfs === "undefined") {
                this.watchedExtraConfs = new Set();
            }
            //check if the type matches
            if (!isYcmExceptionResponse(err)) {
                //type does not match, just return
                throw err;
                //TODO: implement file not found
            }
            let type = err.exception['TYPE'];
            if (type == "UnknownExtraConf") {
                //TODO: check black/whitelist
                let filename = err.exception['extra_conf_file'];
                let choice = undefined;
                if ((yield utils_1.ExtensionGlobals.localSettings.extraConfWhitelist).some(wlFile => wlFile === filename)) {
                    //whitelisted, go ahead and load
                    choice = "Load";
                }
                else if ((yield utils_1.ExtensionGlobals.localSettings.extraConfBlacklist).some(blFile => blFile === filename)) {
                    //leave undefined
                }
                else {
                    //ask what to do
                    choice = yield vscode_1.window.showErrorMessage(err.message, "Load", "Load and remember", "Blacklist");
                }
                if (typeof choice == "undefined") {
                    return false;
                }
                if (choice == "Load and remember") {
                    RememberLocalYcmExtraConfFile(filename, false);
                }
                else if (choice == "Blacklist") {
                    RememberLocalYcmExtraConfFile(filename, true);
                }
                //load the file
                if (choice.startsWith("Load")) {
                    if (!this.watchedExtraConfs.has(filename)) {
                        this.watchedExtraConfs.add(filename);
                        load_extra_conf_1.YcmLoadExtraConfRequest.WatchExtraConfForChanges(filename);
                    }
                    let extraConfReq = new load_extra_conf_1.YcmLoadExtraConfRequest(filename);
                    let extraConfLoaded = yield extraConfReq.Send(yield server_1.YcmServer.GetInstance());
                    if (extraConfLoaded.err) {
                        return this.HandleRequestError(extraConfLoaded.err);
                    }
                    else {
                        return true;
                    }
                }
            }
            else if (type == "RuntimeError") {
                if (err.message == "Can't jump to definition or declaration.") {
                    utils_1.Log.Info("GoTo lookup failed");
                    return false;
                }
                else if (err.message === "Still parsing file, no completions yet." || err.message === "File already being parsed.") {
                    utils_1.Log.Warning("Completions not returned, file is still parsing. If you are seeing this often, try increasing reparse interval.");
                    yield new Promise(res => setTimeout(res, utils_1.ExtensionGlobals.extConfig.reparseWaitDelay.value));
                    return true;
                }
                else {
                    utils_1.Log.Error("HandleRequestError: Unknown runtime error: ", err);
                    throw err;
                }
            }
            else if (type === "UnicodeDecodeError") {
                utils_1.Log.Error("An include file contains non-UTF-8 completion data");
                vscode_1.window.showErrorMessage("Current translation unit contains completion data that is not valid UTF-8. Completions cannot be supplied", { modal: false });
                return false;
            }
            else {
                utils_1.Log.Error("HandleRequestError: Unknown error: ", err);
                throw err;
            }
        });
    }
}
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=utils.js.map