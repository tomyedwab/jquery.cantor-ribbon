/**
 * A horizontal or vertical ribbon that extends off the screen infinitely in both
 * directions and can be smoothly dragged via click & drag or just clicking
 * on the desired element.
 * 
 * The contents of the ribbon are created by a generator function which
 * takes and index (which is 0 at the origin and covers all integers) and
 * returns an element to draw at that index.
 *
 * The view is initially positioned such that element #0 is at the center
 * of the ribbon.
 */

(function( $ ) {

    var HORIZONTAL = 1;
    var VERTICAL = 2;

    var CantorRibbonView = function($el, options) {
        // Call the generator to create a subview and add it to the ribbon
        this.generateElement = function(index) {
            // Generate the element and add it to the container element
            var $el = this.generator(index);
            if (!$el) {
                return false;
            }

            $el.addClass("ribbon-item")
               .appendTo(this.$el)
               .on("DOMSubtreeModified DOMAttrModified", $.proxy(function() {
                   this.updateViews(false);
               }, this));

            // Add to the subviews table
            this.subViews[index] = {
                index: index,
                $el: $el
            }

            // Bind a click handler on the element
            if (!this.noClickHandler) {
                $el.on("click", $.proxy(function(event) {
                    if (this.dragState && this.dragState.type == "interp") {
                        this.dragState = null;
                    }
                    this.goToIndex(index);
                }, this));
            }

            // Update minIndex/maxIndex
            if (index < this.minIndex) {
                this.minIndex = index;
            }
            if (index > this.maxIndex) {
                this.maxIndex = index;
            }

            return true;
        };

        // Measure the element
        this.measureView = function(view) {
            var depth;
            if (this.dir == HORIZONTAL) {
                view.extent = view.$el.outerWidth();
                depth = view.$el.outerHeight();
            } else {
                view.extent = view.$el.outerHeight();
                depth = view.$el.outerWidth();
            }

            // Expand to fit the tallest element, if necessary
            if (!this.noAutoSize && depth > this.maxDepth) {
                this.maxDepth = depth;
                if (this.dir == HORIZONTAL) {
                    this.$el.css("height", this.maxDepth + "px");
                } else {
                    this.$el.css("width", this.maxDepth + "px");
                }
            }
        };

        // Animate the positions of the subview elements
        this.updateViews = function(updateSelection) {
            if (this.updating) {
                return;
            }
            this.updating = true;

            // "offset" position is always the center of the selected index
            this.measureView(this.subViews[this.selectedIndex]);
            if (this.subViews[this.selectedIndex].anchorPos == undefined) {
                this.subViews[this.selectedIndex].anchorPos = -this.subViews[this.selectedIndex].extent / 2;
            }

            // Generate views to right/below selected view
            var nextPos = this.subViews[this.selectedIndex].anchorPos +
                this.subViews[this.selectedIndex].extent;
            for (var idx = this.selectedIndex + 1; ; idx++) {
                if (this.offset + nextPos > this.ribbonExtent) {
                    // We're off-screen; delete everything past this index
                    for (var delIdx = idx; delIdx <= this.maxIndex; delIdx++) {
                        if (this.subViews[delIdx]) {
                            this.cleanup(delIdx, this.subViews[delIdx].$el);
                            this.subViews[delIdx].$el.remove();
                            delete this.subViews[delIdx];
                        }
                    }
                    this.maxIndex = idx - 1;
                    break;
                }
                if (idx > this.maxIndex) {
                    // We haven't generated a view this far out yet, generate
                    // it now
                    if (!this.generateElement(idx)) {
                        break;
                    }
                }
                this.measureView(this.subViews[idx]);
                this.subViews[idx].anchorPos = nextPos;
                nextPos += this.subViews[idx].extent;
            }

            // Generate views to the left/above selected view
            var nextPos = this.subViews[this.selectedIndex].anchorPos;
            for (var idx = this.selectedIndex - 1; ; idx--) {
                if (this.offset + nextPos < 0) {
                    // We're off-screen; delete everything past this index
                    for (var delIdx = idx; delIdx >= this.minIndex; delIdx--) {
                        if (this.subViews[delIdx]) {
                            this.cleanup(delIdx, this.subViews[delIdx].$el);
                            this.subViews[delIdx].$el.remove();
                            delete this.subViews[delIdx];
                        }
                    }
                    this.minIndex = idx + 1;
                    break;
                }
                if (idx < this.minIndex) {
                    // We haven't generated a view this far out yet, generate
                    // it now
                    if (!this.generateElement(idx)) {
                        break;
                    }
                }
                this.measureView(this.subViews[idx]);
                this.subViews[idx].anchorPos = nextPos - this.subViews[idx].extent;
                nextPos -= this.subViews[idx].extent;
            }

            var closestToCenterIndex = null;
            var closestToCenterDist = this.ribbonExtent * 2;

            // Place the elements in their positions and calculate the
            // closest-to-center element
            $.each(this.subViews, $.proxy(function(idx, element) {
                // Calculate center position
                element.centerPos = element.anchorPos + element.extent / 2;

                // Update positioning
                if (this.dir == HORIZONTAL) {
                    element.$el.css({ left: this.offset + element.anchorPos, });
                } else {
                    element.$el.css({ top: this.offset + element.anchorPos, });
                }

                // Check distance from center of ribbon
                var dist = Math.max(this.offset + element.anchorPos - this.ribbonExtent / 2, this.ribbonExtent / 2 - (this.offset + element.anchorPos + element.extent));
                if (dist < closestToCenterDist) {
                    closestToCenterIndex = element.index;
                    closestToCenterDist = dist;
                }
                element.$el.removeClass("selected");
            }, this));

            if (closestToCenterIndex === null) {
                throw "Something went terribly wrong updating the selected ribbon element.";
            }
            if (updateSelection && this.selectedIndex != closestToCenterIndex) {
                this.$el.trigger("ribbonSelected", closestToCenterIndex);

                // Update selected index
                this.selectedIndex = closestToCenterIndex;
            }
            this.subViews[this.selectedIndex].$el.addClass("selected");

            this.updating = false;
        };

        // Navigate to a particular offset on the ribbon
        this.goToOffset = function(offset) {
            // Set the drag state to interpolation
            this.dragState = {
                type: 'interp',
                target: offset
            };

            if (this.timer) {
                window.clearInterval(this.timer);
            }
            this.timer = window.setInterval($.proxy(function() {
                // If some other drag event happened, abort this timer
                if (!this.dragState || this.dragState.type != "interp") {
                    window.clearInterval(this.timer);
                    this.timer = null;
                    return;
                };

                // Animate the offset
                this.offset = this.offset * 0.5 + this.dragState.target * 0.5;

                // Update subviews
                this.updateViews(true);

                // Are we done?
                if (Math.abs(this.offset - this.dragState.target) < 3) {
                    // We're done; clear the timer and the drag state
                    this.offset = this.dragState.target;
                    window.clearInterval(this.timer);
                    this.timer = null;
                    this.dragState = null;

                    // Trigger an event that we've navigated
                    this.$el.trigger("ribbonNavigated", this.selectedIndex);
                }
            }, this), 33);
        },

        // Navigate to a particular element on the ribbon
        this.goToIndex = function(index) {
            // Can't navigate while the user is dragging something
            if (this.dragState != null && this.dragState.type != "interp") {
                return;
            }
            if (index == this.selectedIndex) {
                return;
            }

            // If the requested element is not in the visible area, jump to it
            // directly.
            if (!this.subViews[index]) {
                this.resetToIndex(index);
            }

            var element = this.subViews[index];
            this.goToOffset(this.ribbonExtent / 2 - element.centerPos);
        };

        // Handle a mouse drag or touch event beginning
        this.handleDragStart = function(pos) {
            this.dragState = {
                type: 'mouseDown',
                startPos: pos,
                lastPos: pos,
                lastTime: new Date(),
                velocity: 0,
                startOffset: this.offset
            };
        };

        this.measureRibbon = function() {
        if (this.dir == HORIZONTAL) {
            this.ribbonExtent = this.$el.width();
        } else {
            this.ribbonExtent = this.$el.height();
        }
        };

        // Handle a mouse drag or touch event in progress
        this.handleDragMove = function(pos) {
            // Update offset
            this.offset = (pos - this.dragState.startPos +
                this.dragState.startOffset);

            // Update velocity
            var currentTime = new Date();
            var dt = currentTime - this.dragState.lastTime;
            this.dragState.velocity = this.dragState.velocity * 0.75 +
                (pos - this.dragState.lastPos) / dt * 0.25;
            this.dragState.lastPos = pos;
            this.dragState.lastTime = currentTime;

            // Update subviews
            this.updateViews(true);
        };

        // Handle a moues drag or touch event completing
        this.handleDragStop = function() {
            if (this.dragState.lastPos == this.dragState.startPos) {
                this.dragState = null;
                return;
            }

            // Calculate the target offset given the position and velocity
            var finalOffset = this.offset + this.dragState.velocity * 100 - this.ribbonExtent / 2;

            // Find element whose center is nearest finalOffset
            // TODO: Handle end clamping better
            var bestElementIndex = this.selectedIndex;
            var bestElementDist = Math.abs(finalOffset + this.subViews[this.selectedIndex].centerPos);
            $.each(this.subViews, $.proxy(function(idx, element) {
                var dist = Math.abs(finalOffset + element.centerPos);
                if (dist < bestElementDist) {
                    bestElementIndex = element.index;
                    bestElementDist = dist;
                }
            }, this));

            this.dragState = null;
            this.goToIndex(bestElementIndex);
        };

        this.resetToIndex = function(index) {
            // Current scroll offset of the origin point
            this.offset = this.ribbonExtent / 2;

            // Minimum and maximum indices for generated elements
            this.minIndex = index;
            this.maxIndex = index;

            // Current height (horizontal) or width (vertical) (grows to fit the
            // largest element ever encountered)
            this.maxDepth = 0;

            // Currently selected index
            this.selectedIndex = index;

            // Delete any existing views
            if (this.subViews) {
                this.updating = true;
                $.each(this.subViews, $.proxy(function(idx, element) {
                    this.cleanup(idx, element.$el);
                    element.$el.remove();
                }, this));
                this.updating = false;
            }

            // Cache of all our subviews by index
            this.subViews = {};
        
            // Create the first element and add it to the ribbon
            this.generateElement(index);

            // Populate the remaining views that are initially visible
            this.updateViews(true);
        };

        this.generator = options.generator;
        this.cleanup = options.cleanup || $.noop;
        this.dir = (options.direction == "vertical") ? VERTICAL : HORIZONTAL;
        this.noAutoSize = options.noAutoSize || false;
        this.noClickHandler = options.noClickHandler || false;

        // Make updateViews non-reentrant
        this.updating = false;

        // The ribbon element
        this.$el = $el;

        // A timer for animation
        this.timer = null;

        // Add the classes
        this.$el.addClass("cantor-ribbon");

        if (this.dir == HORIZONTAL) {
            this.$el.addClass("horizontal-ribbon");
        } else {
            this.$el.addClass("vertical-ribbon");
        }

        // Measure the ribbon
        this.measureRibbon();

        // The speed of the scroll (default: 15% of total extent)
        this.scrollSpeed = this.ribbonExtent * (options.scrollSpeed || 0.15);

        // Drag state
        this.dragState = null;

        // Initialize to the requested index
        this.resetToIndex(options.startIndex || 0);

        // Bind event handlers for click & drag
        this.$el.on("mousedown", $.proxy(function(event) {
            if (event.which != 1) {
                // Only care about left-clicks
                return;
            }
            var pos = (this.dir == HORIZONTAL) ? event.clientX : event.clientY;
            this.handleDragStart(pos);
        }, this))
        .on("touchstart", $.proxy(function(event) {
            var touch = event.originalEvent.touches[0];
            var pos = (this.dir == HORIZONTAL) ? touch.pageX : touch.pageY;
            this.handleDragStart(pos);
        }, this))
        //Firefox
        .on("DOMMouseScroll", $.proxy(function(event) {
            if (event.originalEvent.detail > 0) {
                // scroll down
                this.goToOffset(this.offset - this.scrollSpeed);
            } else {
                // scroll up
                this.goToOffset(this.offset + this.scrollSpeed);
            }

            // prevent page fom scrolling
            return false;
        }, this))
        //IE, Opera, Safari
        .on('mousewheel', $.proxy(function(event){
            if (event.originalEvent.wheelDelta < 0) {
                // scroll down
                this.goToOffset(this.offset - this.scrollSpeed);
            } else {
                // scroll up
                this.goToOffset(this.offset + this.scrollSpeed);
            }

            //prevent page fom scrolling
            return false;
        }, this));

        $(document.body).on("mousemove", $.proxy(function(event) {
            if (this.dragState && this.dragState.type == "mouseDown") {
                var pos = (this.dir == HORIZONTAL) ? event.clientX : event.clientY;
                this.handleDragMove(pos);
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }, this))
        .on("touchmove", $.proxy(function(event) {
            if (this.dragState && this.dragState.type == "mouseDown") {
                var touch = event.originalEvent.touches[0];
                var pos = (this.dir == HORIZONTAL) ? touch.pageX : touch.pageY;
                this.handleDragMove(pos);
                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }, this))
        .on("mouseup", $.proxy(function(event) {
            if (this.dragState && this.dragState.type == "mouseDown") {
                this.handleDragStop();
                event.stopImmediatePropagation();
            }
        }, this))
        .on("touchend", $.proxy(function(event) {
            if (this.dragState && this.dragState.type == "mouseDown") {
                this.handleDragStop();
                event.stopImmediatePropagation();
            }
        }, this));

        // Handle window resize
        $(window).on("resize", $.proxy(function(event) {
            var oldExtent = this.ribbonExtent;
            this.measureRibbon();
            // Re-center offset
            this.offset += (this.ribbonExtent - oldExtent) / 2;
            this.updateViews(false);
        }, this));

        // We're all set! Fire an initial event for the initial navigation
        this.$el.trigger("ribbonNavigated", options.startIndex || 0);
    };

    $.fn.cantorRibbon = function(optionsOrCommand, commandOptions) {
        // Don't bind multiple times
        if (this.data('cantorRibbonView')) {
            if (optionsOrCommand == "refresh") {
                this.data('cantorRibbonView').updateViews(false);
            }
            if (optionsOrCommand == "getSelectedIndex") {
                return this.data('cantorRibbonView').selectedIndex;
            }
            if (optionsOrCommand == "goToIndex") {
                this.data('cantorRibbonView').goToIndex(commandOptions);
            }
            return this;
        }
        return this.data('cantorRibbonView',
            new CantorRibbonView(this, optionsOrCommand));
    };

})( jQuery );
