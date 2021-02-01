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
const utils_1 = require("../utils");
const vscode_1 = require("vscode");
class YcmLoadExtraConfResponse {
    //TODO: check if this is an ycmd exception response
    constructor(err) {
        this.err = err;
    }
}
exports.YcmLoadExtraConfResponse = YcmLoadExtraConfResponse;
class YcmLoadExtraConfRequest {
    constructor(filepath) {
        this.filepath = filepath;
    }
    Send(server) {
        return __awaiter(this, void 0, void 0, function* () {
            let p = server.SendData('/load_extra_conf_file', this);
            try {
                let resData = yield p;
                if (resData !== true) {
                    throw "Unexpected server response to YcmLoadExtraConfRequest";
                }
                return new YcmLoadExtraConfResponse(null);
            }
            catch (err) {
                //TODO: call handler
                return new YcmLoadExtraConfResponse(err);
            }
        });
    }
    static WatchExtraConfForChanges(path) {
        utils_1.ExtensionGlobals.watchers.WatchFile(path, () => __awaiter(this, void 0, void 0, function* () {
            let choice = yield vscode_1.window.showInformationMessage(`Ycm extra conf file ${path} has changed. Restart server?`, "Yes", "No");
            if (choice && choice === "Yes") {
                server_1.YcmServer.Shutdown();
            }
        }));
    }
}
exports.YcmLoadExtraConfRequest = YcmLoadExtraConfRequest;
//# sourceMappingURL=load_extra_conf.js.map