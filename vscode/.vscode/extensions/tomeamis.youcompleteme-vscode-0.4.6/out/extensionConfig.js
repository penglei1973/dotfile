'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const vscode_1 = require("vscode");
function IsStringArray(obj) {
    return obj instanceof Array && obj.every(val => typeof val === "string");
}
function IsTriggerStrings(obj) {
    if (!obj || typeof obj !== "object") {
        return false;
    }
    return IsStringArray(obj.cpp) && IsStringArray(obj.c);
}
class ConfigItemInternal {
    constructor() {
        this._wasChanged = false;
        this.eventEmitter = new vscode_1.EventEmitter();
        this.onDidChangeValue = this.eventEmitter.event;
    }
    static AreEquivalent(val, nval) {
        if (typeof val === "undefined") {
            //undefined-> will change
            return false;
        }
        //support basic types as it's easy
        if (typeof nval === "string" || typeof nval === "number") {
            return val === nval;
        }
        else if (nval instanceof Array) {
            let valArr = val;
            if (nval.length != valArr.length) {
                return false;
            }
            return val.every((val, i) => this.AreEquivalent(nval[i], val));
        }
        else if (IsTriggerStrings(nval)) {
            return this.AreEquivalent(val.cpp, nval.cpp);
        }
        else
            return false;
    }
    set value(nval) {
        //do nothing if values are equivalent
        if (ConfigItemInternal.AreEquivalent(this._value, nval)) {
            this._wasChanged = false;
            return;
        }
        this._value = nval;
        this._wasChanged = true;
        this.eventEmitter.fire(nval);
    }
    get value() {
        return this._value;
    }
    get wasChanged() {
        return this._wasChanged;
    }
    dispose() {
        this.eventEmitter.dispose();
    }
}
class ExtensionConfig {
    constructor() {
        this.emitter = new vscode_1.EventEmitter();
        this.onDidChange = this.emitter.event;
        this._ycmdPath = new ConfigItemInternal();
        this._pythonPath = new ConfigItemInternal();
        this._filetypes = new ConfigItemInternal();
        this._triggerStrings = new ConfigItemInternal();
        this._reparseTimeout = new ConfigItemInternal();
        this._logLevel = new ConfigItemInternal();
        this._reparseWaitDelay = new ConfigItemInternal();
        this._fallbackToSemantic = new ConfigItemInternal();
        this.UpdateConfig();
        vscode_1.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(ExtensionConfig.sectionName)) {
                this.UpdateConfig();
            }
        });
    }
    get ycmdPath() {
        return this._ycmdPath;
    }
    get pythonPath() {
        return this._pythonPath;
    }
    get filetypes() {
        return this._filetypes;
    }
    get triggerStrings() {
        return this._triggerStrings;
    }
    get reparseTimeout() {
        return this._reparseTimeout;
    }
    get logLevel() {
        return this._logLevel;
    }
    get reparseWaitDelay() {
        return this._reparseWaitDelay;
    }
    get fallbackToSemantic() {
        return this._fallbackToSemantic;
    }
    dispose() {
        this._ycmdPath.dispose();
        this._pythonPath.dispose();
        this._filetypes.dispose();
        this._triggerStrings.dispose();
        this._reparseTimeout.dispose();
        this._logLevel.dispose();
        this._reparseWaitDelay.dispose();
        this._fallbackToSemantic.dispose();
    }
    UpdateConfig() {
        let changed = false;
        let cb = () => { changed = true; };
        let disposables = [
            this._ycmdPath.onDidChangeValue(cb),
            this._pythonPath.onDidChangeValue(cb),
            this._filetypes.onDidChangeValue(cb),
            this._reparseTimeout.onDidChangeValue(cb),
            this._logLevel.onDidChangeValue(cb),
            this._triggerStrings.onDidChangeValue(cb),
            this._reparseWaitDelay.onDidChangeValue(cb),
            this._fallbackToSemantic.onDidChangeValue(cb)
        ];
        try {
            let config = vscode_1.workspace.getConfiguration(ExtensionConfig.sectionName);
            this._ycmdPath.value = config.get("ycmdPath");
            this._pythonPath.value = config.get("pythonPath");
            this._filetypes.value = config.get("filetypes");
            this._reparseTimeout.value = config.get("reparseTimeout");
            this._logLevel.value = utils_1.LogLevelFromString(config.get("logLevel"));
            this._triggerStrings.value = config.get("triggerStrings");
            this._reparseWaitDelay.value = config.get("reparseWaitDelay");
            this._fallbackToSemantic.value = config.get("fallbackToSemantic");
        }
        finally {
            vscode_1.Disposable.from(...disposables).dispose();
        }
        if (changed) {
            this.emitter.fire();
        }
    }
}
ExtensionConfig.sectionName = "YouCompleteMe";
exports.ExtensionConfig = ExtensionConfig;
//# sourceMappingURL=extensionConfig.js.map