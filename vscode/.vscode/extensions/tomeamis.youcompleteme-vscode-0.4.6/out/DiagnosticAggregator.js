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
const extendedDiagnostic_1 = require("./requests/extendedDiagnostic");
const vscode_1 = require("vscode");
const utils_1 = require("./utils");
class ExtendedDiagInfo {
    constructor(location, text, originPath) {
        this.location = location;
        this.text = text;
        this.originDocs = new Set([originPath]);
    }
    ToString() {
        return `${this.location.line_num}:${this.location.column_num}:${this.text}`;
    }
    /**
     * Removes all subdiagnostics from the given document
     *
     * @param doc The document which was analyzed and no diags were found for the file of this diag
     * @returns true if the diag shoudl still exist afterwards, false otherwise
     */
    ProcessDocClearance(doc) {
        if (this.originDocs.has(doc)) {
            utils_1.Log.Info("Clearing extendedDiag ", this.ToString(), " from document ", this.location.filepath);
            return false;
        }
        return true;
    }
    ProcessDocUpdateExt(doc, nDiags) {
        if (nDiags.find(diag => this.IsEquivalent(diag))) {
            //this diagnostic was found in the doc, so add it as an origin
            this.originDocs.add(doc);
            return true;
        }
        else {
            //this diagnostic was not found, if it had been found before, it has been resolved
            let willStay = this.ProcessDocClearance(doc);
            let logMethod = willStay ? utils_1.Log.Debug : utils_1.Log.Info;
            logMethod(`Extended diag ${this.ToString()} will stay after processing document ${doc}: ${willStay}`);
            return willStay;
        }
    }
    IsEquivalent(diag) {
        return diag.location.Equals(this.location) && diag.text === this.text;
    }
}
//doesn't make much sense, I know, but that's just how it is
class DiagInfo extends ExtendedDiagInfo {
    constructor(diag, originPath) {
        super(diag.location, diag.text, originPath);
        this.originPath = originPath;
        this.diag = diag;
        this.details = diag.GetExtendedDiags().map(diag => {
            return new ExtendedDiagInfo(diag.location, diag.text, originPath);
        });
    }
    ProcessDocClearance(doc) {
        this.details = this.details.filter(detail => detail.ProcessDocClearance(doc));
        if (this.details.length > 0) {
            return true;
        }
        else {
            utils_1.Log.Info("Clearing diag ", this.ToString(), " from document ", this.location.filepath);
            return false;
        }
    }
    /**
     * Processes new set of diagnostics from a document, updates accordingly
     * @param doc The doc from which the diagnostics were produced
     * @param nDiags The produced diagnostics
     * @returns false if the diag should be removed
     */
    ProcessDocUpdate(doc, nDiags) {
        let matchingDiag = nDiags.find(diag => this.IsEquivalent(diag));
        if (typeof matchingDiag === "undefined") {
            if (this.originDocs.has(doc)) {
                //this diag has been affected before, but no longer is
                utils_1.Log.Debug("Diag ", this.ToString(), "is no longer affected by doc ", this.location.filepath);
                return this.ProcessDocClearance(doc);
            }
            else {
                //hasn't had anything to do with it before, still doesn't
                return true;
            }
        }
        else {
            //there is a matching diag, handle detailed diags
            //if this document is one of the sources of this diag
            utils_1.Log.Debug("Merging detailed diags of document ", doc, "into diag ", this.ToString());
            if (this.originDocs.has(doc)) {
                //remove old diags no longer present
                this.details = this.details.filter(detail => detail.ProcessDocUpdateExt(doc, matchingDiag.GetExtendedDiags()));
            }
            //add new diags
            this.details = this.details.concat(matchingDiag.GetExtendedDiags().filter(diag => !this.details.some(detail => detail.IsEquivalent(diag))).map(diag => {
                let nInfo = new ExtendedDiagInfo(diag.location, diag.text, doc);
                utils_1.Log.Info("Adding extended info ", nInfo.ToString(), " to diag ", this.ToString());
                return nInfo;
            }));
            return true;
        }
    }
}
class DiagnosticAggregator {
    constructor(context) {
        this.affectedDocs = {};
        this.diagnostics = {};
        this.vscodeDiagCollection = vscode_1.languages.createDiagnosticCollection("YouCompleteMe");
        context.subscriptions.push(this.vscodeDiagCollection);
    }
    GetArray(dict, index) {
        if (typeof dict[index] === "undefined") {
            dict[index] = [];
        }
        return dict[index];
    }
    SetDiagsForDoc(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let arr = this.diagnostics[doc];
                let pDiags = arr.map(diagInfo => {
                    let diag = diagInfo.diag;
                    diag.SetExtendedDiags(diagInfo.details.map(detail => new extendedDiagnostic_1.YcmExtendedDiagnostic(detail.location, detail.text)));
                    return diag.ToVscodeDiagnostic().catch(reason => {
                        utils_1.Log.Error("Transforming Ycm diganostic to VScode diag failed: ", reason);
                        return null;
                    });
                });
                this.vscodeDiagCollection.set(vscode_1.Uri.file(doc), (yield Promise.all(pDiags)).filter(diag => diag));
            }
            catch (e) {
                utils_1.Log.Error(`Error setting diagnostics for document ${doc}: ${e}`);
            }
        });
    }
    AddDiagnostics(contextDoc, diags) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Promise.all(diags.map(diag => diag.ResolveExtendedDiags()));
                let prevAffectedDocs = new Set(this.GetArray(this.affectedDocs, contextDoc));
                let newAffectedDocs = new Set();
                for (let diag of diags) {
                    newAffectedDocs.add(diag.location.filepath.normalizedPath);
                }
                this.affectedDocs[contextDoc] = [...newAffectedDocs];
                //clear affectedDocs
                {
                    let newClearDocs = new Set([...prevAffectedDocs].filter(val => !newAffectedDocs.has(val)));
                    for (let clearDoc of newClearDocs) {
                        let docDiags = this.GetArray(this.diagnostics, clearDoc);
                        //clears 
                        this.diagnostics[clearDoc] = docDiags.filter(diag => diag.ProcessDocClearance(contextDoc));
                        this.SetDiagsForDoc(clearDoc);
                    }
                }
                for (let affectedDoc of newAffectedDocs) {
                    //process the diagnostics in all the docs
                    let prevDiags = this.GetArray(this.diagnostics, affectedDoc);
                    prevDiags = prevDiags.filter(diag => diag.ProcessDocUpdate(contextDoc, diags));
                    prevDiags = prevDiags.concat(diags.filter(diag => diag.location.filepath.normalizedPath === affectedDoc && !prevDiags.some(diag2 => diag2.IsEquivalent(diag))).map(diag => {
                        let nInfo = new DiagInfo(diag, contextDoc);
                        utils_1.Log.Info("Adding new diag ", nInfo.ToString(), " to document ", nInfo.location.filepath);
                        return nInfo;
                    }));
                    this.diagnostics[affectedDoc] = prevDiags;
                    this.SetDiagsForDoc(affectedDoc);
                }
            }
            catch (e) {
                utils_1.Log.Error("Error adding diagnostics to doc ", contextDoc, ": ", e);
            }
        });
    }
}
exports.DiagnosticAggregator = DiagnosticAggregator;
//# sourceMappingURL=diagnosticAggregator.js.map