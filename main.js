define(function (require, exports, module) {
  'use strict';

  var acorn = require('acorn');
  var walk = require('walk');
  var globals = require('globals');

  var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");

  var Document = brackets.getModule("document/Document");
  var documentManager = brackets.getModule("document/DocumentManager");
  var editorManager = brackets.getModule("editor/EditorManager");
  var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
      prefs = PreferencesManager.getExtensionPrefs("peey/brackets-globals"),
      stateManager = PreferencesManager.stateManager.getPrefixedSystem("peey/brackets-globals");

  var refreshing = false;
  $(documentManager).on('currentDocumentChange', function (e, newDocument, oldDocument) {
    try {
      refreshing = false;
      if (oldDocument) {
        $(oldDocument).off('change', documentValueChanged);
      }
      $(newDocument).on('change', documentValueChanged);
      documentValueChanged();
    } catch (ex) {
      console.error(ex.stack);
    }
  });

  var functionNames = [];
  var lastText = '';
  var markers = [];
  var oldMarkers = [];
  function isScope(node) {
    return node.type === 'BlockStatement' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'Program'
  }
  function isValidArgumentsUse(node, parents) {
    var parent = parents[parents.length - 2];
    if (parent.type === 'MemberExpression') {
      if (parent.computed === false && parent.property.name && parent.property.name === 'length') {
        return true;
      }
      if (parent.computed === true) {
        return true;
      }
    }
    if (parent.type === 'CallExpression' &&
        parent.callee.type === 'MemberExpression' && parent.callee.computed === false && parent.callee.property.name === 'apply' &&
        node == parent.arguments[1]) {
      return true;
    }
    return false;
  }
  function documentValueChanged() {
    try {
      if (!documentManager.getCurrentDocument() ||
          !documentManager.getCurrentDocument().getLanguage() ||
          documentManager.getCurrentDocument().getLanguage().getId() !== 'javascript') {
        return;
      }
      var text = documentManager.getCurrentDocument().getText();
      if (text === lastText) return;
      lastText = text;

      var cm = editorManager.getCurrentFullEditor()._codeMirror;
      var ast = acorn.parse(text, {
        ecmaVersion: 6,
        locations: true
      });
      var declareFunction = function (node) {
        var fn = node;
        fn.locals = fn.locals || {};
        node.params.forEach(function (node) {
          fn.locals[node.name] = true;
        });
        if (node.id) {
          fn.locals[node.id.name] = true;
        }
      }
      var newMarkers = [];
      var newMarkerLocations = [];
      walk.ancestor(ast, {
        'VariableDeclaration': function (node, parents) {
          var parent = null;
          for (var i = parents.length - 1; i >= 0 && parent === null; i--) {
            if (isScope(parents[i])) {
              parent = parents[i];
            }
          }
          parent.locals = parent.locals || {};
          node.declarations.forEach(function (declaration) {
            if (declaration.id.name === 'undefined') {
              newMarkers.push(declaration.id.name);
              newMarkerLocations.push(declaration.id.loc);
            }
            parent.locals[declaration.id.name] = true;
          });
        },
        'FunctionDeclaration': function (node, parents) {
          var parent = null;
          for (var i = parents.length - 2; i >= 0 && parent === null; i--) {
            if (isScope(parents[i])) {
              parent = parents[i];
            }
          }
          parent.locals = parent.locals || {};
          parent.locals[node.id.name] = true;
          declareFunction(node);
        },
        'FunctionExpression': declareFunction,
        'TryStatement': function (node) {
          node.handler.body.locals = node.handler.body.locals || {};
          node.handler.body.locals[node.handler.param.name] = true;
        }
      });
      walk.ancestor(ast, {
        'Identifier': function (node, parents) {
          var name = node.name;
          if (name === 'undefined') {
            return;
          }
          if (name === 'arguments' && isValidArgumentsUse(node, parents)) {
            return;
          }
          if (name in globals) return;
          for (var i = 0; i < parents.length; i++) {
            if (parents[i].locals && name in parents[i].locals) {
              return;
            }
          }
          newMarkers.push(name);
          newMarkerLocations.push(node.loc);
        },
        'MemberExpression': function (node) {
        }
      });
      if (oldMarkers.length !== newMarkers.length || newMarkers.some(function (name, i) { return name !== oldMarkers[i]; })) {
        oldMarkers = newMarkers;
        markers.forEach(function (m) {
          m.clear();
        });
        markers = [];
        for (var i = 0; i < newMarkerLocations.length; i++) {
          markers.push(cm.markText(
            {line: newMarkerLocations[i].start.line - 1, ch: newMarkerLocations[i].start.column},
            {line: newMarkerLocations[i].end.line - 1, ch: newMarkerLocations[i].end.column},
            {className: 'cm-global-variable'}
          ));
        }
      }
    } catch (ex) {
      oldMarkers = [];
      markers.forEach(function (m) {
        m.clear();
      });
      markers = [];
      console.error(ex.stack || ex);
    }
  }

  function insertCss(css, id) { //upserts css when id is provided
    if(id && document.getElementById(id)) {
      var elem = document.getElementById(id);
      var update = true;
    } else {
      var elem = document.createElement('style');
      elem.setAttribute('type', 'text/css');
      elem.id = id || "";
      var update = false;
    }
    
    if ('textContent' in elem) {
      elem.textContent = css;
    } else {
      elem.styleSheet.cssText = css;
    }

    if(update === false) {//insert
      var head = document.getElementsByTagName('head')[0];
      head.appendChild(elem);
    }
  };

  prefs.definePreference('css', 'string', 'font-style: oblique !important;').on('change', function () {
    insertCss('.cm-global-variable {'+ prefs.get('css') +'}', 'peey-brackets-globals-style');
  });
});
