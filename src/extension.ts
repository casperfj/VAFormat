import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import ignore from "ignore";
import * as yaml from "js-yaml";

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand(
        "vaformat.format",
        async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage("No workspace folder is open.");
                return;
            }

            const workspacePath = workspaceFolders[0].uri.fsPath;
            const { language, environment } =
                detectLanguageAndEnvironment(workspacePath);
            const { description, problemStatements, questions } =
                await parseVaformatYaml(workspacePath);
            const ig = await getIgnoreRules(workspacePath);
            let codeOutput = generateOutputHeader(
                language,
                environment,
                description,
                problemStatements
            );
            codeOutput += "Code:\n\n";
            codeOutput += await processDirectory(
                workspacePath,
                workspacePath,
                ig
            );
            codeOutput += generateQuestions(questions);

            // Open a new text document with the output
            /*await vscode.workspace
                .openTextDocument({
                    content: codeOutput,
                    language: "plaintext",
                })
                .then((doc) => {
                    vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                });*/

            // Write the output to a file and open it
            /*const outputFilePath = path.join(
                workspacePath,
                "vaformat_output.txt"
            );
            await fs.promises.writeFile(outputFilePath, codeOutput, "utf-8");
            const doc = await vscode.workspace.openTextDocument(outputFilePath);
            vscode.window.showTextDocument(doc, vscode.ViewColumn.One);*/

            const fileSizeLimit = 1024 * 1024 * 50; // 50 MB limit
            const fileContentLength = Buffer.byteLength(codeOutput, "utf-8");

            if (fileContentLength <= fileSizeLimit) {
                const outputFilePath = path.join(
                    workspacePath,
                    "vaformat_output.txt"
                );
                await fs.promises.writeFile(
                    outputFilePath,
                    codeOutput,
                    "utf-8"
                );
                const doc = await vscode.workspace.openTextDocument(
                    outputFilePath
                );
                vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            } else {
                const parts = Math.ceil(fileContentLength / fileSizeLimit);

                for (let i = 0; i < parts; i++) {
                    const start = i * fileSizeLimit;
                    const end = Math.min(
                        (i + 1) * fileSizeLimit,
                        fileContentLength
                    );
                    const partContent = codeOutput.slice(start, end);

                    const outputFilePath = path.join(
                        workspacePath,
                        `vaformat_output_part_${i + 1}.txt`
                    );
                    await fs.promises.writeFile(
                        outputFilePath,
                        partContent,
                        "utf-8"
                    );

                    if (i === 0) {
                        const doc = await vscode.workspace.openTextDocument(
                            outputFilePath
                        );
                        vscode.window.showTextDocument(
                            doc,
                            vscode.ViewColumn.One
                        );
                    } else {
                        const doc = await vscode.workspace.openTextDocument(
                            outputFilePath
                        );
                        vscode.window.showTextDocument(doc, {
                            viewColumn: vscode.ViewColumn.Beside,
                            preview: false,
                        });
                    }
                }

                vscode.window.showInformationMessage(
                    "VAFormat output has been split into multiple files due to its size."
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}

function detectLanguageAndEnvironment(workspacePath: string) {
    let language = "Unknown";
    let environment = "Unknown";

    const goModPath = path.join(workspacePath, "go.mod");
    const packageJsonPath = path.join(workspacePath, "package.json");

    if (fs.existsSync(goModPath)) {
        language = "Go";
    } else if (fs.existsSync(packageJsonPath)) {
        const packageJson = require(packageJsonPath);
        if (packageJson.dependencies || packageJson.devDependencies) {
            if (
                packageJson.dependencies.typescript ||
                packageJson.devDependencies.typescript
            ) {
                language = "TypeScript";
            } else {
                language = "JavaScript";
            }

            if (
                packageJson.dependencies.react ||
                packageJson.devDependencies.react
            ) {
                environment = "React";
            } else if (
                packageJson.dependencies.angular ||
                packageJson.devDependencies.angular
            ) {
                environment = "Angular";
            } else if (
                packageJson.dependencies.vue ||
                packageJson.devDependencies.vue
            ) {
                environment = "Vue.js";
            } else {
                environment = "Node.js";
            }
        }
    }

    return { language, environment };
}

async function parseVaformatYaml(workspacePath: string) {
    const vaformatYamlPath = path.join(workspacePath, ".vaformat.yaml");
    let description = "";
    let problemStatements: string[] = [];
    let questions: string[] = [];

    if (fs.existsSync(vaformatYamlPath)) {
        const vaformatYamlContent = await fs.promises.readFile(
            vaformatYamlPath,
            "utf-8"
        );
        const vaformatYamlData = yaml.load(vaformatYamlContent) as {
            description?: string;
            problem_statement?: string[];
            questions?: string[];
        };

        description = vaformatYamlData.description || "";
        problemStatements = vaformatYamlData.problem_statement || [];
        questions = vaformatYamlData.questions || [];
    }

    return { description, problemStatements, questions };
}

async function getIgnoreRules(workspacePath: string) {
    const vaformatignorePath = path.join(workspacePath, ".vaformatignore");
    const ig = ignore();
    if (fs.existsSync(vaformatignorePath)) {
        const vaformatignoreContent = await fs.promises.readFile(
            vaformatignorePath,
            "utf-8"
        );
        ig.add(vaformatignoreContent);
    }
    return ig;
}

function generateOutputHeader(
    language: string,
    environment: string,
    description: string,
    problemStatements: string[]
) {
    let output = `Language: ${language}\nEnvironment: ${environment}\n\n`;

    if (description) {
        output += `Description: ${description}\n\n`;
    } else {
        output += "Description:\n\n";
    }

    if (problemStatements.length > 0) {
        output += "Problem Statement:\n";
        problemStatements.forEach((statement) => {
            output += `- ${statement}\n`;
        });
        output += "\n";
    } else {
        output += "Problem Statement:\n- \n\n";
    }

    return output;
}

async function processDirectory(
    workspacePath: string,
    dirPath: string,
    ig: ReturnType<typeof ignore>
) {
    const files = await fs.promises.readdir(dirPath);
    let codeOutput = "";

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const relFilePath = path.relative(workspacePath, filePath);

        if (ig.ignores(relFilePath)) {
            continue;
        }

        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {
            codeOutput += await processDirectory(workspacePath, filePath, ig);
        } else {
            const fileContent = await fs.promises.readFile(filePath, "utf-8");
            codeOutput += `File: ${relFilePath}\n`;
            codeOutput += "--------------\n";
            codeOutput += `${fileContent}\n\n`;
        }
    }

    return codeOutput;
}

function generateQuestions(questions: string[]) {
    let output = "Questions:\n";

    if (questions.length > 0) {
        questions.forEach((question, index) => {
            output += `${index + 1}. ${question}\n`;
        });
    } else {
        output += "1. ";
    }

    return output;
}
