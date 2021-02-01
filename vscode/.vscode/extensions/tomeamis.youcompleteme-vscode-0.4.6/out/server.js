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
const ChildProcess = require("child_process");
const Net = require("net");
const Path = require("path");
const crypto_1 = require("crypto");
const Fs = require("fs");
const os_1 = require("os");
const utils_1 = require("./utils");
const Http = require("http");
const QueryString = require("querystring");
const ycmConfig_1 = require("./ycmConfig");
/**
 * Makes the ycmd setting file to pass to Ycmd, returns it's path
 * @param ycmdPath path to ycmd directory (with __main__.py and default_settings.json files)
 * @param workingDir The workspace dir
 */
function MakeYcmdSettingsFile(secret) {
    return __awaiter(this, void 0, void 0, function* () {
        let pFile = GetTempFile("YcmdSettings_");
        let pData = MakeYcmdSettings(secret);
        let [[file, path], data] = yield Promise.all([pFile, pData]);
        try {
            return yield new Promise((resolve, reject) => {
                Fs.write(file, JSON.stringify(data), (err) => {
                    if (err) {
                        utils_1.Log.Debug("Error writing ycmd settings file");
                        reject(err);
                    }
                    else {
                        utils_1.Log.Debug("Writing ycmd settings file succeeded");
                        resolve(path);
                    }
                });
            });
        }
        finally {
            utils_1.Log.Debug("Closing ycmd settings file");
            Fs.close(file, err => err && utils_1.Log.Error("Failed to close ycmd settings file: ", err));
        }
    });
}
function GetTempFile(prefix, remainingAttempts = 10) {
    return new Promise((resolve, reject) => {
        if (remainingAttempts <= 0) {
            reject("Failed to create a temporary file");
        }
        //generate random filename
        let filename = Path.resolve(os_1.tmpdir(), `${prefix}${crypto_1.randomBytes(8).toString('hex')}`);
        //attempt to open
        Fs.open(filename, "wx", 0o600, (err, fd) => {
            if (!fd) {
                if (err && err.code === "EEXIST") {
                    return GetTempFile(prefix, remainingAttempts - 1);
                }
                else {
                    reject(err);
                }
            }
            else {
                resolve([fd, filename]);
            }
        });
    });
}
function MakeYcmdSettings(secret) {
    return __awaiter(this, void 0, void 0, function* () {
        let pDefaults = ycmConfig_1.YcmSettings.LoadDefault();
        let pLocal = ycmConfig_1.YcmSettings.LoadLocal();
        let [defaults, local] = yield Promise.all([pDefaults, pLocal]);
        //override the defaults
        Object.keys(local).forEach(key => defaults[key] = local[key]);
        Object.getOwnPropertyNames(defaults).forEach(name => {
            if (defaults[name] instanceof Array) {
                defaults[name] = [...(new Set(defaults[name]))];
            }
        });
        defaults["hmac_secret"] = secret;
        return defaults;
    });
}
class YcmServer {
    constructor(secret, port) {
        this.secret = secret;
        this.port = port;
    }
    static SetupServer(workingDir) {
        return __awaiter(this, void 0, void 0, function* () {
            YcmServer.alive = true;
            try {
                let ycmdPath = utils_1.ExtensionGlobals.extConfig.ycmdPath.value;
                let options = {
                    cwd: workingDir,
                    env: process.env,
                    shell: true,
                    windowsVerbatimArguments: true,
                    windowsHide: true
                };
                //get unused port
                let server = Net.createServer();
                let pPort = new Promise(resolve => {
                    server.listen({ host: "localhost", port: 0, exclusive: true }, () => {
                        resolve(server.address().port);
                        server.close();
                    });
                });
                let secret = crypto_1.randomBytes(16);
                let pOptFile = MakeYcmdSettingsFile(secret.toString('base64'));
                let [port, optFile] = yield Promise.all([pPort, pOptFile]);
                let args = [
                    Path.resolve(ycmdPath, "ycmd"),
                    `"--port=${port}"`,
                    `"--options_file=${optFile}"`,
                    //stay alive for 15 minutes
                    `--idle_suicide_seconds=900`
                ];
                //TODO: implement a keepalive pinger
                let pythonPath = utils_1.ExtensionGlobals.extConfig.pythonPath.value;
                let cp = ChildProcess.spawn(`"${pythonPath}"`, args, options);
                if (cp.pid) {
                    utils_1.Log.Info("Ycmd started successfully. PID: ", cp.pid);
                }
                else {
                    utils_1.Log.Error("Failed to start Ycmd.");
                    throw "Failed to start Ycmd process";
                }
                cp.stderr.on("data", (chunk) => {
                    utils_1.Log.Debug("Ycmd stderr: ", chunk.toString('utf-8'));
                });
                cp.stdout.on("data", (chunk) => {
                    utils_1.Log.Debug("Ycmd stdout: ", chunk.toString('utf-8'));
                });
                cp.on("exit", (code, signal) => {
                    YcmServer.alive = false;
                    if (signal) {
                        utils_1.Log.Error("Ycmd ended with signal ", signal);
                    }
                    else if (code) {
                        let msg;
                        switch (code) {
                            case 0:
                                utils_1.Log.Info("Ycmd normal exit");
                                break;
                            case 3:
                                msg = "unexpected error while loading the library";
                                break;
                            case 4:
                                msg = "the ycm_core library is missing";
                                break;
                            case 5:
                                msg = "the ycm_core library is compiled for Python 3 but loaded in Python 2";
                                break;
                            case 6:
                                msg = "the ycm_core library is compiled for Python 2 but loaded in Python 3";
                                break;
                            case 7:
                                msg = "the version of the ycm_core library is outdated.";
                                break;
                            default:
                                msg = "unknown error";
                                break;
                        }
                        utils_1.Log.Error("Ycmd exit: ", msg);
                    }
                });
                return new YcmServer(secret, port);
            }
            catch (err) {
                //error happened, server is not alive
                YcmServer.alive = false;
                //not handled, just rethrow
                throw err;
            }
        });
    }
    static GetInstance() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!YcmServer.alive) {
                YcmServer.instance = YcmServer.SetupServer(utils_1.ExtensionGlobals.workingDir);
            }
            //TODO: timeout?
            return YcmServer.instance;
        });
    }
    static Shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof YcmServer.instance === "undefined") {
                //no server, no action necessary
                return;
            }
            let server = YcmServer.instance;
            YcmServer.instance = undefined;
            YcmServer.alive = false;
        });
    }
    SendData(path, data) {
        let method;
        let body;
        let reqPath;
        switch (path) {
            case '/completions':
            case '/run_completer_command':
            case '/detailed_diagnostic':
            case '/event_notification':
            case '/load_extra_conf_file':
            case '/run_completer_command':
                method = "POST";
                body = JSON.stringify(data);
                reqPath = path;
                break;
            case '/shutdown':
                method = "POST";
                body = '';
                reqPath = path;
                break;
            case '/healthy':
                method = "GET";
                body = '';
                reqPath = `${path}?${QueryString.stringify(data)}`;
                break;
            default:
                throw "unknown path suppiled to YcmServer.SendData";
        }
        let hmac = this.ComputeReqHmac(method, path, body);
        let options = {
            hostname: "localhost",
            port: this.port,
            path: reqPath,
            method: method,
            headers: {
                'content-type': 'application/json'
            }
        };
        options.headers[YcmServer.hmacHeader] = hmac.toString('base64');
        let req;
        let result = new Promise((resolve, reject) => {
            req = Http.request(options, res => {
                let buf = new Buffer(0);
                res.on('data', (data) => buf = Buffer.concat([buf, data]));
                res.on('end', () => {
                    try {
                        if (!this.VerifyResponseHmac(buf, res.headers[YcmServer.hmacHeader])) {
                            reject("Hmac verification failed");
                        }
                        else {
                            let resBody = buf.toString('utf-8');
                            if (res.statusCode == 200) {
                                resolve(JSON.parse(resBody));
                            }
                            else {
                                reject(JSON.parse(resBody));
                            }
                        }
                    }
                    catch (e) {
                        reject(e);
                    }
                });
                res.on('error', err => reject(err));
            });
        });
        utils_1.Log.Debug(`Sending data to ${path}: `);
        utils_1.Log.Trace(data);
        req.write(body, 'utf-8');
        req.end();
        return result;
    }
    VerifyResponseHmac(body, hmacToVerify) {
        if (typeof hmacToVerify === 'string') {
            hmacToVerify = new Buffer(hmacToVerify, 'base64');
        }
        let computedHmac = this.ComputeHmac(body);
        if (hmacToVerify.length != YcmServer.hmacLen) {
            return false;
        }
        let equal = true;
        //constant time, because why not
        for (let i = 0; i < YcmServer.hmacLen; ++i) {
            equal = equal && hmacToVerify[i] == computedHmac[i];
        }
        return equal;
    }
    ComputeReqHmac(method, path, body) {
        let method_hmac = this.ComputeHmac(new Buffer(method, 'utf-8'));
        let path_hmac = this.ComputeHmac(new Buffer(path, 'utf-8'));
        let body_hmac = this.ComputeHmac(new Buffer(body, 'utf-8'));
        let catted = Buffer.concat([method_hmac, path_hmac, body_hmac]);
        return this.ComputeHmac(catted);
    }
    ComputeHmac(data) {
        let hmac = crypto_1.createHmac(YcmServer.hmacHashAlg, this.secret);
        hmac.update(data);
        return hmac.digest();
    }
}
//hmac alg + and the resulting hash length
YcmServer.hmacHashAlg = 'sha256';
YcmServer.hmacLen = 32;
YcmServer.hmacHeader = 'x-ycm-hmac';
exports.YcmServer = YcmServer;
//# sourceMappingURL=server.js.map