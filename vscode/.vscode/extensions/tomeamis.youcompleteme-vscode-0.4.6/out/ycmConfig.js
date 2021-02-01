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
class YcmSettings {
    static LoadDefault() {
        return __awaiter(this, void 0, void 0, function* () {
            let ycmdPath = utils_1.ExtensionGlobals.extConfig.ycmdPath.value;
            try {
                return this.LoadJSONFile(path.resolve(ycmdPath, "ycmd/default_settings.json"));
            }
            catch (err) {
                //TODO: handle
            }
        });
    }
    static LoadLocal() {
        return __awaiter(this, void 0, void 0, function* () {
            let pJson = this.LoadJSONFile(yield YcmSettings.PathToLocal());
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
        });
    }
    static PathToLocal(ensureFolderExistence) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof ensureFolderExistence === "undefined") {
                ensureFolderExistence = false;
            }
            let folderPath = path.resolve(utils_1.ExtensionGlobals.workingDir, ".vscode");
            if (ensureFolderExistence) {
                let p = new Promise((resolve, reject) => {
                    fs.access(folderPath, fs.constants.W_OK, (err) => {
                        if (err) {
                            if (err.code === "ENOENT") {
                                fs.mkdir(folderPath, (err) => {
                                    if (!err) {
                                        //mkdir OK
                                        resolve();
                                    }
                                    else {
                                        //mkdir not OK
                                        reject(err);
                                    }
                                });
                            }
                            else {
                                //error, but not nonexistent
                                reject(err);
                            }
                        }
                        else {
                            //accessible, OK
                            resolve();
                        }
                    });
                });
                try {
                    yield p;
                }
                catch (ex) {
                    utils_1.Log.Error("Local vscode settings folder not accessible: ", ex);
                }
            }
            return path.resolve(utils_1.ExtensionGlobals.workingDir, ".vscode", "ycmd_settings.json");
        });
    }
    static StoreLocal(newSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = Buffer.from(JSON.stringify(newSettings), 'utf-8');
            fs.writeFile(yield this.PathToLocal(true), data, (err) => {
                if (err) {
                    //just log it, not much we can do about it
                    utils_1.Log.Error("Error writing local settings: ", err);
                }
            });
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
//# sourceMappingURL=ycmConfig.js.map