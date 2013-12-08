Cantor Ribbon jQuery plugin
===========================

A "Cantor Ribbon" is a horizontal ribbon that extends off the screen infinitely in both directions. The user can interact with the ribbon either by click-and-drag on the ribbon or by clicking on the desired element. (Touch support will come soon).

The caller provides a generator function which simply returns a single jQuery element for a given index (which can range from -infinity to +infinity, with 0 being initially centered in the ribbon). The ribbon positions the elements along the ribbon and expands vertically to fit the tallest element.

For example usage, see example-simple.html.
