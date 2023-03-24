# VAFormat

An extension to format VSCode to AI input.

# Creation

## First, install the necessary tools

```
npm install -g yo generator-code
```

## Create a new extension

```
yo code
```

## Modify the extension

The activate function, in the src/extension.ts file (TypeScript)

## Update the package.json

Add a contributes section to define the command and a keybinding, if desired.

## Test and package your extension

Press F5 to test in a new Extension Development Host window. Then package using vsce (https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

```
npm install -g vsce
```

```
vsce package
```

```
Ctrl+Shift+X
```

Click on the three-dot menu in the top right corner of the Extensions view and select "Install from VSIX..."
