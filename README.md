brackets-customized-globals
===============

Stylize global variables in brackets. By default, global variables are italicized.

![screen shot](http://s27.postimg.org/4365f54fn/bracketsextn.png)

###To customize the style###
Replace `font-style: oblique !important;` with whichever style you prefer in main.js. This will automatically become editable form inside of Brackets once [Preference System UI](https://trello.com/c/5GwJgKfi/480-8-preferences-dialog) is implemented in brackets.

###To exclude certain variables from being stylized##
Add names of such variables to `userGlobalGlobals` array in globals.js

**Based on** [brackets-globals](https://github.com/ForbesLindesay/brackets-globals) extension by [Forbes Lidesay](https://github.com/ForbesLindesay), which highlights spelling mistakes of variable names and properties.
