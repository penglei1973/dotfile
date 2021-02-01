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
const editCompletionTracker_1 = require("./editCompletionTracker");
const diagnosticAggregator_1 = require("./diagnosticAggregator");
const fs = require("fs");
const extensionConfig_1 = require("./extensionConfig");
const JsonMemory = require("json-memory");
const path = require("path");
const makeDir = require("make-dir");
'use strict';
class PersistentDict {
    constructor(backingFile) {
        this.storage = new Promise((resolve, reject) => {
            let mem = new JsonMemory(backingFile, (err, obj) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(mem);
                }
            });
        }).catch(err => {
            if (typeof err === "string" && err.startsWith("ENOENT")) {
                return new JsonMemory(backingFile, false);
            }
            else
                throw `Opening PersistentDict backing file '${backingFile} failed.`;
        });
    }
    GetVal(key, defaultVal) {
        return __awaiter(this, void 0, void 0, function* () {
            let result;
            try {
                result = (yield this.storage)[key];
            }
            catch (err) { }
            if (typeof result === "undefined") {
                return defaultVal;
            }
            return result;
        });
    }
    SetVal(key, val, ensurePathExists) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof ensurePathExists === "undefined") {
                ensurePathExists = false;
            }
            let backing = yield this.storage;
            if (ensurePathExists) {
                let folderPath = path.dirname(backing._file);
                yield makeDir(folderPath);
            }
            backing[key] = val;
            return new Promise((resolve, reject) => {
                backing.write(err => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
}
exports.PersistentDict = PersistentDict;
class LocalSettings {
    constructor() {
        this.names = {
            extraConfWhitelist: "extraConfWhitelist",
            extraConfBlacklist: "extraConfBlacklist"
        };
        this.store = new PersistentDict(path.resolve(ExtensionGlobals.workingDir, ".vscode", "ycmSettings.json"));
    }
    get extraConfWhitelist() {
        return this.store.GetVal(this.names.extraConfWhitelist, []);
    }
    SetExtraConfWhitelist(val) {
        this.store.SetVal(this.names.extraConfWhitelist, val, true);
    }
    get extraConfBlacklist() {
        return this.store.GetVal(this.names.extraConfBlacklist, []);
    }
    SetExtraConfBlacklist(val) {
        this.store.SetVal(this.names.extraConfBlacklist, val, true);
    }
}
class FileWatcher {
    constructor(filename, callback) {
        this.watcher = fs.watch(filename, { persistent: false }, (event, file) => {
            callback();
        });
    }
    dispose() {
        this.watcher.close();
    }
}
class FileWatcherStore {
    constructor() {
        this.store = {};
    }
    WatchFile(filename, callback) {
        if (typeof this.store[filename] !== "undefined") {
            throw "Watching one file with multiple callbacks is not supported yet";
        }
        this.store[filename] = new FileWatcher(filename, callback);
        return {
            dispose: () => {
                this.store[filename].dispose();
                this.store[filename] = undefined;
            }
        };
    }
    dispose() {
        for (let file of Object.getOwnPropertyNames(this.store)) {
            this.store[file].dispose();
        }
    }
}
class ExtensionGlobals {
    static Init(context) {
        //this should go first
        //TODO: handle nonexistence
        ExtensionGlobals.workingDir = vscode_1.workspace.workspaceFolders[0].uri.fsPath;
        this.editTracker = new editCompletionTracker_1.EditCompletionTracker();
        this.extensionOpts = context.globalState;
        this.output = vscode_1.window.createOutputChannel("YouCompleteMe");
        this.diags = new diagnosticAggregator_1.DiagnosticAggregator(context);
        this.watchers = new FileWatcherStore();
        this.localSettings = new LocalSettings();
        this.extConfig = new extensionConfig_1.ExtensionConfig();
        context.subscriptions.push(this.output, this.extConfig);
    }
}
exports.ExtensionGlobals = ExtensionGlobals;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["NONE"] = 0] = "NONE";
    LogLevel[LogLevel["FATAL"] = 1] = "FATAL";
    LogLevel[LogLevel["ERROR"] = 2] = "ERROR";
    LogLevel[LogLevel["WARNING"] = 3] = "WARNING";
    LogLevel[LogLevel["INFO"] = 4] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 5] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 6] = "TRACE";
    LogLevel[LogLevel["ALL"] = 7] = "ALL";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
function LogLevelFromString(str) {
    switch (str) {
        case "none":
            return LogLevel.NONE;
        case "fatal":
            return LogLevel.FATAL;
        case "error":
            return LogLevel.ERROR;
        case "warning":
            return LogLevel.WARNING;
        case "info":
            return LogLevel.INFO;
        case "debug":
            return LogLevel.DEBUG;
        case "trace":
            return LogLevel.TRACE;
        case "all":
            return LogLevel.ALL;
    }
}
exports.LogLevelFromString = LogLevelFromString;
class Log {
    static Trace(...args) {
        Log.WriteLog(LogLevel.TRACE, ...args);
    }
    static Debug(...args) {
        Log.WriteLog(LogLevel.DEBUG, ...args);
    }
    static Info(...args) {
        Log.WriteLog(LogLevel.INFO, ...args);
    }
    static Warning(...args) {
        Log.WriteLog(LogLevel.WARNING, ...args);
    }
    static Error(...args) {
        Log.WriteLog(LogLevel.ERROR, ...args);
    }
    static Fatal(...args) {
        Log.WriteLog(LogLevel.FATAL, ...args);
    }
    static WriteLog(level, ...args) {
        if (ExtensionGlobals.extConfig.logLevel.value >= level) {
            switch (level) {
                case LogLevel.TRACE:
                    args.unshift("TRACE: ");
                    break;
                case LogLevel.DEBUG:
                    args.unshift("DEBUG: ");
                    break;
                case LogLevel.INFO:
                    args.unshift("INFO: ");
                    break;
                case LogLevel.WARNING:
                    args.unshift("WARNING: ");
                    break;
                case LogLevel.ERROR:
                    args.unshift("ERROR: ");
                    break;
                case LogLevel.FATAL:
                    args.unshift("FATAL: ");
                    break;
            }
            args.unshift(new Date());
            args.forEach(x => {
                let toPrint;
                if (typeof x === "string") {
                    toPrint = x;
                }
                else {
                    toPrint = JSON.stringify(x);
                }
                ExtensionGlobals.output.append(toPrint);
            });
            ExtensionGlobals.output.appendLine("");
        }
    }
}
exports.Log = Log;
//# sourceMappingURL=utils.js.map