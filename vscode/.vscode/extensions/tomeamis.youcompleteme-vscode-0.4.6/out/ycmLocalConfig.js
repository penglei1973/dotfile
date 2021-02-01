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
const fs = require("fs");
const path = require("path");
const utils_1 = require("./utils");
const vscode_1 = require("vscode");
class YcmSettings {
    static LoadDefault() {
        return __awaiter(this, void 0, void 0, function* () {
            let ycmdPath = vscode_1.workspace.getConfiguration("YouCompleteMe").get("ycmdPath");
            return this.LoadJSONFile(path.resolve(ycmdPath, "ycmd/default_settings.json"));
        });
    }
    static LoadLocal() {
        let pJson = this.LoadJSONFile(YcmSettings.PathToLocal());
        return new Promise(resolve => {
            pJson.then(result => {
                resolve(result);
            });
            //if it fails, just return empty object
            pJson.catch(e => {
                resolve({});
                utils_1.Log.Info("Failed to load local settings from folder ", utils_1.ExtensionGlobals.workingDir);
                utils_1.Log.Info("Reason: ", e);
            });
        });
    }
    static PathToLocal() {
        return path.resolve(utils_1.ExtensionGlobals.workingDir, ".vscode", "ycmd_settings.json");
    }
    static StoreLocal(newSettings) {
        let data = Buffer.from(JSON.stringify(newSettings), 'utf-8');
        fs.writeFile(this.PathToLocal(), data, (err) => {
            if (err) {
                //just log it, not much we can do about it
                utils_1.Log.Error("Error writing local settings: ", err);
            }
        });
    }
    static LoadJSONFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            let pData = new Promise((resolve, reject) => {
                fs.readFile(path, "utf-8", (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
            return JSON.parse(yield pData);
        });
    }
}
exports.YcmSettings = YcmSettings;
//# sourceMappingURL=ycmLocalConfig.js.map