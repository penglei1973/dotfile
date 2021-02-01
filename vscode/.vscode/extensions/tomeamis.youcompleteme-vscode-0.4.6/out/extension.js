'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const utils_1 = require("./utils");
const completions_1 = require("./requests/completions");
const vscode_1 = require("vscode");
const completerCommand_1 = require("./requests/completerCommand");
const server_1 = require("./server");
class MultiOptionProviderRegistrator {
    constructor(haveRelevantConfigsChanged, updateProvider) {
        this.haveRelevantConfigsChanged = haveRelevantConfigsChanged;
        this.updateProvider = updateProvider;
        this.disposable = updateProvider();
        utils_1.ExtensionGlobals.extConfig.onDidChange(() => this.TryUpdateProvider());
    }
    TryUpdateProvider() {
        //if it's not undef and config hasn't changed, just keep the old one
        if (!this.haveRelevantConfigsChanged()) {
            return;
        }
        //dispose the old provider
        this.disposable.dispose();
        //add new provider
        this.updateProvider();
    }
    dispose() {
        this.disposable.dispose();
    }
}
class SingleOptionProviderRegistrator {
    constructor(cfg, updateProvider) {
        this.updateProvider = updateProvider;
        this.disposable = updateProvider(cfg.value);
        cfg.onDidChangeValue(nval => this.disposable = this.updateProvider(nval));
    }
    dispose() {
        this.disposable.dispose();
    }
}
function RegisterCFamProvider(lang, context) {
    let disposable = new MultiOptionProviderRegistrator(() => {
        let config = utils_1.ExtensionGlobals.extConfig;
        return config.filetypes.wasChanged || config.triggerStrings.wasChanged;
    }, () => {
        let config = utils_1.ExtensionGlobals.extConfig;
        let filetypes = config.filetypes.value;
        if (!filetypes.find(type => type === lang)) {
            //cpp is not being completed
            return;
        }
        let triggers = config.triggerStrings.value;
        return vscode.languages.registerCompletionItemProvider(lang, new completions_1.YcmCFamCompletionProvider(triggers.cpp), ...triggers[lang].map(seq => seq.slice(-1)));
    });
    context.subscriptions.push(disposable);
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    utils_1.ExtensionGlobals.Init(context);
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    utils_1.Log.Info('Congratulations, your extension "youcompleteme-vscode" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable;
    /*
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
        
    })

    context.subscriptions.push(disposable);*/
    let filetypes = utils_1.ExtensionGlobals.extConfig.filetypes;
    let editTracker = utils_1.ExtensionGlobals.editTracker;
    disposable = vscode.workspace.onDidChangeTextDocument(x => editTracker.HandleDocChange(x));
    context.subscriptions.push(disposable);
    //on activation, load documents that are already open
    vscode.window.visibleTextEditors.forEach(x => editTracker.SendDocReparseNotification(x.document));
    disposable = vscode.window.onDidChangeActiveTextEditor(x => { if (x)
        editTracker.SendDocReparseNotification(x.document); });
    context.subscriptions.push(disposable);
    RegisterCFamProvider("cpp", context);
    RegisterCFamProvider("c", context);
    disposable = new SingleOptionProviderRegistrator(filetypes, nval => vscode_1.languages.registerDefinitionProvider(nval, new completerCommand_1.YcmDefinitionProvider()));
    context.subscriptions.push(disposable);
    context.subscriptions.push(new SingleOptionProviderRegistrator(filetypes, nval => vscode_1.languages.registerHoverProvider(nval, new completerCommand_1.YcmGetTypeProvider())));
    context.subscriptions.push(new SingleOptionProviderRegistrator(filetypes, nval => vscode_1.languages.registerCodeActionsProvider(nval, new completerCommand_1.YcmCodeActionProvider())));
    context.subscriptions.push(vscode.commands.registerCommand("YcmShutdownServer", () => server_1.YcmServer.Shutdown()));
    //shutdown server on unload
    context.subscriptions.push({ dispose: () => server_1.YcmServer.Shutdown() });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map