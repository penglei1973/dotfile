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
const utils_2 = require("../utils");
class YcmSimpleRequest {
    //todo, figure out common points, how to inherit
    constructor(loc, { completerTarget, workingDir } = {}) {
        this.line_num = loc.line_num;
        this.column_num = loc.column_num;
        this.filepath = loc.filepath.receivedPath;
        this.file_data = utils_1.YcmFileDataMapKeeper.GetDataMap(loc.filepath);
        if (completerTarget) {
            this.completer_target = completerTarget;
        }
        if (workingDir) {
            this.working_dir = workingDir;
        }
    }
    GetLocation() {
        return new utils_1.YcmLocation(this.line_num, this.column_num, this.filepath);
    }
    HandleException(err) {
    }
    Send(server, path) {
        //for recursion
        let implFunc = () => __awaiter(this, void 0, void 0, function* () {
            //promise must be resolved before sending.
            if (this.file_data instanceof Promise) {
                this.file_data = yield this.file_data;
            }
            let p = server.SendData(path, this);
            try {
                let res = yield p;
                utils_2.Log.Debug(`${path} response: `);
                utils_2.Log.Trace(res);
                return res;
            }
            catch (err) {
                {
                    //try to let subclass handle the error
                    let handled = this.HandleException(err);
                    if (typeof handled != "undefined") {
                        return handled;
                    }
                }
                if (yield utils_1.ErrorHandler.HandleRequestError(err)) {
                    return implFunc();
                }
                else {
                    //TODO: return empty
                }
            }
        });
        return implFunc();
    }
}
exports.YcmSimpleRequest = YcmSimpleRequest;
//# sourceMappingURL=simpleRequest.js.map